from fastapi import HTTPException

from app.services.job_dispatcher import (
    dispatch_process_all_job,
    dispatch_scrape_all_job,
    dispatch_video_analysis_job,
)
from app.services.job_manager import job_manager
from app.services.video.downloader import detect_platform

DOUYIN_VIDEO_ANALYSIS_UNSUPPORTED = "当前版本暂不支持抖音视频解构，请改用本地视频上传。"


def ensure_video_analysis_supported(video_url: str) -> None:
    if detect_platform(video_url) == "douyin":
        raise HTTPException(status_code=400, detail=DOUYIN_VIDEO_ANALYSIS_UNSUPPORTED)


async def trigger_scrape_job(user_id: int) -> dict:
    job_id = await dispatch_scrape_all_job(user_id)
    return {"ok": True, "job_id": job_id}


async def trigger_process_job(user_id: int, pin_created: bool = False) -> dict:
    job_id = await dispatch_process_all_job(user_id, pin_created=pin_created)
    return {"ok": True, "job_id": job_id}


async def list_jobs(user_id: int) -> list[dict]:
    jobs = await job_manager.get_all_jobs()
    return [
        job
        for job in jobs
        if isinstance(job.get("meta"), dict) and job["meta"].get("owner_user_id") == user_id
    ]


async def get_job_or_404(job_id: str, user_id: int) -> dict:
    status = await job_manager.get_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    meta = status.get("meta")
    if not isinstance(meta, dict) or meta.get("owner_user_id") != user_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


async def analyze_video_job(video_url: str, user_id: int) -> dict:
    ensure_video_analysis_supported(video_url)
    job_id = await dispatch_video_analysis_job(video_url, user_id)
    return {"ok": True, "job_id": job_id}
