"""Jina Reader API integration for clean web content extraction.

Uses r.jina.ai to convert any web URL to clean Markdown text,
bypassing ad blockers, paywalls (where possible), and JS rendering.
Falls back to direct HTTP + BeautifulSoup if no Jina API key is configured.
"""
import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)


class JinaReader:
    """Fetches clean Markdown content from any URL via Jina Reader API."""

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.jina_api_key
        self.enabled = bool(self.api_key)
        self.client = httpx.AsyncClient(
            timeout=60,
            follow_redirects=True,
        )

    async def extract(self, url: str) -> dict:
        """
        Extract clean content from a URL.
        
        Returns:
            {
                "title": str,
                "content": str (Markdown),
                "description": str,
                "url": str,
            }
        """
        if not self.enabled:
            logger.debug("Jina Reader not configured, falling back to basic extraction")
            return await self._fallback_extract(url)

        try:
            resp = await self.client.get(
                f"https://r.jina.ai/{url}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json",
                    "X-Return-Format": "markdown",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            result = data.get("data", {})
            return {
                "title": result.get("title", ""),
                "content": result.get("content", ""),
                "description": result.get("description", ""),
                "url": result.get("url", url),
            }

        except Exception as e:
            logger.warning(f"Jina Reader failed for {url}: {e}, falling back to basic extraction")
            return await self._fallback_extract(url)

    async def _fallback_extract(self, url: str) -> dict:
        """Basic HTML extraction when Jina is not available."""
        from bs4 import BeautifulSoup

        try:
            resp = await self.client.get(
                url,
                headers={"User-Agent": "AI-Newsroom/1.0"},
            )
            soup = BeautifulSoup(resp.text, "lxml")

            # Remove non-content elements
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
                tag.decompose()

            title = soup.title.string if soup.title else ""
            content = soup.get_text(separator="\n", strip=True)

            return {
                "title": title or "",
                "content": content[:15000],
                "description": "",
                "url": url,
            }
        except Exception as e:
            logger.error(f"Fallback extraction failed for {url}: {e}")
            return {"title": "", "content": "", "description": "", "url": url}

    async def close(self):
        await self.client.aclose()
