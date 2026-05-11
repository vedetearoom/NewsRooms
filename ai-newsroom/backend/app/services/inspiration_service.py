from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InspirationAsset
from app.services.quota_service import INSPIRATIONS, ensure_resource_quota


async def list_inspirations(db: AsyncSession, user_id: int) -> list[InspirationAsset]:
    result = await db.execute(
        select(InspirationAsset)
        .where(InspirationAsset.owner_user_id == user_id)
        .order_by(InspirationAsset.created_at.desc())
    )
    return list(result.scalars().all())


async def create_inspiration_asset(
    db: AsyncSession,
    *,
    title: str,
    hook_text: str | None = None,
    hook_technique: str | None = None,
    template_skeleton: str | None = None,
    source_url: str | None = None,
    platform: str | None = None,
    author: str | None = None,
    tags: list[str] | None = None,
    audio_url: str | None = None,
    extra_data: dict | None = None,
    owner_user_id: int,
) -> InspirationAsset:
    existing_asset = await _find_duplicate_inspiration(
        db,
        title=title,
        source_url=source_url,
        platform=platform,
        owner_user_id=owner_user_id,
    )
    if existing_asset:
        return existing_asset

    await ensure_resource_quota(db, owner_user_id, INSPIRATIONS)
    new_asset = InspirationAsset(
        owner_user_id=owner_user_id,
        title=title,
        hook_text=hook_text,
        hook_technique=hook_technique,
        template_skeleton=template_skeleton,
        source_url=source_url,
        platform=platform,
        author=author,
        tags=tags,
        audio_url=audio_url,
        extra_data=extra_data,
    )
    db.add(new_asset)
    await db.commit()
    await db.refresh(new_asset)
    return new_asset


async def delete_inspiration_asset(db: AsyncSession, asset_id: int, user_id: int) -> dict[str, bool]:
    result = await db.execute(
        select(InspirationAsset).where(
            InspirationAsset.id == asset_id,
            InspirationAsset.owner_user_id == user_id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Inspiration asset not found")

    await db.delete(asset)
    await db.commit()
    return {"ok": True}


async def _find_duplicate_inspiration(
    db: AsyncSession,
    *,
    title: str,
    source_url: str | None,
    platform: str | None,
    owner_user_id: int,
) -> InspirationAsset | None:
    if platform == "article" and title:
        existing = await db.execute(
            select(InspirationAsset).where(
                InspirationAsset.title == title,
                InspirationAsset.platform == platform,
                InspirationAsset.owner_user_id == owner_user_id,
            )
        )
        asset = existing.scalars().first()
        if asset:
            return asset

    if source_url:
        existing = await db.execute(
            select(InspirationAsset).where(
                InspirationAsset.source_url == source_url,
                InspirationAsset.owner_user_id == owner_user_id,
            )
        )
        asset = existing.scalars().first()
        if asset:
            return asset

    if title:
        existing = await db.execute(
            select(InspirationAsset).where(
                InspirationAsset.title == title,
                InspirationAsset.platform == platform,
                InspirationAsset.owner_user_id == owner_user_id,
            )
        )
        asset = existing.scalars().first()
        if asset:
            return asset

    return None
