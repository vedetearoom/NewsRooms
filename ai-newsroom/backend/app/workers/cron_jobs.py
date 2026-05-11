import logging
from fastapi import HTTPException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.config import get_settings
from app.database import async_session
from app.models import Source, User
from app.services.quota_service import (
    ARTICLE_CARDS,
    DAILY_ARTICLE_PROCESSES,
    DAILY_SCRAPES,
    consume_daily_quota,
    ensure_resource_quota,
)
from app.services.raw_article_service import has_unprocessed_articles
from sqlalchemy import select

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _get_pipeline_user_ids() -> list[int]:
    async with async_session() as db:
        result = await db.execute(
            select(User.id)
            .join(Source, Source.owner_user_id == User.id)
            .where(User.is_active == True, Source.is_active == True)
            .distinct()
        )
        return list(result.scalars().all())


async def _has_unprocessed_articles(owner_user_id: int) -> bool:
    async with async_session() as db:
        return await has_unprocessed_articles(db, owner_user_id)


async def _consume_scheduled_quota(
    owner_user_id: int,
    quota_key: str,
    *,
    resource_key: str | None = None,
) -> bool:
    async with async_session() as db:
        try:
            if resource_key is not None:
                await ensure_resource_quota(db, owner_user_id, resource_key)
            await consume_daily_quota(db, owner_user_id, quota_key)
            await db.commit()
            return True
        except HTTPException as exc:
            await db.rollback()
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            logger.info(
                "Skipping scheduled quota action for user %s: %s",
                owner_user_id,
                detail.get("message") or exc.detail,
            )
            return False


async def pipeline_job():
    """Full automated pipeline: dispatch scrape → process to Celery workers."""
    logger.info("⚡ Pipeline job started: dispatching to Celery")

    from app.workers.tasks import celery_scrape_task, celery_process_task

    user_ids = await _get_pipeline_user_ids()
    if not user_ids:
        logger.info("⚡ Pipeline job skipped: no active users with active sources")
        return

    for owner_user_id in user_ids:
        if await _consume_scheduled_quota(owner_user_id, DAILY_SCRAPES):
            try:
                scrape_result = celery_scrape_task.delay(owner_user_id)
                logger.info("  📤 Scrape task dispatched for user %s: %s", owner_user_id, scrape_result.id)

                # Wait for scrape to finish before starting process for this user.
                scrape_result.get(timeout=300)
                logger.info("  ✅ Scrape completed for user %s", owner_user_id)
            except Exception as e:
                logger.error("  ❌ Scrape failed for user %s: %s", owner_user_id, e)

        if not await _has_unprocessed_articles(owner_user_id):
            logger.info("  ✅ Process skipped for user %s: no unprocessed articles", owner_user_id)
            continue

        if await _consume_scheduled_quota(
            owner_user_id,
            DAILY_ARTICLE_PROCESSES,
            resource_key=ARTICLE_CARDS,
        ):
            try:
                process_result = celery_process_task.delay(owner_user_id)
                logger.info("  📤 Process task dispatched for user %s: %s", owner_user_id, process_result.id)
            except Exception as e:
                logger.error("  ❌ Process dispatch failed for user %s: %s", owner_user_id, e)

    logger.info("⚡ Pipeline job dispatched")


def start_scheduler():
    settings = get_settings()

    # Primary pipeline job: scrape + process in sequence
    # Default: every 4 hours — configurable via SCRAPE_CRON env var
    scrape_cron = settings.scrape_cron  # e.g. "0 */4 * * *"
    try:
        trigger = CronTrigger.from_crontab(scrape_cron)
    except ValueError:
        logger.warning(f"Invalid scrape_cron '{scrape_cron}', falling back to every 4 hours")
        trigger = CronTrigger(hour="*/4", minute=0)

    scheduler.add_job(
        pipeline_job,
        trigger,
        id="pipeline_job",
        replace_existing=True,
        misfire_grace_time=300,
    )

    scheduler.start()
    logger.info(f"📡 Scheduler started — Pipeline job cron: {scrape_cron}")


def stop_scheduler():
    scheduler.shutdown()
