from typing import Optional

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RawArticle, Source
from app.services.job_dispatcher import dispatch_process_selected_job


async def list_raw_articles(
    db: AsyncSession,
    user_id: int,
    processed: Optional[bool] = None,
    source_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    query = (
        select(RawArticle)
        .where(RawArticle.owner_user_id == user_id)
        .order_by(RawArticle.fetched_at.desc())
    )

    if processed is not None:
        query = query.where(RawArticle.is_processed == processed)
    if source_id is not None:
        query = query.where(RawArticle.source_id == source_id)

    result = await db.execute(query.limit(limit).offset(offset))
    articles = result.scalars().all()

    source_ids = list({article.source_id for article in articles if article.source_id})
    source_map: dict[int, str] = {}
    if source_ids:
        source_result = await db.execute(
            select(Source).where(
                Source.id.in_(source_ids),
                Source.owner_user_id == user_id,
            )
        )
        source_map = {source.id: source.name for source in source_result.scalars().all()}

    return [
        {
            "id": article.id,
            "title": article.title,
            "url": article.url,
            "source_id": article.source_id,
            "source_name": source_map.get(article.source_id, "Unknown"),
            "author": article.author,
            "is_processed": article.is_processed,
            "fetched_at": article.fetched_at.isoformat() if article.fetched_at else None,
            "published_at": article.published_at.isoformat() if article.published_at else None,
            "content_preview": (article.content or "")[:200],
        }
        for article in articles
    ]


async def raw_article_stats(db: AsyncSession, user_id: int) -> dict:
    total_result = await db.execute(
        select(func.count(RawArticle.id)).where(RawArticle.owner_user_id == user_id)
    )
    total = total_result.scalar() or 0

    processed_result = await db.execute(
        select(func.count(RawArticle.id)).where(
            RawArticle.owner_user_id == user_id,
            RawArticle.is_processed == True,
        )
    )
    processed = processed_result.scalar() or 0
    unprocessed = total - processed

    source_stats_query = (
        select(
            Source.id,
            Source.name,
            Source.source_type,
            Source.url,
            Source.last_fetched_at,
            func.count(RawArticle.id).label("article_count"),
            func.sum(case((RawArticle.is_processed == False, 1), else_=0)).label("pending_count"),
        )
        .outerjoin(RawArticle, RawArticle.source_id == Source.id)
        .where(Source.owner_user_id == user_id, Source.is_active == True)
        .group_by(Source.id)
    )
    source_result = await db.execute(source_stats_query)
    source_stats = [
        {
            "id": row.id,
            "name": row.name,
            "source_type": row.source_type,
            "url": row.url,
            "last_fetched_at": row.last_fetched_at.isoformat() if row.last_fetched_at else None,
            "article_count": row.article_count or 0,
            "pending_count": row.pending_count or 0,
        }
        for row in source_result.all()
    ]

    return {
        "total_articles": total,
        "processed": processed,
        "unprocessed": unprocessed,
        "sources": source_stats,
    }


async def has_unprocessed_articles(
    db: AsyncSession,
    user_id: int,
    article_ids: list[int] | None = None,
) -> bool:
    query = select(RawArticle.id).where(
        RawArticle.owner_user_id == user_id,
        RawArticle.is_processed == False,
    )
    if article_ids is not None:
        if not article_ids:
            return False
        query = query.where(RawArticle.id.in_(article_ids))
    result = await db.execute(query.limit(1))
    return result.scalar_one_or_none() is not None


async def process_selected_articles(article_ids: list[int], user_id: int) -> dict:
    if not article_ids:
        return {"ok": False, "error": "No articles selected"}

    job_id = await dispatch_process_selected_job(article_ids, user_id)
    return {"ok": True, "job_id": job_id}


async def delete_raw_article(db: AsyncSession, user_id: int, article_id: int) -> dict:
    result = await db.execute(
        select(RawArticle).where(
            RawArticle.id == article_id,
            RawArticle.owner_user_id == user_id,
        )
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()
    return {"ok": True}
