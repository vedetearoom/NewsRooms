from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IntelligenceCard, ManualVideoInboxItem, MonitorTarget
from app.schemas import (
    ManualVideoInboxDeleteRequest,
    ManualVideoImportRequest,
    ManualVideoInboxItemOut,
)
from app.services.credential_service import get_decrypted_monitor_cookie
from app.services.job_dispatcher import dispatch_video_metadata_analysis_job
from app.services.job_manager import job_manager
from app.services.quota_service import (
    ACTIVE_BACKGROUND_JOBS,
    DAILY_VIDEO_ANALYSES,
    MANUAL_VIDEO_ITEMS,
    VIDEO_CARDS,
    consume_daily_quota,
    ensure_resource_quota,
    get_resource_remaining,
)
from app.services.video.metadata_analyzer import get_configured_video_extractor_or_raise
from app.services.upload_service import s3_client, settings
from app.services.video.downloader import detect_platform, fetch_video_metadata
from app.services.video.local_video import store_uploaded_manual_video
from app.services.video.thumbnail_utils import normalize_thumbnail_url
from app.services.video.url_utils import canonicalize_video_source_url, get_video_source_identity

logger = logging.getLogger(__name__)

MISSING_ANALYSIS_JOB_ERROR = "后台任务状态已丢失，请重新执行解构。"
DOUYIN_UNSUPPORTED_ERROR = "当前版本暂不支持抖音链接导入，请改用本地视频上传。"


def _extract_card_analysis_timestamp(card: IntelligenceCard) -> datetime | None:
    extra_data = card.extra_data or {}
    raw = extra_data.get("last_analyzed_at") if isinstance(extra_data, dict) else None
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return card.created_at
    return card.created_at


async def _build_video_card_index(db: AsyncSession, user_id: int) -> dict[str, dict[str, object]]:
    result = await db.execute(
        select(IntelligenceCard).where(
            IntelligenceCard.content_type == "video",
            IntelligenceCard.owner_user_id == user_id,
        )
    )
    cards = result.scalars().all()

    card_index: dict[str, dict[str, object]] = {}
    for card in cards:
        analyzed_at = _extract_card_analysis_timestamp(card)
        for source_url in (card.source_urls or []):
            previous = card_index.get(source_url)
            previous_at = previous.get("last_analyzed_at") if previous else None
            if previous is None or (
                isinstance(previous_at, datetime)
                and analyzed_at is not None
                and analyzed_at > previous_at
            ) or (
                previous is not None
                and previous_at is None
                and analyzed_at is not None
            ):
                card_index[source_url] = {
                    "card_id": card.id,
                    "last_analyzed_at": analyzed_at,
                }
    return card_index


def _serialize_manual_item(
    item: ManualVideoInboxItem,
    card_index: dict[str, dict[str, object]],
) -> ManualVideoInboxItemOut:
    card_meta = card_index.get(item.normalized_url)
    linked_card_id = int(card_meta["card_id"]) if card_meta and card_meta.get("card_id") is not None else None
    last_analyzed_at = card_meta.get("last_analyzed_at") if card_meta else None
    already_analyzed = linked_card_id is not None
    resolved_status = item.status
    if already_analyzed and not item.active_job_id:
        resolved_status = "done"
    elif not already_analyzed and not item.active_job_id and item.status == "done":
        resolved_status = "pending"

    return ManualVideoInboxItemOut(
        id=item.id,
        source_kind=item.source_kind or "url",
        original_url=item.original_url,
        normalized_url=item.normalized_url,
        platform=item.platform,
        author=item.author,
        title=item.title,
        original_filename=item.original_filename,
        mime_type=item.mime_type,
        file_size_bytes=item.file_size_bytes,
        published=item.published,
        thumbnail=normalize_thumbnail_url(item.thumbnail),
        duration_seconds=item.duration_seconds,
        view_count=item.view_count,
        like_count=item.like_count,
        favorite_count=item.favorite_count,
        status=resolved_status,
        active_job_id=item.active_job_id,
        linked_card_id=linked_card_id,
        last_analyzed_at=last_analyzed_at,
        error_message=item.error_message,
        already_analyzed=already_analyzed,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _delete_storage_object(storage_key: str) -> None:
    s3_client.delete_object(Bucket=settings.minio_bucket, Key=storage_key)


def _extract_storage_key_from_public_url(url: str | None) -> str | None:
    candidate = str(url or "").strip()
    if not candidate:
        return None

    prefix = f"{settings.minio_endpoint.rstrip('/')}/{settings.minio_bucket}/"
    if not candidate.startswith(prefix):
        return None

    storage_key = candidate.removeprefix(prefix).strip()
    return storage_key or None


async def list_manual_video_inbox_items(db: AsyncSession, user_id: int) -> list[ManualVideoInboxItemOut]:
    result = await db.execute(
        select(ManualVideoInboxItem)
        .where(ManualVideoInboxItem.owner_user_id == user_id)
        .order_by(ManualVideoInboxItem.created_at.desc())
    )
    items = result.scalars().all()
    card_index = await _build_video_card_index(db, user_id)
    return [_serialize_manual_item(item, card_index) for item in items]


async def import_manual_video_urls(
    db: AsyncSession,
    data: ManualVideoImportRequest,
    user_id: int,
) -> list[ManualVideoInboxItemOut]:
    cleaned_urls = [url.strip() for url in data.urls if url and url.strip()]
    if not cleaned_urls:
        raise HTTPException(status_code=400, detail="At least one video URL is required")

    created_or_updated: list[ManualVideoInboxItem] = []
    for raw_url in cleaned_urls:
        platform = detect_platform(raw_url)
        if platform == "douyin":
            raise HTTPException(status_code=400, detail=DOUYIN_UNSUPPORTED_ERROR)
        cookie_header = None
        if platform == "xiaohongshu":
            cookie_header = await get_decrypted_monitor_cookie(db, user_id, platform)
        metadata = await fetch_video_metadata(raw_url, cookie_header=cookie_header)
        normalized_url = metadata["normalized_url"]

        existing_any_result = await db.execute(
            select(ManualVideoInboxItem).where(ManualVideoInboxItem.normalized_url == normalized_url)
        )
        existing_any = existing_any_result.scalar_one_or_none()

        existing_result = await db.execute(
            select(ManualVideoInboxItem).where(
                ManualVideoInboxItem.normalized_url == normalized_url,
                ManualVideoInboxItem.owner_user_id == user_id,
            )
        )
        item = existing_result.scalar_one_or_none()

        if item is None and existing_any is not None and existing_any.owner_user_id != user_id:
            raise HTTPException(
                status_code=409,
                detail="该视频链接已被其他账号导入，当前版本暂不支持跨账号重复导入。",
            )

        if item is None:
            await ensure_resource_quota(db, user_id, MANUAL_VIDEO_ITEMS)
            item = ManualVideoInboxItem(
                owner_user_id=user_id,
                source_kind="url",
                original_url=metadata["original_url"],
                normalized_url=normalized_url,
                platform=metadata["platform"],
                author=metadata["author"],
                title=metadata["title"] or normalized_url,
                published=metadata["published"],
                thumbnail=normalize_thumbnail_url(metadata["thumbnail"]),
                duration_seconds=metadata["duration_seconds"],
                view_count=metadata["view_count"],
                like_count=metadata["like_count"],
                favorite_count=metadata["favorite_count"],
                status="pending",
            )
            db.add(item)
        else:
            item.original_url = metadata["original_url"]
            item.source_kind = "url"
            item.platform = metadata["platform"]
            item.author = metadata["author"]
            item.title = metadata["title"] or item.title or normalized_url
            item.original_filename = None
            item.storage_key = None
            item.mime_type = None
            item.file_size_bytes = None
            item.published = metadata["published"]
            item.thumbnail = normalize_thumbnail_url(metadata["thumbnail"])
            item.duration_seconds = metadata["duration_seconds"]
            item.view_count = metadata["view_count"]
            item.like_count = metadata["like_count"]
            item.favorite_count = metadata["favorite_count"]
            if item.active_job_id is None and item.status != "error":
                item.status = "pending"

        created_or_updated.append(item)

    await db.flush()
    card_index = await _build_video_card_index(db, user_id)
    return [_serialize_manual_item(item, card_index) for item in created_or_updated]


def _manual_item_match_keys(raw_url: str) -> set[str]:
    normalized_url = canonicalize_video_source_url(raw_url)
    if not normalized_url:
        return set()
    identity = get_video_source_identity(normalized_url)
    return {key for key in {normalized_url, identity} if key}


def _manual_item_matches_url(item: ManualVideoInboxItem, match_keys: set[str]) -> bool:
    item_keys = _manual_item_match_keys(item.normalized_url)
    if item.original_url:
        item_keys.update(_manual_item_match_keys(item.original_url))
    return bool(item_keys & match_keys)


async def enqueue_monitor_videos_to_inbox(
    db: AsyncSession,
    target: MonitorTarget,
    urls: list[str],
    user_id: int,
) -> dict:
    cached_videos = target.cached_videos or []
    requested_keys = set().union(*[_manual_item_match_keys(url) for url in urls]) if urls else set()
    selected_videos = [
        video
        for video in cached_videos
        if not requested_keys or _manual_item_match_keys(str(video.get("url", ""))) & requested_keys
    ]

    if not selected_videos:
        return {"ok": True, "dispatched": [], "skipped": [{"reason": "未找到可加入待处理的视频。"}]}

    existing_result = await db.execute(
        select(ManualVideoInboxItem).where(ManualVideoInboxItem.owner_user_id == user_id)
    )
    existing_items = existing_result.scalars().all()
    card_index = await _build_video_card_index(db, user_id)
    created_or_updated: list[ManualVideoInboxItem] = []
    skipped: list[dict[str, str]] = []

    for video in selected_videos:
        raw_url = str(video.get("url", "")).strip()
        normalized_url = canonicalize_video_source_url(raw_url)
        if not normalized_url:
            skipped.append({"url": raw_url, "reason": "视频链接无效。"})
            continue

        match_keys = _manual_item_match_keys(normalized_url)
        item = next((existing for existing in existing_items if _manual_item_matches_url(existing, match_keys)), None)
        if item is None:
            await ensure_resource_quota(db, user_id, MANUAL_VIDEO_ITEMS)
            item = ManualVideoInboxItem(
                owner_user_id=user_id,
                source_kind="url",
                original_url=raw_url,
                normalized_url=normalized_url,
                platform=target.platform,
                author=target.name,
                title=str(video.get("title") or normalized_url),
                published=str(video.get("published") or "") or None,
                thumbnail=normalize_thumbnail_url(video.get("thumbnail")),
                duration_seconds=video.get("duration_seconds"),
                view_count=video.get("view_count"),
                like_count=video.get("like_count"),
                favorite_count=video.get("favorite_count"),
                status="pending",
            )
            db.add(item)
            existing_items.append(item)
        else:
            item.source_kind = "url"
            item.original_url = raw_url
            item.normalized_url = normalized_url
            item.platform = target.platform
            item.author = item.author or target.name
            item.title = str(video.get("title") or item.title or normalized_url)
            item.published = str(video.get("published") or "") or item.published
            item.thumbnail = normalize_thumbnail_url(video.get("thumbnail") or item.thumbnail)
            item.duration_seconds = video.get("duration_seconds")
            item.view_count = video.get("view_count")
            item.like_count = video.get("like_count")
            item.favorite_count = video.get("favorite_count")
            if item.active_job_id is None and item.status != "error":
                item.status = "pending"

        created_or_updated.append(item)

    await db.flush()
    serialized = [_serialize_manual_item(item, card_index) for item in created_or_updated]
    return {
        "ok": True,
        "dispatched": [
            {"url": item.normalized_url, "item_id": item.id, "status": item.status}
            for item in serialized
        ],
        "skipped": skipped,
        "queued_count": len(serialized),
        "skipped_count": len(skipped),
    }


async def import_manual_video_file(
    db: AsyncSession,
    file: UploadFile,
    user_id: int,
) -> ManualVideoInboxItemOut:
    await ensure_resource_quota(db, user_id, MANUAL_VIDEO_ITEMS)
    metadata = await store_uploaded_manual_video(file)
    item = ManualVideoInboxItem(
        owner_user_id=user_id,
        source_kind="file",
        original_url=str(metadata["original_url"]),
        normalized_url=str(metadata["normalized_url"]),
        platform=str(metadata["platform"]),
        author=None,
        title=str(metadata["title"]),
        original_filename=str(metadata["original_filename"]),
        storage_key=str(metadata["storage_key"]),
        mime_type=str(metadata["mime_type"]),
        file_size_bytes=int(metadata["file_size_bytes"]),
        published=None,
        thumbnail=normalize_thumbnail_url(metadata["thumbnail"]),
        duration_seconds=(
            int(metadata["duration_seconds"])
            if metadata.get("duration_seconds") is not None
            else None
        ),
        view_count=None,
        like_count=None,
        favorite_count=None,
        status="pending",
    )
    db.add(item)
    await db.flush()

    card_index = await _build_video_card_index(db, user_id)
    return _serialize_manual_item(item, card_index)


async def get_manual_video_inbox_item_or_404(db: AsyncSession, item_id: int, user_id: int) -> ManualVideoInboxItem:
    result = await db.execute(
        select(ManualVideoInboxItem).where(
            ManualVideoInboxItem.id == item_id,
            ManualVideoInboxItem.owner_user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Manual video inbox item not found")
    return item


def _manual_item_seed_metadata(item: ManualVideoInboxItem) -> dict:
    return {
        "original_url": item.original_url,
        "normalized_url": item.normalized_url,
        "platform": item.platform,
        "author": item.author,
        "title": item.title,
        "published": item.published,
        "thumbnail": normalize_thumbnail_url(item.thumbnail),
        "duration_seconds": item.duration_seconds,
        "view_count": item.view_count,
        "like_count": item.like_count,
        "favorite_count": item.favorite_count,
        "source_kind": item.source_kind or "url",
        "manual_video_inbox_item_id": item.id,
    }


async def analyze_manual_video_inbox_item(db: AsyncSession, item_id: int, user_id: int, *, force: bool = False) -> dict:
    item = await get_manual_video_inbox_item_or_404(db, item_id, user_id)
    card_index = await _build_video_card_index(db, user_id)
    existing = card_index.get(item.normalized_url)
    if existing and existing.get("card_id") is not None and not force:
        item.status = "done"
        item.linked_card_id = int(existing["card_id"])
        item.last_analyzed_at = existing.get("last_analyzed_at")
        item.active_job_id = None
        item.error_message = None
        await db.flush()
        return {"ok": True, "card_id": item.linked_card_id, "url": item.normalized_url, "already_exists": True}

    if item.active_job_id:
        job_status = await job_manager.get_status(item.active_job_id)
        if job_status and job_status.get("status") in {"pending", "running"}:
            return {"ok": True, "job_id": item.active_job_id, "url": item.normalized_url, "status": job_status["status"]}

    await get_configured_video_extractor_or_raise(db, user_id)
    await ensure_resource_quota(db, user_id, ACTIVE_BACKGROUND_JOBS)
    await ensure_resource_quota(db, user_id, VIDEO_CARDS)
    await consume_daily_quota(db, user_id, DAILY_VIDEO_ANALYSES)

    job_id = await dispatch_video_metadata_analysis_job(
        item.normalized_url,
        user_id,
        seed_metadata=_manual_item_seed_metadata(item),
        source_kind=item.source_kind or "url",
    )
    item.active_job_id = job_id
    item.status = "queued"
    item.error_message = None
    await db.flush()

    return {"ok": True, "job_id": job_id, "url": item.normalized_url, "status": "queued"}


async def analyze_manual_video_inbox_items(db: AsyncSession, item_ids: list[int], user_id: int) -> dict:
    selected_ids = [int(item_id) for item_id in dict.fromkeys(item_ids) if item_id]
    if not selected_ids:
        raise HTTPException(status_code=400, detail="请选择要处理的视频。")
    if len(selected_ids) > 10:
        raise HTTPException(status_code=400, detail="一次最多处理 10 个视频，请减少选择后重试。")

    await get_configured_video_extractor_or_raise(db, user_id)

    result = await db.execute(
        select(ManualVideoInboxItem).where(
            ManualVideoInboxItem.owner_user_id == user_id,
            ManualVideoInboxItem.id.in_(selected_ids),
        )
    )
    items_by_id = {item.id: item for item in result.scalars().all()}
    card_index = await _build_video_card_index(db, user_id)
    dispatch_candidates: list[ManualVideoInboxItem] = []
    dispatched: list[dict] = []
    skipped: list[dict] = []

    for item_id in selected_ids:
        item = items_by_id.get(item_id)
        if item is None:
            skipped.append({"item_id": item_id, "reason": "未找到待处理视频。"})
            continue

        existing = card_index.get(item.normalized_url)
        if existing and existing.get("card_id") is not None:
            item.status = "done"
            item.linked_card_id = int(existing["card_id"])
            item.last_analyzed_at = existing.get("last_analyzed_at")
            item.active_job_id = None
            item.error_message = None
            dispatched.append({
                "item_id": item.id,
                "url": item.normalized_url,
                "card_id": item.linked_card_id,
                "already_exists": True,
            })
            continue

        if item.active_job_id:
            job_status = await job_manager.get_status(item.active_job_id)
            if job_status and job_status.get("status") in {"pending", "running"}:
                dispatched.append({
                    "item_id": item.id,
                    "url": item.normalized_url,
                    "job_id": item.active_job_id,
                    "status": job_status["status"],
                })
                continue

        dispatch_candidates.append(item)

    if dispatch_candidates:
        jobs_remaining = await get_resource_remaining(db, user_id, ACTIVE_BACKGROUND_JOBS)
        if jobs_remaining is not None and jobs_remaining < len(dispatch_candidates):
            excess = dispatch_candidates[jobs_remaining:]
            dispatch_candidates = dispatch_candidates[:jobs_remaining]
            for excess_item in excess:
                skipped.append({"item_id": excess_item.id, "url": excess_item.normalized_url, "reason": "进行中的后台任务已达上限，已跳过该视频。"})

    await ensure_resource_quota(db, user_id, VIDEO_CARDS, increment=len(dispatch_candidates))
    await consume_daily_quota(db, user_id, DAILY_VIDEO_ANALYSES, amount=len(dispatch_candidates))

    for item in dispatch_candidates:
        job_id = await dispatch_video_metadata_analysis_job(
            item.normalized_url,
            user_id,
            seed_metadata=_manual_item_seed_metadata(item),
            source_kind=item.source_kind or "url",
        )
        item.active_job_id = job_id
        item.status = "queued"
        item.error_message = None
        dispatched.append({"item_id": item.id, "url": item.normalized_url, "job_id": job_id, "status": "queued"})

    await db.flush()
    return {"ok": True, "dispatched": dispatched, "skipped": skipped}


async def delete_manual_video_inbox_items(
    db: AsyncSession,
    data: ManualVideoInboxDeleteRequest,
    user_id: int,
) -> dict:
    item_ids = sorted({int(item_id) for item_id in data.item_ids if item_id})
    if not item_ids:
        return {"ok": True, "removed": 0}

    result = await db.execute(
        select(ManualVideoInboxItem).where(
            ManualVideoInboxItem.owner_user_id == user_id,
            ManualVideoInboxItem.id.in_(item_ids),
        )
    )
    items = result.scalars().all()

    cleanup_keys: set[str] = set()
    for item in items:
        if item.storage_key:
            cleanup_keys.add(item.storage_key)
        thumbnail_key = _extract_storage_key_from_public_url(item.thumbnail)
        if thumbnail_key:
            cleanup_keys.add(thumbnail_key)
        await db.delete(item)

    await db.commit()

    for storage_key in cleanup_keys:
        try:
            await asyncio.to_thread(_delete_storage_object, storage_key)
        except Exception as exc:
            logger.warning("Manual inbox storage cleanup failed for %s: %s", storage_key, exc)

    return {"ok": True, "removed": len(items)}


async def get_manual_video_job_status_payload(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(
        select(ManualVideoInboxItem).where(
            ManualVideoInboxItem.owner_user_id == user_id,
            ManualVideoInboxItem.active_job_id.is_not(None),
        )
    )
    items = result.scalars().all()
    card_index = await _build_video_card_index(db, user_id)
    statuses: dict[str, str] = {}
    errors: dict[str, str] = {}

    for item in items:
        if not item.active_job_id:
            continue

        job_status = await job_manager.get_status(item.active_job_id)
        if not job_status:
            statuses[item.normalized_url] = "completed" if item.normalized_url in card_index else "failed"
            item.active_job_id = None
            if item.normalized_url in card_index:
                item.status = "done"
                item.error_message = None
            else:
                item.status = "error"
                item.error_message = MISSING_ANALYSIS_JOB_ERROR
                errors[item.normalized_url] = item.error_message
            continue

        statuses[item.normalized_url] = job_status["status"]

        if job_status["status"] == "completed":
            card_meta = card_index.get(item.normalized_url)
            item.active_job_id = None
            item.status = "done"
            item.error_message = None
            if card_meta and card_meta.get("card_id") is not None:
                item.linked_card_id = int(card_meta["card_id"])
            if card_meta and card_meta.get("last_analyzed_at") is not None:
                item.last_analyzed_at = card_meta["last_analyzed_at"]
        elif job_status["status"] == "failed":
            item.active_job_id = None
            item.status = "error"
            item.error_message = job_status.get("error", "")
            if item.error_message:
                errors[item.normalized_url] = item.error_message

    await db.flush()
    return {"statuses": statuses, "errors": errors}
