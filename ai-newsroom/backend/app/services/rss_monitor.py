"""RSS Monitor service — fetches video lists from RSSHub feeds."""

import logging
import re
import asyncio
import feedparser
import httpx
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# ── Supported platforms and their RSSHub route templates ──

PLATFORM_INFO = {
    "bilibili": {
        "label": "B站",
        "rss_template": "{base}/bilibili/user/video/{id}",
        "cookie_env": None,
    },
    "youtube": {
        "label": "YouTube",
        "rss_template": "{base}/youtube/channel/{id}",
        "cookie_env": None,  # YouTube doesn't need cookies
    },
    "xiaohongshu": {
        "label": "小红书",
        "rss_template": "{base}/xiaohongshu/user/{id}/notes",
        "cookie_env": None,
    },
}


def parse_homepage_url(url: str) -> tuple[str, str]:
    """Parse a blogger homepage URL into (platform, platform_id).

    Supported formats:
    - Bilibili:     https://space.bilibili.com/346563438
    - YouTube:      https://www.youtube.com/@username  or  /channel/UCxxxx
    - Xiaohongshu:  https://www.xiaohongshu.com/user/profile/593032945e87e77791e03696
    """
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    path = parsed.path.strip("/")

    if "bilibili" in host:
        uid = path.split("/")[0] if path else ""
        if uid.isdigit():
            return ("bilibili", uid)
        raise ValueError(f"无法从 B站 URL 解析 UID: {url}")

    elif "youtube" in host:
        if path.startswith("@"):
            return ("youtube", path)
        elif path.startswith("channel/"):
            parts = path.split("/")
            if len(parts) >= 2:
                return ("youtube", parts[1])
        raise ValueError(f"无法从 YouTube URL 解析频道: {url}")

    elif "xiaohongshu" in host:
        # https://www.xiaohongshu.com/user/profile/xxxx
        if "profile/" in path:
            parts = path.split("profile/")
            if len(parts) >= 2:
                user_id = parts[1].split("/")[0].split("?")[0]
                if user_id:
                    return ("xiaohongshu", user_id)
        raise ValueError(f"无法从小红书 URL 解析用户 ID: {url}")

    raise ValueError(f"不支持的平台: {url}。目前支持 B站、YouTube、小红书。")


def build_rss_url(platform: str, platform_id: str, rsshub_base: str) -> str:
    """Generate RSSHub URL from platform and ID."""
    info = PLATFORM_INFO.get(platform)
    if not info:
        raise ValueError(f"Unsupported platform: {platform}")
    return info["rss_template"].format(base=rsshub_base, id=platform_id)


def _extract_bvid(url: str) -> str | None:
    """Extract BV ID from a Bilibili video URL."""
    match = re.search(r"(BV[a-zA-Z0-9]+)", url)
    return match.group(1) if match else None


class RSSMonitor:
    """Fetches and parses video feeds from RSSHub."""

    async def fetch_videos(self, rss_url: str, **kwargs) -> list[dict]:
        """Fetch RSS feed and parse into video entries.

        Returns: [{"title": "...", "url": "...", "published": "...", "thumbnail": "...", ...}, ...]
        """
        logger.info(f"[RSSMonitor] Fetching feed: {rss_url}")

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(rss_url)
            resp.raise_for_status()

        feed = feedparser.parse(resp.text)

        videos = []
        for entry in feed.entries:
            video_url = entry.get("link", "")
            if not video_url:
                continue

            videos.append({
                "title": entry.get("title", "Untitled"),
                "url": video_url,
                "published": entry.get("published", ""),
                "thumbnail": self._extract_thumbnail(entry),
            })

        logger.info(f"[RSSMonitor] Found {len(videos)} videos from feed")

        # Enrich with platform-specific stats
        if videos and any("bilibili.com" in v["url"] for v in videos):
            await self._enrich_bilibili_stats(videos)

        return videos

    async def _enrich_bilibili_stats(self, videos: list[dict]) -> None:
        """Fetch view/like/favorite/duration from Bilibili API for each video."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com",
        }
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            for video in videos:
                bvid = _extract_bvid(video["url"])
                if not bvid:
                    continue
                try:
                    resp = await client.get(
                        f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
                    )
                    data = resp.json()
                    if data.get("code") == 0 and data.get("data"):
                        info = data["data"]
                        stat = info.get("stat", {})
                        video["view_count"] = stat.get("view", 0)
                        video["like_count"] = stat.get("like", 0)
                        video["favorite_count"] = stat.get("favorite", 0)
                        video["duration_seconds"] = info.get("duration", 0)
                except Exception as e:
                    logger.warning(f"[RSSMonitor] Failed to fetch stats for {bvid}: {e}")
                # Small delay between requests to avoid rate-limiting
                await asyncio.sleep(0.15)

    @staticmethod
    def _extract_thumbnail(entry) -> str:
        """Extract thumbnail URL from RSS entry."""
        # Try media:thumbnail (common in RSS 2.0 media extensions)
        if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
            return entry.media_thumbnail[0].get("url", "")

        # Try media:content with image type
        if hasattr(entry, "media_content"):
            for mc in entry.media_content:
                if mc.get("type", "").startswith("image") or mc.get("medium") == "image":
                    return mc.get("url", "")

        # Try enclosure
        for enc in entry.get("enclosures", []):
            if enc.get("type", "").startswith("image"):
                return enc.get("href", "")

        # Try to extract from description/summary HTML (common in RSSHub feeds)
        summary = entry.get("summary", "")
        if "<img" in summary:
            match = re.search(r'<img[^>]+src=["\']([^"\']+)', summary)
            if match:
                return match.group(1)

        return ""
