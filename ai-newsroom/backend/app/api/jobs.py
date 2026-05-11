from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import VideoAnalyzeRequest
from app.services.job_service import (
    analyze_video_job,
    ensure_video_analysis_supported,
    get_job_or_404,
    list_jobs,
    trigger_process_job,
    trigger_scrape_job,
)
from app.services.raw_article_service import has_unprocessed_articles
from app.services.auth_service import require_permission, resolve_current_user
from app.services.quota_service import (
    ARTICLE_CARDS,
    DAILY_ARTICLE_PROCESSES,
    DAILY_SCRAPES,
    DAILY_VIDEO_ANALYSES,
    VIDEO_CARDS,
    consume_daily_quota,
    ensure_resource_quota,
)

router = APIRouter(prefix="/api", tags=["jobs"])


@router.post("/trigger/scrape")
async def trigger_scrape(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Manually trigger a scrape job via Celery (returns immediately)."""
    await consume_daily_quota(db, current_user.id, DAILY_SCRAPES)
    return await trigger_scrape_job(current_user.id)


@router.post("/trigger/process")
async def trigger_process(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Manually trigger article processing via Celery (returns immediately)."""
    if not await has_unprocessed_articles(db, current_user.id):
        raise HTTPException(status_code=400, detail="没有可处理的未处理文章。")
    await ensure_resource_quota(db, current_user.id, ARTICLE_CARDS)
    await consume_daily_quota(db, current_user.id, DAILY_ARTICLE_PROCESSES)
    return await trigger_process_job(current_user.id)


@router.get("/jobs")
async def get_all_jobs(current_user=Depends(require_permission("network.view"))):
    """Retrieve all current jobs from the job manager."""
    return await list_jobs(current_user.id, current_user.is_super_admin)


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    current_user=Depends(resolve_current_user),
):
    """Poll the status of a background job."""
    return await get_job_or_404(job_id, current_user.id, current_user.is_super_admin)


@router.post("/analyze/video")
async def analyze_video(
    req: VideoAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Submit a video URL for deconstruction analysis (async via Celery)."""
    ensure_video_analysis_supported(req.url)
    await ensure_resource_quota(db, current_user.id, VIDEO_CARDS)
    await consume_daily_quota(db, current_user.id, DAILY_VIDEO_ANALYSES)
    return await analyze_video_job(req.url, current_user.id)
