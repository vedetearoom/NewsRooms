from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RawArticle, Source
from app.schemas import SourceCreate, SourceOut
from app.services.job_dispatcher import dispatch_manual_scrape_job
from app.services.quota_service import DAILY_SCRAPES, TEXT_SOURCES, consume_daily_quota, ensure_resource_quota


async def list_sources(db: AsyncSession, user_id: int) -> list[SourceOut]:
    result = await db.execute(
        select(Source)
        .where(Source.owner_user_id == user_id)
        .order_by(Source.created_at.desc())
    )
    return result.scalars().all()


async def get_source_or_404(db: AsyncSession, user_id: int, source_id: int) -> Source:
    result = await db.execute(
        select(Source).where(Source.id == source_id, Source.owner_user_id == user_id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


async def create_source(db: AsyncSession, user_id: int, data: SourceCreate) -> SourceOut:
    await ensure_resource_quota(db, user_id, TEXT_SOURCES)
    source = Source(owner_user_id=user_id, **data.model_dump())
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def update_source(db: AsyncSession, user_id: int, source_id: int, data: SourceCreate) -> SourceOut:
    source = await get_source_or_404(db, user_id, source_id)
    source.name = data.name
    source.url = data.url
    source.source_type = data.source_type
    if hasattr(data, "processor_agent_id"):
        source.processor_agent_id = data.processor_agent_id
    if hasattr(data, "extractor_prompt"):
        source.extractor_prompt = data.extractor_prompt

    await db.commit()
    await db.refresh(source)
    return source


async def delete_source(db: AsyncSession, user_id: int, source_id: int) -> dict:
    source = await get_source_or_404(db, user_id, source_id)
    await db.execute(
        delete(RawArticle).where(
            RawArticle.source_id == source_id,
            RawArticle.owner_user_id == user_id,
        )
    )

    try:
        await db.delete(source)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this source because it is referenced elsewhere.",
        )

    return {"ok": True}


async def toggle_source(db: AsyncSession, user_id: int, source_id: int) -> dict:
    source = await get_source_or_404(db, user_id, source_id)
    source.is_active = not source.is_active
    await db.flush()
    return {"ok": True, "is_active": source.is_active}


async def trigger_source_scrape(db: AsyncSession, user_id: int, source_id: int) -> dict:
    await get_source_or_404(db, user_id, source_id)
    await consume_daily_quota(db, user_id, DAILY_SCRAPES)
    job_id = await dispatch_manual_scrape_job(source_id, user_id)
    return {"ok": True, "job_id": job_id}
