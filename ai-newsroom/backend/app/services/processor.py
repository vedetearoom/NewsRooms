import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RawArticle, IntelligenceCard
from app.services.agent_dispatcher import AgentDispatcher
from app.services.processor_support import (
    build_articles_text,
    build_processor_prompt,
    build_url_to_article_ids,
    enforce_cards_output_language,
    generate_cards_response,
    parse_cards_response,
)
from app.services.quota_service import ARTICLE_CARDS, ensure_resource_quota, get_resource_remaining

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessResult:
    count: int
    card_ids: list[int]


class Processor:
    """Uses Gemini to deduplicate, summarize, and create intelligence cards from raw articles."""

    def __init__(self):
        pass

    async def process_unprocessed(self, db: AsyncSession, owner_user_id: int, pin_created: bool = False) -> ProcessResult:
        result = await db.execute(
            select(RawArticle)
            .where(RawArticle.is_processed == False)
            .where(RawArticle.owner_user_id == owner_user_id)
            .order_by(RawArticle.fetched_at.desc())
            .limit(50)
        )
        articles = result.scalars().all()

        if not articles:
            logger.info("No unprocessed articles found")
            return ProcessResult(count=0, card_ids=[])

        return await self.process_articles(db, articles, owner_user_id, pin_created=pin_created)

    async def process_articles(
        self,
        db: AsyncSession,
        articles: list,
        owner_user_id: int,
        pin_created: bool = False,
    ) -> ProcessResult:
        """Process a given list of RawArticle objects through the AI pipeline."""
        if not articles:
            return ProcessResult(count=0, card_ids=[])

        remaining_before = await get_resource_remaining(db, owner_user_id, ARTICLE_CARDS)
        if remaining_before == 0:
            logger.info("Article card quota is full for user %s; skipping processing", owner_user_id)
            return ProcessResult(count=0, card_ids=[])

        articles_text = build_articles_text(articles)
        extractor = await AgentDispatcher.get_agent(db, role="extractor", owner_user_id=owner_user_id)
        target_model = extractor.model_ref if extractor and extractor.model_ref else "gemini-2.5-flash"
        system_prompt = build_processor_prompt(extractor)

        try:
            text = await generate_cards_response(
                extractor=extractor,
                target_model=target_model,
                system_prompt=system_prompt,
                articles_text=articles_text,
            )
            cards_data = parse_cards_response(text)
            if cards_data is None:
                raise ValueError("提取智能体返回的卡片 JSON 无法解析，请检查模型输出或提示词配置。")
            cards_data = await enforce_cards_output_language(
                extractor=extractor,
                target_model=target_model,
                cards_data=cards_data,
            )

            remaining_after = await get_resource_remaining(db, owner_user_id, ARTICLE_CARDS)
            if remaining_after == 0:
                logger.info("Article card quota became full for user %s; skipping card persistence", owner_user_id)
                return ProcessResult(count=0, card_ids=[])
            if remaining_after is not None and len(cards_data) > remaining_after:
                skipped = len(cards_data) - remaining_after
                logger.info(
                    "Article card quota allows %s more cards for user %s; skipping %s generated cards",
                    remaining_after,
                    owner_user_id,
                    skipped,
                )
                cards_data = cards_data[:remaining_after]
            if not cards_data:
                return ProcessResult(count=0, card_ids=[])

            await ensure_resource_quota(db, owner_user_id, ARTICLE_CARDS, increment=len(cards_data))

            url_to_ids = build_url_to_article_ids(articles)

            cards: list[IntelligenceCard] = []
            for card_data in cards_data:
                card_source_urls = card_data.get("source_urls", [])
                linked_ids: list[int] = []
                for url in card_source_urls:
                    linked_ids.extend(url_to_ids.get(url, []))
                if not linked_ids:
                    linked_ids = [article.id for article in articles]

                card = IntelligenceCard(
                    owner_user_id=owner_user_id,
                    title=card_data.get("title", "Untitled"),
                    summary=card_data.get("summary", ""),
                    key_points=card_data.get("key_points", []),
                    source_urls=card_source_urls,
                    raw_article_ids=linked_ids,
                    tags=card_data.get("tags", []),
                    category=card_data.get("category", "Other"),
                    importance_score=card_data.get("importance_score", 0.5),
                    published_date=date.today(),
                    is_pinned=pin_created,
                    pinned_by=owner_user_id if pin_created else None,
                    pinned_at=datetime.now(timezone.utc) if pin_created else None,
                )
                db.add(card)
                cards.append(card)

            for article in articles:
                article.is_processed = True

            await db.flush()
            card_ids = [card.id for card in cards]
            await db.commit()
            logger.info("Created %s intelligence cards from %s articles", len(cards_data), len(articles))
            return ProcessResult(count=len(cards_data), card_ids=card_ids)

        except Exception as e:
            logger.exception("Processing error")
            raise RuntimeError(str(e) or "文章处理失败，请检查提取智能体配置。") from e
