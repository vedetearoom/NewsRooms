"""Video blogger monitoring routes."""

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    DispatchAnalysisRequest,
    ManualVideoInboxDeleteRequest,
    ManualVideoImportRequest,
    ManualVideoInboxItemOut,
    MonitorCachedVideoDeleteRequest,
    MonitorCheckQueuedResponse,
    MonitorCheckStatusOut,
    MonitorCredentialListOut,
    MonitorCredentialUpsertRequest,
    MonitorTargetCreate,
    MonitorTargetOut,
    MonitorTargetUpdate,
)
from app.services.auth_service import require_permission
from app.services.manual_video_inbox_service import (
    analyze_manual_video_inbox_item,
    delete_manual_video_inbox_items,
    get_manual_video_job_status_payload,
    import_manual_video_file,
    import_manual_video_urls,
    list_manual_video_inbox_items,
)
from app.services.monitor_service import (
    create_monitor_target,
    delete_monitor_cached_videos,
    delete_monitor_credential_payload,
    delete_monitor_target,
    dispatch_monitor_analysis,
    get_monitor_check_status_payload,
    get_monitor_credentials_payload,
    get_monitor_job_status_payload,
    list_monitor_targets,
    request_monitor_check,
    save_monitor_credential_payload,
    toggle_monitor_target,
    update_monitor_target,
)

router = APIRouter(prefix="/api/monitors", tags=["monitors"])


@router.get("/credentials", response_model=MonitorCredentialListOut)
async def get_monitor_credentials(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await get_monitor_credentials_payload(db, current_user.id)


@router.put("/credentials/{platform}")
async def save_monitor_credential(
    platform: str,
    data: MonitorCredentialUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await save_monitor_credential_payload(db, current_user.id, platform, data.cookie)


@router.delete("/credentials/{platform}")
async def delete_monitor_credential(
    platform: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await delete_monitor_credential_payload(db, current_user.id, platform)


@router.get("", response_model=list[MonitorTargetOut])
async def list_monitors(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """List all monitor targets."""
    return await list_monitor_targets(db, current_user.id)


@router.post("", response_model=MonitorTargetOut)
async def create_monitor(
    data: MonitorTargetCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Create a monitor target from a blogger homepage URL."""
    return await create_monitor_target(db, data, current_user.id)


@router.get("/manual-videos", response_model=list[ManualVideoInboxItemOut])
async def list_manual_videos(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """List manually imported inbox videos."""
    return await list_manual_video_inbox_items(db, current_user.id)


@router.post("/manual-videos/import", response_model=list[ManualVideoInboxItemOut])
async def import_manual_videos(
    data: ManualVideoImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Import one or more direct video URLs into the inbox."""
    return await import_manual_video_urls(db, data, current_user.id)


@router.post("/manual-videos/upload", response_model=ManualVideoInboxItemOut)
async def upload_manual_video(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Upload one local video file into the inbox."""
    return await import_manual_video_file(db, file, current_user.id)


@router.post("/manual-videos/{item_id}/analyze")
async def analyze_manual_video(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Analyze a manually imported inbox video."""
    return await analyze_manual_video_inbox_item(db, item_id, current_user.id)


@router.post("/manual-videos/delete")
async def delete_manual_videos(
    data: ManualVideoInboxDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Delete selected manually imported inbox videos."""
    return await delete_manual_video_inbox_items(db, data, current_user.id)


@router.get("/manual-videos/job-status")
async def get_manual_video_job_status(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Check status of active jobs for manually imported videos."""
    return await get_manual_video_job_status_payload(db, current_user.id)


@router.delete("/{monitor_id}")
async def delete_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Delete a monitor target."""
    await delete_monitor_target(db, monitor_id, current_user.id)
    return {"ok": True}


@router.patch("/{monitor_id}/toggle", response_model=MonitorTargetOut)
async def toggle_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Toggle active/paused state."""
    return await toggle_monitor_target(db, monitor_id, current_user.id)


@router.patch("/{monitor_id}", response_model=MonitorTargetOut)
async def update_monitor(
    monitor_id: int,
    data: MonitorTargetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Update monitor target (name, url)."""
    return await update_monitor_target(db, monitor_id, data, current_user.id)


@router.post("/{monitor_id}/check", response_model=MonitorCheckQueuedResponse)
async def check_monitor(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Dispatch a background discovery job for this monitor."""
    return await request_monitor_check(db, monitor_id, current_user.id)


@router.get("/{monitor_id}/check-status", response_model=MonitorCheckStatusOut)
async def get_monitor_check_status(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Get background discovery status and latest cached results."""
    return await get_monitor_check_status_payload(db, monitor_id, current_user.id)


@router.post("/{monitor_id}/dispatch")
async def dispatch_analysis(
    monitor_id: int,
    req: DispatchAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Dispatch analysis jobs for selected videos and save job references to active_jobs."""
    return await dispatch_monitor_analysis(db, monitor_id, req, current_user.id)


@router.post("/{monitor_id}/delete-videos")
async def delete_cached_videos(
    monitor_id: int,
    req: MonitorCachedVideoDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Delete selected cached videos from a monitor target."""
    return await delete_monitor_cached_videos(db, monitor_id, req, current_user.id)


@router.get("/{monitor_id}/job-status")
async def get_monitor_job_status(
    monitor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Check status of active jobs for this monitor's videos."""
    return await get_monitor_job_status_payload(db, monitor_id, current_user.id)
