import feedparser
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Source, RawArticle
import logging

logger = logging.getLogger(__name__)


from curl_cffi.requests import AsyncSession as CurlSession

class Scraper:
    """Fetches content from RSS feeds and web URLs."""

    def __init__(self):
        self.client = CurlSession(
            timeout=30,
            impersonate="chrome120",
        )

    async def scrape_all(self, db: AsyncSession, owner_user_id: int):
        result = await db.execute(
            select(Source).where(Source.is_active == True, Source.owner_user_id == owner_user_id)
        )
        sources = result.scalars().all()
        total = 0
        for source in sources:
            try:
                count = await self._scrape_source(source, db, owner_user_id)
                total += count
                source.last_fetched_at = datetime.now(timezone.utc)
                logger.info(f"Scraped {count} articles from {source.name}")
            except Exception as e:
                logger.error(f"Error scraping {source.name}: {e}")
        await db.commit()
        return total

    async def _scrape_source(self, source: Source, db: AsyncSession, owner_user_id: int | None = None) -> int:
        effective_owner_id = owner_user_id if owner_user_id is not None else source.owner_user_id
        if source.source_type == "rss":
            return await self._scrape_rss(source, db, effective_owner_id)
        elif source.source_type == "web":
            return await self._scrape_web(source, db, effective_owner_id)
        return 0

    async def _scrape_rss(self, source: Source, db: AsyncSession, owner_user_id: int | None) -> int:
        resp = await self.client.get(source.url)
        feed = feedparser.parse(resp.text)
        count = 0
        for entry in feed.entries[:20]:
            url = entry.get("link", "")
            # Check for duplicates
            existing = await db.execute(
                select(RawArticle)
                .where(RawArticle.url == url, RawArticle.owner_user_id == owner_user_id)
                .limit(1)
            )
            if existing.scalar_one_or_none():
                continue

            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)

            content = ""
            if hasattr(entry, "content") and entry.content:
                content = entry.content[0].get("value", "")
            elif hasattr(entry, "summary"):
                content = entry.summary or ""

            # Strip HTML
            if content:
                soup = BeautifulSoup(content, "lxml")
                content = soup.get_text(separator="\n", strip=True)

            article = RawArticle(
                owner_user_id=owner_user_id,
                source_id=source.id,
                title=entry.get("title", ""),
                content=content,
                url=url,
                author=entry.get("author"),
                published_at=published,
            )
            db.add(article)
            count += 1

        return count

    async def _scrape_web(self, source: Source, db: AsyncSession, owner_user_id: int | None) -> int:
        """Scrape a web URL using Jina Reader for clean content extraction."""
        from app.services.jina_reader import JinaReader

        reader = JinaReader()
        try:
            result = await reader.extract(source.url)
        finally:
            await reader.close()

        title = result.get("title") or source.name
        content = result.get("content") or ""

        if not content:
            return 0

        # If source has an extractor_prompt, use AI to filter/transform content
        if source.extractor_prompt and content:
            content = await self._apply_extractor(db, owner_user_id, content, source.extractor_prompt)

        existing_result = await db.execute(
            select(RawArticle)
            .where(RawArticle.url == source.url, RawArticle.owner_user_id == owner_user_id)
            .limit(1)
        )
        existing = existing_result.scalar_one_or_none()
        
        if existing:
            # Update existing article with fresh content and reset for re-processing
            if existing.content != content[:15000]:
                existing.content = content[:15000]
                existing.title = title[:500]
                existing.is_processed = False
                existing.fetched_at = datetime.now(timezone.utc)
                logger.info(f"Updated and re-queued web article from {source.name}")
                return 1
            else:
                logger.info(f"No content change detected for {source.name}, skipping")
                return 0
        else:
            article = RawArticle(
                owner_user_id=owner_user_id,
                source_id=source.id,
                title=title[:500],
                content=content[:15000],
                url=source.url,
            )
            db.add(article)
            return 1

    async def _apply_extractor(
        self,
        db: AsyncSession,
        owner_user_id: int | None,
        content: str,
        prompt: str,
    ) -> str:
        """Use AI to extract specific information from content based on the source's extractor prompt."""
        try:
            from google import genai
            from google.genai import types
            from app.services.agent_dispatcher import AgentDispatcher

            extractor = await AgentDispatcher.get_agent(
                db,
                role="extractor",
                owner_user_id=owner_user_id,
            )
            if not extractor or not extractor.api_key:
                logger.warning("No active extractor agent with API key found for scraping")
                return content
            api_key = extractor.api_key
            model_ref = extractor.model_ref or "gemini-2.5-flash"

            client = genai.Client(api_key=api_key)
            response = await client.aio.models.generate_content(
                model=model_ref,
                contents=f"{prompt}\n\n---\n\nContent to extract from:\n\n{content[:10000]}",
                config=types.GenerateContentConfig(
                    max_output_tokens=4096,
                    temperature=0.2,
                ),
            )
            extracted = response.text.strip()
            if extracted:
                return extracted
        except Exception as e:
            logger.warning(f"Extractor prompt failed: {e}, using raw content")
        return content

    async def close(self):
        try:
            await self.client.close()
        except Exception:
            pass
