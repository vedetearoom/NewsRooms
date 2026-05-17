"""API endpoints for raw articles (feed pipeline visibility)."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth_service import require_permission, serialize_user
from app.services.quota_service import ACTIVE_BACKGROUND_JOBS, ARTICLE_CARDS, DAILY_ARTICLE_PROCESSES, consume_daily_quota, ensure_resource_quota
from app.services.raw_article_service import (
    delete_raw_article as delete_raw_article_service,
    has_unprocessed_articles,
    list_raw_articles as list_raw_articles_service,
    process_selected_articles,
    raw_article_stats as raw_article_stats_service,
)

router = APIRouter(prefix="/api/raw-articles", tags=["raw-articles"])


@router.get("")
async def list_raw_articles(
    processed: Optional[bool] = None,
    source_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """List raw articles with optional filtering."""
    return await list_raw_articles_service(db, current_user.id, processed, source_id, limit, offset)


@router.get("/stats")
async def raw_article_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Get aggregated stats about the feed pipeline."""
    return await raw_article_stats_service(db, current_user.id)


@router.post("/process-selected")
async def process_selected(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Process selected raw articles through the AI pipeline (background job)."""
    article_ids = data.get("article_ids", [])
    user_out = await serialize_user(db, current_user)
    is_super_admin = any(role.code == "super_admin" for role in user_out.roles)
    pin_created = bool(data.get("pin_created", False)) if is_super_admin else False
    if not article_ids:
        return await process_selected_articles(article_ids, current_user.id, pin_created=pin_created)
    if not await has_unprocessed_articles(db, current_user.id, article_ids):
        raise HTTPException(status_code=400, detail="没有可处理的未处理文章。")
    await ensure_resource_quota(db, current_user.id, ACTIVE_BACKGROUND_JOBS)
    await ensure_resource_quota(db, current_user.id, ARTICLE_CARDS)
    await consume_daily_quota(db, current_user.id, DAILY_ARTICLE_PROCESSES)
    return await process_selected_articles(article_ids, current_user.id, pin_created=pin_created)


@router.delete("/{article_id}")
async def delete_raw_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    """Delete a single raw article."""
    return await delete_raw_article_service(db, current_user.id, article_id)
