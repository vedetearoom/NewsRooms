"""Celery task definitions for AI Newsroom background jobs."""
import logging

from billiard.exceptions import SoftTimeLimitExceeded

from app.celery_app import celery_app
from app.job_results import job_failure
from app.task_status import TaskStatus
from app.services.plugin_runtime import run_plugin_prepare_write_job
from app.services.plugin_service import run_plugin_install_job
from app.services.worker_jobs import (
    run_monitor_check_job,
    run_manual_scrape_job,
    run_process_job,
    run_process_selected_job,
    run_review_job,
    run_scrape_job,
    run_video_analysis_job,
    run_video_metadata_analysis_job,
)

logger = logging.getLogger(__name__)


@celery_app.task(name="newsroom.check_monitor", bind=True, max_retries=1, default_retry_delay=30)
def celery_check_monitor(self, monitor_id: int, owner_user_id: int, platform: str):
    """Run monitor discovery in the background."""
    try:
        return run_monitor_check_job(monitor_id, owner_user_id, platform)
    except SoftTimeLimitExceeded:
        logger.error("[Celery] Monitor check timed out for %s (%s)", monitor_id, platform)
        return job_failure("check_monitor", "任务执行超时", monitor_id=monitor_id, platform=platform)
    except Exception as e:
        error_str = str(e)
        if any(keyword in error_str for keyword in ["Cookie", "未配置", "失效", "Unsupported monitor credential"]):
            logger.error("[Celery] Monitor check permanently failed for %s (%s): %s", monitor_id, platform, e)
            return job_failure("check_monitor", error_str[:500], monitor_id=monitor_id, platform=platform)
        logger.error("[Celery] Monitor check failed for %s (%s): %s", monitor_id, platform, e)
        raise self.retry(exc=e)


@celery_app.task(name="newsroom.review", bind=True, max_retries=2, default_retry_delay=30)
def celery_review_task(self, task_id: int, owner_user_id: int, reviewer_id: int | None = None):
    """Run AI review (critique + revision) as a Celery background task."""
    try:
        return run_review_job(task_id, owner_user_id, reviewer_id)
    except SoftTimeLimitExceeded:
        logger.error("[Celery] Review timed out for task %s", task_id)
        from app.database import SyncSession
        from app.models import Task
        from sqlalchemy import select

        with SyncSession() as db:
            task = db.execute(
                select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
            ).scalar_one_or_none()
            if task:
                task.status = TaskStatus.FAILED.value
                db.commit()
        return job_failure("review", "任务执行超时", task_id=task_id)
    except Exception as e:
        logger.error("[Celery] Review failed for task %s: %s", task_id, e)
        from app.database import SyncSession
        from app.models import Task
        from sqlalchemy import select

        with SyncSession() as db:
            task = db.execute(
                select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
            ).scalar_one_or_none()
            if task:
                task.status = TaskStatus.FAILED.value
                db.commit()
        raise self.retry(exc=e)


@celery_app.task(name="newsroom.scrape")
def celery_scrape_task(owner_user_id: int):
    """Run RSS scrape as a Celery background task."""
    return run_scrape_job(owner_user_id)


@celery_app.task(name="newsroom.process")
def celery_process_task(owner_user_id: int):
    """Run article processing as a Celery background task."""
    return run_process_job(owner_user_id)


@celery_app.task(name="newsroom.process_selected")
def celery_process_selected_task(article_ids: list[int], owner_user_id: int):
    """Run article processing for specific articles as a Celery background task."""
    return run_process_selected_job(article_ids, owner_user_id)


@celery_app.task(name="newsroom.analyze_video", bind=True, max_retries=2, default_retry_delay=60)
def celery_analyze_video(
    self,
    video_url: str,
    owner_user_id: int,
    preferred_thumbnail: str | None = None,
    source_kind: str = "url",
    storage_key: str | None = None,
    original_filename: str | None = None,
    mime_type: str | None = None,
):
    """Full video deconstruction pipeline: download audio → transcribe → LLM analysis → save card."""
    try:
        return run_video_analysis_job(
            video_url,
            owner_user_id,
            preferred_thumbnail=preferred_thumbnail,
            source_kind=source_kind,
            storage_key=storage_key,
            original_filename=original_filename,
            mime_type=mime_type,
        )
    except SoftTimeLimitExceeded:
        logger.error("[Celery] Video analysis timed out for %s", video_url)
        return job_failure("analyze_video", "任务执行超时")
    except Exception as e:
        error_str = str(e)
        # Don't retry on unrecoverable errors (bad URL, private video, missing config, etc.)
        if any(keyword in error_str for keyword in [
            "DownloadError", "Unable to download", "Private video",
            "Video unavailable", "not found", "API Key",
            "No video formats found", "xsec_token",
            "未配置", "未找到", "Gemini API Key",
            "ffmpeg", "本地视频", "已上传的视频文件",
            "B站风控", "登录态异常", "Cookie 格式无效",
        ]):
            logger.error(f"[Celery] Video analysis PERMANENTLY failed for {video_url}: {e}")
            return job_failure("analyze_video", error_str[:500])
        logger.error(f"[Celery] Video analysis failed for {video_url}: {e}")
        raise self.retry(exc=e)


@celery_app.task(name="newsroom.analyze_video_metadata", bind=True, max_retries=1, default_retry_delay=30)
def celery_analyze_video_metadata(
    self,
    video_url: str,
    owner_user_id: int,
    seed_metadata: dict | None = None,
    source_kind: str = "url",
):
    """Metadata-only video analysis: fetch public metadata → Extractor Agent → save card."""
    try:
        return run_video_metadata_analysis_job(
            video_url,
            owner_user_id,
            seed_metadata=seed_metadata or {},
            source_kind=source_kind,
        )
    except SoftTimeLimitExceeded:
        logger.error("[Celery] Metadata-only video analysis timed out for %s", video_url)
        return job_failure("analyze_video_metadata", "任务执行超时")
    except Exception as e:
        error_str = str(e)
        if any(keyword in error_str for keyword in [
            "默认提取器", "API Key", "未配置", "无法获取足够的视频元信息",
            "LLM did not return valid JSON", "Agent requires Chinese output",
            "B站风控", "登录态异常", "Cookie 格式无效", "xsec_token",
        ]):
            logger.error("[Celery] Metadata-only video analysis permanently failed for %s: %s", video_url, e)
            return job_failure("analyze_video_metadata", error_str[:500])
        logger.error("[Celery] Metadata-only video analysis failed for %s: %s", video_url, e)
        raise self.retry(exc=e)


@celery_app.task(name="newsroom.manual_scrape")
def celery_manual_scrape(source_id: int, owner_user_id: int):
    """Run manual scrape for a specific source as a Celery background task."""
    return run_manual_scrape_job(source_id, owner_user_id)


@celery_app.task(name="newsroom.plugin_install", bind=True, max_retries=1, default_retry_delay=30)
def celery_plugin_install(self, plugin_id: int, owner_user_id: int, github_token: str | None = None):
    """Install a user-scoped third-party plugin from a pinned GitHub snapshot."""
    try:
        return run_plugin_install_job(plugin_id, owner_user_id, self.request.id, github_token)
    except SoftTimeLimitExceeded:
        logger.error("[Celery] Plugin install timed out for plugin %s", plugin_id)
        return job_failure("plugin_install", "任务执行超时", plugin_id=plugin_id)
    except Exception as e:
        logger.error("[Celery] Plugin install failed for plugin %s: %s", plugin_id, e)
        return job_failure("plugin_install", str(e), plugin_id=plugin_id)


@celery_app.task(name="newsroom.plugin_prepare_write", bind=True, max_retries=0)
def celery_plugin_prepare_write(self, task_id: int, owner_user_id: int, writer_agent_id: int):
    """Run Hermes sandbox preparation before native writing starts."""
    try:
        return run_plugin_prepare_write_job(task_id, owner_user_id, writer_agent_id, self.request.id)
    except SoftTimeLimitExceeded:
        logger.error("[Celery] Plugin prepare write timed out for task %s", task_id)
        return job_failure("plugin_prepare_write", "任务执行超时", task_id=task_id, writer_agent_id=writer_agent_id)
    except Exception as e:
        logger.error("[Celery] Plugin prepare write failed for task %s: %s", task_id, e)
        return job_failure("plugin_prepare_write", str(e), task_id=task_id, writer_agent_id=writer_agent_id)
