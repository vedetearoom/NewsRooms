import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models import IntelligenceCard, MonitorTarget, User
from app.schemas import (
    DispatchAnalysisRequest,
    DiscoveredVideo,
    MonitorCachedVideoDeleteRequest,
    MonitorTargetCreate,
    MonitorTargetUpdate,
)
from app.services.credential_service import (
    delete_monitor_credential,
    list_monitor_credentials,
    upsert_monitor_credential,
)
from app.services.job_dispatcher import dispatch_monitor_check_job, dispatch_video_metadata_analysis_job
from app.services.job_manager import job_manager
from app.services.monitor_discovery import (
    build_monitor_rss_url,
    normalize_monitor_discovery_mode,
)
from app.services.rss_monitor import parse_homepage_url
from app.services.quota_service import (
    ACTIVE_BACKGROUND_JOBS,
    DAILY_MONITOR_CHECKS,
    DAILY_VIDEO_ANALYSES,
    VIDEO_CARDS,
    VIDEO_MONITORS,
    consume_daily_quota,
    ensure_resource_quota,
    get_resource_remaining,
)
from app.services.video.metadata_analyzer import get_configured_video_extractor_or_raise
from app.services.video.thumbnail_utils import normalize_thumbnail_url
from app.services.video.url_utils import canonicalize_video_source_url, get_video_source_identity

logger = logging.getLogger(__name__)

MISSING_ANALYSIS_JOB_ERROR = "后台任务状态已丢失，请重新执行解构。"


async def _lock_user_row(db: AsyncSession, user_id: int) -> None:
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())


async def get_monitor_or_404(
    db: AsyncSession,
    monitor_id: int,
    user_id: int,
    *,
    for_update: bool = False,
) -> MonitorTarget:
    query = select(MonitorTarget).where(
        MonitorTarget.id == monitor_id,
        MonitorTarget.owner_user_id == user_id,
    )
    if for_update:
        query = query.with_for_update()
    result = await db.execute(query)
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Monitor target not found")
    return target


async def list_monitor_targets(db: AsyncSession, user_id: int) -> list[MonitorTarget]:
    result = await db.execute(
        select(MonitorTarget)
        .where(MonitorTarget.owner_user_id == user_id)
        .order_by(MonitorTarget.created_at.desc())
    )
    targets = result.scalars().all()
    analyzed_video_meta = await _build_analyzed_video_meta(db, user_id)
    dirty = False
    for target in targets:
        if await _sync_monitor_check_state(db, target):
            dirty = True
        if _sync_cached_video_analysis_state(target, analyzed_video_meta):
            dirty = True
    if dirty:
        await db.commit()
    return targets


async def get_monitor_credentials_payload(db: AsyncSession, user_id: int) -> dict:
    return await list_monitor_credentials(db, user_id)


async def save_monitor_credential_payload(
    db: AsyncSession,
    user_id: int,
    platform: str,
    cookie: str,
) -> dict:
    return await upsert_monitor_credential(db, user_id, platform, cookie)


async def delete_monitor_credential_payload(db: AsyncSession, user_id: int, platform: str) -> dict:
    return await delete_monitor_credential(db, user_id, platform)


async def create_monitor_target(db: AsyncSession, data: MonitorTargetCreate, user_id: int) -> MonitorTarget:
    try:
        platform, platform_id = parse_homepage_url(data.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Serialize monitor creation per user so duplicate clicks cannot create
    # multiple rows for the same monitored account.
    await _lock_user_row(db, user_id)
    existing = await db.execute(
        select(MonitorTarget)
        .where(MonitorTarget.platform == platform)
        .where(MonitorTarget.platform_id == platform_id)
        .where(MonitorTarget.owner_user_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="该博主已在监控列表中。")
    await ensure_resource_quota(db, user_id, VIDEO_MONITORS, lock=False)

    discovery_mode = normalize_monitor_discovery_mode(platform, data.discovery_mode)
    target = MonitorTarget(
        owner_user_id=user_id,
        name=data.name.strip() if data.name.strip() else f"{platform}:{platform_id}",
        platform=platform,
        platform_id=platform_id,
        homepage_url=data.url.strip(),
        rss_url=build_monitor_rss_url(platform, platform_id) if discovery_mode == "rsshub" else None,
        discovery_mode=discovery_mode,
    )
    db.add(target)
    await db.flush()
    await db.refresh(target)
    logger.info("[Monitor] Created: %s (%s:%s)", target.name, target.platform, target.platform_id)
    return target


async def delete_monitor_target(db: AsyncSession, monitor_id: int, user_id: int) -> None:
    target = await get_monitor_or_404(db, monitor_id, user_id)
    await db.delete(target)
    await db.commit()


async def toggle_monitor_target(db: AsyncSession, monitor_id: int, user_id: int) -> MonitorTarget:
    target = await get_monitor_or_404(db, monitor_id, user_id)
    target.is_active = not target.is_active
    await db.flush()
    await db.refresh(target)
    return target


async def update_monitor_target(
    db: AsyncSession,
    monitor_id: int,
    data: MonitorTargetUpdate,
    user_id: int,
) -> MonitorTarget:
    target = await get_monitor_or_404(db, monitor_id, user_id, for_update=True)

    if data.name is not None:
        target.name = data.name.strip()

    if data.url is not None and data.url.strip() != target.homepage_url:
        try:
            platform, platform_id = parse_homepage_url(data.url)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        target.homepage_url = data.url.strip()
        target.platform = platform
        target.platform_id = platform_id
        target.discovery_mode = normalize_monitor_discovery_mode(
            platform,
            data.discovery_mode or target.discovery_mode,
        )
        target.rss_url = (
            build_monitor_rss_url(platform, platform_id)
            if target.discovery_mode == "rsshub"
            else None
        )
        target.cached_videos = []
        target.active_jobs = {}
        target.last_checked_at = None
        target.last_check_job_id = None
        target.last_check_status = None
        target.last_check_error = None
        flag_modified(target, "cached_videos")
        flag_modified(target, "active_jobs")
    elif data.discovery_mode is not None:
        target.discovery_mode = normalize_monitor_discovery_mode(
            target.platform,
            data.discovery_mode,
        )

    await db.flush()
    await db.refresh(target)
    return target


def _normalize_job_status(status: str | None) -> str:
    if status in {"pending", "queued"}:
        return "queued"
    if status in {"started", "running", "retry"}:
        return "running"
    if status in {"completed", "success"}:
        return "completed"
    if status == "failed":
        return "failed"
    return status or "idle"


async def _sync_monitor_check_state(db: AsyncSession, target: MonitorTarget) -> bool:
    if not target.last_check_job_id:
        return False

    status = target.last_check_status or ("completed" if target.last_checked_at else "idle")
    error = target.last_check_error or ""
    dirty = False

    job_status = await job_manager.get_status(target.last_check_job_id)
    if job_status:
        normalized = _normalize_job_status(job_status.get("status"))
        if target.last_check_status != normalized:
            target.last_check_status = normalized
            dirty = True
        if normalized == "failed":
            next_error = job_status.get("error", "") or error
            if target.last_check_error != next_error:
                target.last_check_error = next_error
                dirty = True
        elif target.last_check_error is not None:
            target.last_check_error = None
            dirty = True
        return dirty

    if status in {"queued", "running"} and target.last_checked_at:
        target.last_check_status = "completed"
        target.last_check_error = None
        return True

    return False


async def _build_analyzed_video_meta(db: AsyncSession, user_id: int) -> dict[str, dict[str, object]]:
    card_result = await db.execute(
        select(
            IntelligenceCard.id,
            IntelligenceCard.source_urls,
            IntelligenceCard.created_at,
            IntelligenceCard.extra_data,
        ).where(
            IntelligenceCard.content_type == "video",
            IntelligenceCard.owner_user_id == user_id,
        )
    )

    analyzed_video_meta: dict[str, dict[str, object]] = {}

    def upsert_meta(key: str, card_id: int, analyzed_at: datetime | None) -> None:
        previous = analyzed_video_meta.get(key)
        previous_analyzed_at = previous.get("analyzed_at") if previous else None
        if previous is None or (
            analyzed_at is not None
            and isinstance(previous_analyzed_at, datetime)
            and analyzed_at > previous_analyzed_at
        ) or (
            previous is not None
            and previous_analyzed_at is None
            and analyzed_at is not None
        ):
            analyzed_video_meta[key] = {
                "card_id": card_id,
                "analyzed_at": analyzed_at,
                "last_analyzed_at": analyzed_at.isoformat() if analyzed_at else None,
            }

    for card_id, source_urls, created_at, extra_data in card_result.all():
        if not source_urls:
            continue

        analyzed_at = created_at
        if isinstance(extra_data, dict) and extra_data.get("last_analyzed_at"):
            raw_last_analyzed_at = extra_data["last_analyzed_at"]
            if isinstance(raw_last_analyzed_at, str):
                try:
                    analyzed_at = datetime.fromisoformat(raw_last_analyzed_at)
                except ValueError:
                    analyzed_at = created_at

        for url in source_urls:
            normalized_url = str(url).strip()
            if not normalized_url:
                continue
            upsert_meta(normalized_url, card_id, analyzed_at)
            identity = get_video_source_identity(normalized_url)
            if identity and identity != normalized_url:
                upsert_meta(identity, card_id, analyzed_at)

    return analyzed_video_meta


def _lookup_analyzed_video_meta(
    analyzed_video_meta: dict[str, dict[str, object]],
    url: str,
) -> dict[str, object] | None:
    normalized_url = str(url).strip()
    if not normalized_url:
        return None
    return analyzed_video_meta.get(normalized_url) or analyzed_video_meta.get(
        get_video_source_identity(normalized_url)
    )


def _resolve_missing_monitor_job_status(
    url: str,
    analyzed_video_meta: dict[str, dict[str, object]],
) -> tuple[str, str | None]:
    if _lookup_analyzed_video_meta(analyzed_video_meta, url):
        return "completed", None
    return "failed", MISSING_ANALYSIS_JOB_ERROR


def _sync_cached_video_analysis_state(
    target: MonitorTarget,
    analyzed_video_meta: dict[str, dict[str, object]],
) -> bool:
    cached_videos = list(target.cached_videos or [])
    dirty = False
    for video in cached_videos:
        if not isinstance(video, dict):
            continue
        normalized_thumbnail = normalize_thumbnail_url(video.get("thumbnail"))
        if normalized_thumbnail != (video.get("thumbnail") or ""):
            video["thumbnail"] = normalized_thumbnail
            dirty = True
        url = str(video.get("url") or "").strip()
        meta = _lookup_analyzed_video_meta(analyzed_video_meta, url)
        next_already_analyzed = meta is not None
        next_card_id = int(meta["card_id"]) if meta and meta.get("card_id") is not None else None
        next_last_analyzed_at = str(meta.get("last_analyzed_at")) if meta and meta.get("last_analyzed_at") else None
        if video.get("already_analyzed") != next_already_analyzed:
            video["already_analyzed"] = next_already_analyzed
            dirty = True
        if video.get("analyzed_card_id") != next_card_id:
            video["analyzed_card_id"] = next_card_id
            dirty = True
        if video.get("last_analyzed_at") != next_last_analyzed_at:
            video["last_analyzed_at"] = next_last_analyzed_at
            dirty = True
    if dirty:
        target.cached_videos = cached_videos
        flag_modified(target, "cached_videos")
    return dirty


async def build_discovered_videos(
    db: AsyncSession,
    user_id: int,
    raw_videos: list[dict],
) -> list[DiscoveredVideo]:
    analyzed_video_meta = await _build_analyzed_video_meta(db, user_id)
    discovered: list[DiscoveredVideo] = []
    for video in raw_videos:
        card_meta = _lookup_analyzed_video_meta(analyzed_video_meta, video["url"])
        discovered.append(
            DiscoveredVideo(
                title=video["title"],
                url=video["url"],
                published=video.get("published", ""),
                thumbnail=normalize_thumbnail_url(video.get("thumbnail")),
                is_sticky=bool(video.get("is_sticky")),
                note_type=video.get("note_type"),
                already_analyzed=card_meta is not None,
                analyzed_card_id=(
                    int(card_meta["card_id"])
                    if card_meta is not None
                    and card_meta.get("card_id") is not None
                    else None
                ),
                last_analyzed_at=(
                    card_meta["last_analyzed_at"]
                    if card_meta is not None
                    else None
                ),
                view_count=video.get("view_count"),
                like_count=video.get("like_count"),
                favorite_count=video.get("favorite_count"),
                duration_seconds=video.get("duration_seconds"),
            )
        )
    return discovered


def _deserialize_cached_videos(raw_videos: list[dict] | None) -> list[DiscoveredVideo]:
    if not raw_videos:
        return []
    return [DiscoveredVideo(**video) for video in raw_videos]


def _resolve_monitor_video_url(raw_url: str, cached_videos: list[dict] | None) -> str:
    normalized_url = canonicalize_video_source_url(raw_url)
    cached_url_by_identity = {
        get_video_source_identity(video["url"]): video["url"]
        for video in (cached_videos or [])
        if video.get("url")
    }
    return cached_url_by_identity.get(
        get_video_source_identity(normalized_url),
        normalized_url,
    )


def _build_monitor_video_match_keys(urls: list[str]) -> set[str]:
    match_keys: set[str] = set()
    for raw_url in urls:
        normalized_url = canonicalize_video_source_url(raw_url)
        if not normalized_url:
            continue
        match_keys.add(normalized_url)
        identity = get_video_source_identity(normalized_url)
        if identity:
            match_keys.add(identity)
    return match_keys


def _remove_cached_monitor_videos(cached_videos: list[dict] | None, urls: list[str]) -> tuple[list[dict], int]:
    if not cached_videos:
        return [], 0

    match_keys = _build_monitor_video_match_keys(urls)
    if not match_keys:
        return list(cached_videos), 0

    next_videos: list[dict] = []
    removed = 0
    for video in cached_videos:
        video_url = str(video.get("url", "")).strip()
        if not video_url:
            next_videos.append(video)
            continue

        identity = get_video_source_identity(video_url)
        if video_url in match_keys or identity in match_keys:
            removed += 1
            continue
        next_videos.append(video)

    return next_videos, removed


def _remove_monitor_active_jobs(active_jobs: dict | None, urls: list[str]) -> dict[str, str]:
    if not active_jobs:
        return {}

    match_keys = _build_monitor_video_match_keys(urls)
    if not match_keys:
        return dict(active_jobs)

    return {
        url: job_id
        for url, job_id in active_jobs.items()
        if url not in match_keys and get_video_source_identity(url) not in match_keys
    }


async def save_monitor_check_success(
    db: AsyncSession,
    target: MonitorTarget,
    user_id: int,
    raw_videos: list[dict],
) -> list[DiscoveredVideo]:
    discovered = await build_discovered_videos(db, user_id, raw_videos)
    target.cached_videos = [video.model_dump(mode="json") for video in discovered]
    target.last_checked_at = datetime.now(timezone.utc)
    target.last_check_status = "completed"
    target.last_check_error = None
    flag_modified(target, "cached_videos")
    await db.commit()
    return discovered


async def save_monitor_check_failure(db: AsyncSession, target: MonitorTarget, error: str) -> None:
    target.last_check_status = "failed"
    target.last_check_error = error[:1000]
    await db.commit()


async def request_monitor_check(db: AsyncSession, monitor_id: int, user_id: int) -> dict:
    target = await get_monitor_or_404(db, monitor_id, user_id, for_update=True)

    if target.last_check_job_id:
        existing_job = await job_manager.get_status(target.last_check_job_id)
        if existing_job:
            status = _normalize_job_status(existing_job.get("status"))
            target.last_check_status = status
            if status in {"queued", "running"}:
                await db.commit()
                return {"ok": True, "job_id": target.last_check_job_id, "status": status}

    await ensure_resource_quota(db, user_id, ACTIVE_BACKGROUND_JOBS)
    await consume_daily_quota(db, user_id, DAILY_MONITOR_CHECKS)
    job_id = await dispatch_monitor_check_job(target.id, user_id, target.platform)
    target.last_check_job_id = job_id
    target.last_check_status = "queued"
    target.last_check_error = None
    await db.commit()
    return {"ok": True, "job_id": job_id, "status": "queued"}


async def get_monitor_check_status_payload(db: AsyncSession, monitor_id: int, user_id: int) -> dict:
    target = await get_monitor_or_404(db, monitor_id, user_id)
    if await _sync_monitor_check_state(db, target):
        await db.commit()

    status = target.last_check_status or ("completed" if target.last_checked_at else "idle")
    error = target.last_check_error or ""

    return {
        "job_id": target.last_check_job_id,
        "status": status,
        "error": error,
        "videos": _deserialize_cached_videos(target.cached_videos),
        "last_checked_at": target.last_checked_at,
    }


def _find_cached_video(cached_videos: list[dict], raw_url: str) -> dict | None:
    resolved_url = _resolve_monitor_video_url(raw_url, cached_videos)
    match_keys = _build_monitor_video_match_keys([resolved_url])
    for video in cached_videos:
        video_url = str(video.get("url", "")).strip()
        if video_url in match_keys or get_video_source_identity(video_url) in match_keys:
            return video
    return None


def _monitor_video_seed_metadata(target: MonitorTarget, video: dict) -> dict:
    return {
        "original_url": video.get("url"),
        "normalized_url": video.get("url"),
        "platform": target.platform,
        "author": target.name,
        "title": video.get("title"),
        "published": video.get("published"),
        "thumbnail": normalize_thumbnail_url(video.get("thumbnail")),
        "duration_seconds": video.get("duration_seconds"),
        "view_count": video.get("view_count"),
        "like_count": video.get("like_count"),
        "favorite_count": video.get("favorite_count"),
        "source_kind": video.get("source_kind") or "url",
        "monitor_id": target.id,
    }


async def dispatch_monitor_analysis(
    db: AsyncSession,
    monitor_id: int,
    req: DispatchAnalysisRequest,
    user_id: int,
) -> dict:
    if len(req.urls) > 10:
        raise HTTPException(status_code=400, detail="一次最多处理 10 个视频，请减少选择后重试。")

    target = await get_monitor_or_404(db, monitor_id, user_id, for_update=True)
    cached_videos = list(target.cached_videos or [])
    analyzed_video_meta = await _build_analyzed_video_meta(db, user_id)
    active_jobs = dict(target.active_jobs or {})
    dispatched = []
    skipped = []
    videos_to_dispatch: list[tuple[dict, str]] = []

    await get_configured_video_extractor_or_raise(db, user_id)

    for raw_url in req.urls:
        video = _find_cached_video(cached_videos, raw_url)
        if not video:
            skipped.append({"url": raw_url, "reason": "未找到可生成卡片的视频。"})
            continue

        video_url = str(video.get("url", "")).strip()
        existing = _lookup_analyzed_video_meta(analyzed_video_meta, video_url)
        if existing and existing.get("card_id") is not None and not req.force:
            video["already_analyzed"] = True
            video["analyzed_card_id"] = int(existing["card_id"])
            video["last_analyzed_at"] = existing.get("last_analyzed_at")
            dispatched.append({"url": video_url, "card_id": int(existing["card_id"]), "already_exists": True})
            continue

        if active_jobs.get(video_url):
            dispatched.append({"url": video_url, "job_id": active_jobs[video_url], "status": "queued"})
            continue

        videos_to_dispatch.append((video, video_url))

    if videos_to_dispatch:
        jobs_remaining = await get_resource_remaining(db, user_id, ACTIVE_BACKGROUND_JOBS)
        if jobs_remaining is not None and jobs_remaining < len(videos_to_dispatch):
            excess = videos_to_dispatch[jobs_remaining:]
            videos_to_dispatch = videos_to_dispatch[:jobs_remaining]
            for excess_video, excess_url in excess:
                skipped.append({"url": excess_url, "reason": "进行中的后台任务已达上限，已跳过该视频。"})

    await ensure_resource_quota(db, user_id, VIDEO_CARDS, increment=len(videos_to_dispatch))
    await consume_daily_quota(db, user_id, DAILY_VIDEO_ANALYSES, amount=len(videos_to_dispatch))

    for video, video_url in videos_to_dispatch:
        job_id = await dispatch_video_metadata_analysis_job(
            video_url,
            user_id,
            seed_metadata=_monitor_video_seed_metadata(target, video),
            source_kind=str(video.get("source_kind") or "url"),
        )
        active_jobs[video_url] = job_id
        dispatched.append({"url": video_url, "job_id": job_id, "status": "queued"})

    target.cached_videos = cached_videos
    target.active_jobs = active_jobs
    flag_modified(target, "cached_videos")
    flag_modified(target, "active_jobs")
    await db.commit()
    return {"ok": True, "dispatched": dispatched, "skipped": skipped}


async def delete_monitor_cached_videos(
    db: AsyncSession,
    monitor_id: int,
    req: MonitorCachedVideoDeleteRequest,
    user_id: int,
) -> dict:
    target = await get_monitor_or_404(db, monitor_id, user_id, for_update=True)
    next_videos, removed = _remove_cached_monitor_videos(target.cached_videos, req.urls)
    next_active_jobs = _remove_monitor_active_jobs(target.active_jobs, req.urls)

    target.cached_videos = next_videos
    target.active_jobs = next_active_jobs
    flag_modified(target, "cached_videos")
    flag_modified(target, "active_jobs")
    await db.commit()

    return {"ok": True, "removed": removed}


async def get_monitor_job_status_payload(db: AsyncSession, monitor_id: int, user_id: int) -> dict:
    target = await get_monitor_or_404(db, monitor_id, user_id, for_update=True)
    active_jobs = target.active_jobs or {}
    if not active_jobs:
        return {"statuses": {}, "errors": {}}

    analyzed_video_meta = await _build_analyzed_video_meta(db, user_id)
    statuses: dict[str, str] = {}
    errors: dict[str, str] = {}
    completed_urls: list[str] = []

    for url, job_id in active_jobs.items():
        status = await job_manager.get_status(job_id)
        if status:
            statuses[url] = status["status"]
            if status["status"] == "failed" and status.get("error"):
                errors[url] = status["error"]
            if status["status"] in ["completed", "failed"]:
                completed_urls.append(url)
        else:
            resolved_status, resolved_error = _resolve_missing_monitor_job_status(
                url,
                analyzed_video_meta,
            )
            statuses[url] = resolved_status
            if resolved_error:
                errors[url] = resolved_error
            completed_urls.append(url)

    if completed_urls:
        for url in completed_urls:
            active_jobs.pop(url, None)
        target.active_jobs = dict(active_jobs)
        flag_modified(target, "active_jobs")

        if target.cached_videos:
            cached = target.cached_videos
            modified = False
            for video in cached:
                if video["url"] in completed_urls and statuses[video["url"]] == "completed":
                    card_meta = _lookup_analyzed_video_meta(analyzed_video_meta, video["url"])
                    video["already_analyzed"] = True
                    if card_meta and card_meta.get("card_id") is not None:
                        video["analyzed_card_id"] = int(card_meta["card_id"])
                    if card_meta and card_meta.get("last_analyzed_at") is not None:
                        video["last_analyzed_at"] = card_meta["last_analyzed_at"]
                    modified = True
            if modified:
                target.cached_videos = list(cached)
                flag_modified(target, "cached_videos")
        await db.commit()

    return {"statuses": statuses, "errors": errors}
