import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select

from app.database import SyncSession, async_session
from app.job_results import job_failure, job_success
from app.models import Agent, Critique, Draft, RawArticle, Source, Task
from app.task_status import TaskStatus

logger = logging.getLogger(__name__)


def get_worker_loop():
    """Get a persistent background event loop for the current worker process."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def run_async(coro):
    """Run an async coroutine in the worker's event loop."""
    return get_worker_loop().run_until_complete(coro)


async def _check_monitor_async(monitor_id: int, owner_user_id: int, platform: str):
    from app.models import MonitorTarget
    from app.services.monitor_discovery import (
        InvalidMonitorCredentialError,
        MissingMonitorCredentialError,
        MonitorDiscoveryError,
        discover_monitor_videos,
    )
    from app.services.monitor_service import save_monitor_check_failure, save_monitor_check_success

    async with async_session() as db:
        result = await db.execute(
            select(MonitorTarget).where(
                MonitorTarget.id == monitor_id,
                MonitorTarget.owner_user_id == owner_user_id,
            )
        )
        target = result.scalar_one_or_none()
        if target is None:
            return job_failure("check_monitor", "Monitor target not found", monitor_id=monitor_id)

        target.last_check_status = "running"
        target.last_check_error = None
        await db.commit()

        try:
            raw_videos = await discover_monitor_videos(db, target, owner_user_id)
            discovered = await save_monitor_check_success(db, target, owner_user_id, raw_videos)
            return job_success(
                "check_monitor",
                monitor_id=monitor_id,
                platform=platform,
                videos_found=len(discovered),
            )
        except MissingMonitorCredentialError as exc:
            await save_monitor_check_failure(db, target, str(exc))
            return job_failure("check_monitor", str(exc), monitor_id=monitor_id, platform=platform)
        except InvalidMonitorCredentialError as exc:
            await save_monitor_check_failure(db, target, str(exc))
            return job_failure("check_monitor", str(exc), monitor_id=monitor_id, platform=platform)
        except MonitorDiscoveryError as exc:
            await save_monitor_check_failure(db, target, str(exc))
            return job_failure("check_monitor", str(exc), monitor_id=monitor_id, platform=platform)
        except Exception as exc:
            await save_monitor_check_failure(db, target, str(exc))
            raise


def run_review_job(task_id: int, owner_user_id: int, reviewer_id: int | None = None):
    """Run AI review (critique + revision) as a worker job."""
    logger.info("[Celery] Starting review for task %s", task_id)

    with SyncSession() as db:
        task = db.execute(
            select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
        ).scalar_one_or_none()
        if not task:
            logger.error("[Celery] Task %s not found", task_id)
            return job_failure("review_task", "Task not found", task_id=task_id)

        draft = db.execute(
            select(Draft)
            .where(Draft.task_id == task_id, Draft.owner_user_id == owner_user_id)
            .order_by(Draft.version.desc())
            .limit(1)
        ).scalar_one_or_none()
        if not draft or not draft.content:
            logger.error("[Celery] No draft for task %s", task_id)
            return job_failure("review_task", "No draft", task_id=task_id)

        existing_critique = db.execute(
            select(Critique)
            .where(Critique.draft_id == draft.id, Critique.owner_user_id == owner_user_id)
            .order_by(Critique.created_at.desc(), Critique.id.desc())
            .limit(1)
        ).scalar_one_or_none()
        if existing_critique and draft.revised_content:
            task.status = TaskStatus.WRITTEN.value
            db.commit()
            logger.info("[Celery] Task %s already reviewed, skipping", task_id)
            return job_success("review_task", task_id=task_id, already_reviewed=True)

        task.status = TaskStatus.REVIEWING.value
        db.commit()

        if reviewer_id:
            reviewer = db.execute(
                select(Agent).where(Agent.id == reviewer_id, Agent.owner_user_id == owner_user_id)
            ).scalar_one_or_none()
        else:
            reviewer = db.execute(
                select(Agent)
                .where(Agent.role.ilike("%reviewer%"), Agent.owner_user_id == owner_user_id)
                .order_by(Agent.is_active.desc(), Agent.is_system.desc(), Agent.created_at.desc())
                .limit(1)
            ).scalar_one_or_none()

        api_key = reviewer.api_key if reviewer else None
        agent_prompt = reviewer.system_prompt if reviewer else None
        agent_context = reviewer.context_text if reviewer else None
        model_ref = reviewer.model_ref if reviewer else "gemini-2.5-flash"
        target_language = task.config.get("language", "en") if task.config else "en"
        draft_content = draft.content
        task_type = task.task_type
        draft_id = draft.id

    from app.services.assassin_agent import AssassinAgent

    assassin = AssassinAgent(api_key=api_key)

    async def _do_review():
        critique_coro = assassin.review(
            draft_content,
            task_type,
            target_language=target_language,
            agent_prompt=agent_prompt,
            agent_context=agent_context,
            model_ref=model_ref,
        )
        revise_coro = assassin.revise_standalone(
            draft_content,
            agent_prompt=agent_prompt,
            agent_context=agent_context,
            model_ref=model_ref,
            target_language=target_language,
        )
        return await asyncio.gather(critique_coro, revise_coro)

    critique_data, revised = run_async(_do_review())

    with SyncSession() as db:
        task = db.execute(
            select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
        ).scalar_one_or_none()
        db.execute(
            delete(Critique).where(
                Critique.draft_id == draft_id,
                Critique.owner_user_id == owner_user_id,
            )
        )
        critique = Critique(
            owner_user_id=owner_user_id,
            task_id=task_id,
            draft_id=draft_id,
            critiques=critique_data.get("critiques", []),
            overall_score=critique_data.get("overall_score"),
            overall_comment=critique_data.get("overall_comment"),
        )
        db.add(critique)

        draft = db.execute(
            select(Draft).where(Draft.id == draft_id, Draft.owner_user_id == owner_user_id)
        ).scalar_one()
        draft.revised_content = revised
        if task:
            task.status = TaskStatus.WRITTEN.value
        db.commit()

    logger.info("[Celery] Review completed for task %s", task_id)
    return job_success("review_task", task_id=task_id)


def run_monitor_check_job(monitor_id: int, owner_user_id: int, platform: str):
    logger.info("[Celery] Starting monitor check for %s (%s)", monitor_id, platform)
    result = run_async(_check_monitor_async(monitor_id, owner_user_id, platform))
    logger.info("[Celery] Monitor check completed: %s", result)
    return result


async def _scrape_all_async(owner_user_id: int):
    from app.services.scraper import Scraper

    scraper = Scraper()
    try:
        async with async_session() as db:
            return await scraper.scrape_all(db, owner_user_id)
    finally:
        await scraper.close()


def run_scrape_job(owner_user_id: int):
    logger.info("[Celery] Starting scrape job")
    count = run_async(_scrape_all_async(owner_user_id))
    logger.info("[Celery] Scrape completed: %s articles", count)
    return job_success("scrape_all", articles_scraped=count)


async def _process_unprocessed_async(owner_user_id: int):
    from app.services.processor import Processor

    processor = Processor()
    async with async_session() as db:
        return await processor.process_unprocessed(db, owner_user_id)


def run_process_job(owner_user_id: int):
    logger.info("[Celery] Starting process job")
    try:
        count = run_async(_process_unprocessed_async(owner_user_id))
    except Exception as exc:
        logger.exception("[Celery] Processing failed")
        return job_failure("process_all", str(exc))
    logger.info("[Celery] Processing completed: %s cards", count)
    return job_success("process_all", cards_created=count)


async def _process_selected_async(article_ids: list[int], owner_user_id: int):
    from app.services.processor import Processor

    processor = Processor()
    async with async_session() as db:
        result = await db.execute(
            select(RawArticle).where(
                RawArticle.id.in_(article_ids),
                RawArticle.is_processed == False,
                RawArticle.owner_user_id == owner_user_id,
            )
        )
        articles = result.scalars().all()
        if not articles:
            return job_success(
                "process_selected",
                cards_created=0,
                articles_processed=0,
                message="All selected articles already processed",
            )
        try:
            count = await processor.process_articles(db, articles, owner_user_id)
        except Exception as exc:
            logger.exception("[Celery] Selected article processing failed")
            return job_failure(
                "process_selected",
                str(exc),
                articles_processed=len(articles),
            )
        return job_success(
            "process_selected",
            cards_created=count,
            articles_processed=len(articles),
        )


def run_process_selected_job(article_ids: list[int], owner_user_id: int):
    logger.info("[Celery] Starting process job for selected articles: %s", article_ids)
    result = run_async(_process_selected_async(article_ids, owner_user_id))
    logger.info("[Celery] Processing completed: %s", result)
    return result


async def _analyze_video_metadata_async(
    video_url: str,
    owner_user_id: int,
    seed_metadata: dict | None = None,
    source_kind: str = "url",
):
    from app.services.video.metadata_analyzer import analyze_video_metadata

    async with async_session() as db:
        card = await analyze_video_metadata(
            db,
            owner_user_id=owner_user_id,
            video_url=video_url,
            seed_metadata=seed_metadata or {},
            source_kind=source_kind,
        )
        await db.commit()
        return {"card_id": card.id, "title": card.title, "video_url": video_url}


def run_video_metadata_analysis_job(
    video_url: str,
    owner_user_id: int,
    seed_metadata: dict | None = None,
    source_kind: str = "url",
):
    logger.info("[Celery] Starting metadata-only video analysis: %s", video_url)
    result = run_async(_analyze_video_metadata_async(video_url, owner_user_id, seed_metadata, source_kind))
    logger.info("[Celery] Metadata-only video analysis completed: %s", result)
    return job_success("analyze_video_metadata", **result)


async def _analyze_video_async(
    video_url: str,
    owner_user_id: int,
    preferred_thumbnail: str | None = None,
    source_kind: str = "url",
    storage_key: str | None = None,
    original_filename: str | None = None,
    mime_type: str | None = None,
):
    from app.services.video_analyzer import VideoAnalyzer

    analyzer = VideoAnalyzer()
    async with async_session() as db:
        card = await analyzer.process_video(
            video_url,
            db,
            owner_user_id,
            preferred_thumbnail=preferred_thumbnail,
            source_kind=source_kind,
            storage_key=storage_key,
            original_filename=original_filename,
            mime_type=mime_type,
        )
        await db.commit()
        return {"card_id": card.id, "title": card.title}


def run_video_analysis_job(
    video_url: str,
    owner_user_id: int,
    preferred_thumbnail: str | None = None,
    source_kind: str = "url",
    storage_key: str | None = None,
    original_filename: str | None = None,
    mime_type: str | None = None,
):
    logger.info("[Celery] Starting video analysis: %s", video_url)
    result = run_async(
        _analyze_video_async(
            video_url,
            owner_user_id,
            preferred_thumbnail,
            source_kind,
            storage_key,
            original_filename,
            mime_type,
        )
    )
    logger.info("[Celery] Video analysis completed: %s", result)
    return job_success("analyze_video", **result)


async def _manual_scrape_async(source_id: int, owner_user_id: int):
    from app.services.scraper import Scraper

    scraper = Scraper()
    try:
        async with async_session() as db:
            src_result = await db.execute(
                select(Source).where(Source.id == source_id, Source.owner_user_id == owner_user_id)
            )
            src = src_result.scalar_one_or_none()
            if not src:
                return job_failure("scrape_source", "Source not found", source_id=source_id, articles_found=0)

            count = await scraper._scrape_source(src, db, owner_user_id)
            src.last_fetched_at = datetime.now(timezone.utc)
            await db.commit()
            return job_success("scrape_source", source_id=source_id, articles_found=count)
    finally:
        await scraper.close()


def run_manual_scrape_job(source_id: int, owner_user_id: int):
    logger.info("[Celery] Starting manual scrape for source %s", source_id)
    result = run_async(_manual_scrape_async(source_id, owner_user_id))
    logger.info("[Celery] Manual scrape completed: %s", result)
    return result
