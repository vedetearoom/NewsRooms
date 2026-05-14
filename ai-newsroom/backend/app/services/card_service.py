from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IntelligenceCard, ManualVideoInboxItem, MonitorTarget
from app.repositories.card_repository import CardRepository
from app.schemas import CardOut
from app.services.video.thumbnail_utils import choose_better_thumbnail
from app.services.video.url_utils import get_video_source_identity


async def _hydrate_video_card_thumbnails(
    db: AsyncSession,
    user_id: int,
    cards: list[IntelligenceCard] | tuple[IntelligenceCard, ...],
) -> None:
    if not cards:
        return

    monitor_result = await db.execute(
        select(MonitorTarget.cached_videos).where(MonitorTarget.owner_user_id == user_id)
    )
    thumbnail_index: dict[str, str] = {}
    for (cached_videos,) in monitor_result.all():
        for video in cached_videos or []:
            url = str(video.get("url", "")).strip()
            thumbnail = str(video.get("thumbnail", "")).strip()
            if not url or not thumbnail:
                continue
            identity = get_video_source_identity(url)
            thumbnail_index[identity] = choose_better_thumbnail(
                thumbnail_index.get(identity, ""),
                thumbnail,
            )

    for card in cards:
        if card.content_type != "video":
            continue
        current_thumbnail = choose_better_thumbnail(
            card.cover_image,
            (card.extra_data or {}).get("thumbnail_url"),
        )
        replacement = current_thumbnail
        for source_url in card.source_urls or []:
            replacement = choose_better_thumbnail(
                replacement,
                thumbnail_index.get(get_video_source_identity(str(source_url))),
            )

        if replacement and replacement != current_thumbnail:
            card.cover_image = replacement
            extra_data = dict(card.extra_data or {})
            extra_data["thumbnail_url"] = replacement
            card.extra_data = extra_data
            flag_modified(card, "extra_data")


async def list_cards(
    db: AsyncSession,
    user_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    archived: bool = False,
) -> list[CardOut]:
    cards = await CardRepository(db, user_id).list_cards(date_from, date_to, category, tag, archived)
    await _hydrate_video_card_thumbnails(db, user_id, cards)
    return cards


async def today_cards(db: AsyncSession, user_id: int) -> list[CardOut]:
    cards = await CardRepository(db, user_id).today_cards()
    await _hydrate_video_card_thumbnails(db, user_id, cards)
    return cards


async def list_card_categories(db: AsyncSession, user_id: int) -> dict:
    return await CardRepository(db, user_id).list_categories()


async def get_card_or_404(db: AsyncSession, user_id: int, card_id: int) -> CardOut:
    card = await CardRepository(db, user_id).get_by_id(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    await _hydrate_video_card_thumbnails(db, user_id, [card])
    return card


async def mark_card_read(db: AsyncSession, user_id: int, card_id: int) -> dict:
    success = await CardRepository(db, user_id).toggle_read(card_id, read_status=True)
    return {"ok": success}


async def toggle_card_archive(db: AsyncSession, user_id: int, card_id: int) -> dict:
    repo = CardRepository(db, user_id)
    card = await repo.get_by_id(card_id)
    if card:
        await repo.toggle_archive(card_id, archive_status=not card.is_archived)
    return {"ok": True}


async def _clear_video_card_references(db: AsyncSession, user_id: int, card: IntelligenceCard) -> None:
    if card.content_type != "video":
        return

    source_keys = {
        key
        for source_url in (card.source_urls or [])
        for key in {str(source_url).strip(), get_video_source_identity(str(source_url))}
        if key
    }
    if not source_keys:
        return

    monitor_result = await db.execute(
        select(MonitorTarget).where(MonitorTarget.owner_user_id == user_id)
    )
    for target in monitor_result.scalars().all():
        changed = False
        cached_videos = target.cached_videos or []
        for video in cached_videos:
            video_url = str(video.get("url", "")).strip()
            if video.get("analyzed_card_id") == card.id or video_url in source_keys or get_video_source_identity(video_url) in source_keys:
                video["already_analyzed"] = False
                video["analyzed_card_id"] = None
                video["last_analyzed_at"] = None
                changed = True
        if changed:
            target.cached_videos = list(cached_videos)
            flag_modified(target, "cached_videos")

    manual_result = await db.execute(
        select(ManualVideoInboxItem).where(
            ManualVideoInboxItem.owner_user_id == user_id,
            ManualVideoInboxItem.linked_card_id == card.id,
        )
    )
    for item in manual_result.scalars().all():
        item.linked_card_id = None
        item.last_analyzed_at = None
        if item.status == "done":
            item.status = "pending"


async def list_pinned_cards(
    db: AsyncSession,
    user_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
) -> list[CardOut]:
    cards = await CardRepository(db, user_id).list_pinned_cards(date_from, date_to, category, tag)
    owners_seen: set[int] = set()
    for card in cards:
        if card.content_type == "video" and card.owner_user_id and card.owner_user_id not in owners_seen:
            await _hydrate_video_card_thumbnails(db, card.owner_user_id, [card])
            owners_seen.add(card.owner_user_id)
    return cards


async def toggle_pin_card(db: AsyncSession, user_id: int, card_id: int) -> dict:
    repo = CardRepository(db, user_id)
    card = await repo.toggle_pin(card_id, user_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return {
        "ok": True,
        "is_pinned": card.is_pinned,
        "pinned_by": card.pinned_by,
        "pinned_at": str(card.pinned_at) if card.pinned_at else None,
    }


async def delete_card(db: AsyncSession, user_id: int, card_id: int) -> dict:
    repo = CardRepository(db, user_id)
    card = await repo.get_by_id(card_id)
    if not card:
        return {"ok": False, "detail": "not found"}

    await _clear_video_card_references(db, user_id, card)
    success = await repo.delete(card_id)
    if success:
        return {"ok": True}
    return {"ok": False, "detail": "not found"}
