import asyncio
import hashlib
import logging
import re
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse

import httpx
from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import MonitorTarget
from app.services.credential_service import (
    MONITOR_CREDENTIAL_PLATFORMS,
    get_decrypted_monitor_cookie,
    mark_monitor_credential_validation,
    parse_cookie_pairs,
)
from app.services.rss_monitor import RSSMonitor, build_rss_url
from app.services.video.thumbnail_utils import normalize_thumbnail_url, upgrade_xiaohongshu_thumbnail_url
from app.services.video.url_utils import canonicalize_video_source_url

logger = logging.getLogger(__name__)

RSSHUB_DISCOVERY_PLATFORMS = {"youtube"}
COOKIE_DISCOVERY_PLATFORMS = {"bilibili", "xiaohongshu"}
BROWSER_DISCOVERY_PLATFORMS = {"xiaohongshu"}
DEFAULT_DISCOVERY_MODE_BY_PLATFORM = {
    "bilibili": "cookie",
    "youtube": "rsshub",
    "xiaohongshu": "cookie",
}
SUPPORTED_DISCOVERY_MODES_BY_PLATFORM = {
    "bilibili": ("cookie",),
    "youtube": ("rsshub",),
    "xiaohongshu": ("cookie",),
}
PLATFORM_BASE_URLS = {
    spec["key"]: spec["base_url"] for spec in MONITOR_CREDENTIAL_PLATFORMS
}
WBI_MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]
BILIBILI_COOKIE_REQUIRED_ERROR = "B站 Cookie 模式需要先在 Cookie 配置中填写 B站 Cookie。"
BILIBILI_RSSHUB_FALLBACK_ERROR = "B站 RSSHub 拉取失败，可能触发风控。请先配置 B站 Cookie，并将该监控源切换为 Cookie 方式。"


class MonitorDiscoveryError(RuntimeError):
    pass


class MissingMonitorCredentialError(MonitorDiscoveryError):
    pass


class InvalidMonitorCredentialError(MonitorDiscoveryError):
    pass


def get_supported_discovery_modes(platform: str) -> tuple[str, ...]:
    return SUPPORTED_DISCOVERY_MODES_BY_PLATFORM.get(platform, ("rsshub",))


def get_default_discovery_mode(platform: str) -> str:
    return DEFAULT_DISCOVERY_MODE_BY_PLATFORM.get(platform, "rsshub")


def normalize_monitor_discovery_mode(platform: str, requested_mode: str | None) -> str:
    normalized = str(requested_mode or "").strip().lower()
    allowed = get_supported_discovery_modes(platform)
    if normalized in allowed:
        return normalized
    return get_default_discovery_mode(platform)


def _resolve_browser_invalid_reason(
    platform: str,
    *,
    response_status: int | None = None,
    title: str = "",
    content: str = "",
    videos_found: int = 0,
) -> str | None:
    if platform == "xiaohongshu":
        if videos_found == 0 and "登录后查看发布内容" in content:
            return "小红书页面仅返回登录弹层，Cookie 可能已失效。"
        return None

    return None


def build_monitor_rss_url(platform: str, platform_id: str) -> str | None:
    if platform not in RSSHUB_DISCOVERY_PLATFORMS:
        return None
    settings = get_settings()
    return build_rss_url(platform, platform_id, settings.rsshub_base_url)


@dataclass
class RawMonitorVideo:
    title: str
    url: str
    published: str = ""
    thumbnail: str = ""
    is_sticky: bool = False
    note_type: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    favorite_count: int | None = None
    duration_seconds: int | None = None


class BrowserRuntime:
    def __init__(self) -> None:
        self._playwright = None
        self._launch_lock = asyncio.Lock()
        self._browsers: dict[str, Browser] = {}
        self._semaphores = {
            platform: asyncio.Semaphore(1) for platform in BROWSER_DISCOVERY_PLATFORMS
        }

    async def _get_browser(self, platform: str) -> Browser:
        async with self._launch_lock:
            if self._playwright is None:
                self._playwright = await async_playwright().start()
            browser = self._browsers.get(platform)
            if browser is None or not browser.is_connected():
                browser = await self._playwright.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                    ],
                )
                self._browsers[platform] = browser
            return browser

    @asynccontextmanager
    async def isolated_page(self, platform: str, raw_cookie: str):
        semaphore = self._semaphores[platform]
        async with semaphore:
            browser = await self._get_browser(platform)
            context = await browser.new_context(
                viewport={"width": 1440, "height": 900},
                locale="zh-CN",
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                ),
            )
            try:
                await _inject_cookies(context, platform, raw_cookie)
                page = await context.new_page()
                yield page
            finally:
                await context.close()


browser_runtime = BrowserRuntime()
rss_monitor = RSSMonitor()
COUNT_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")


async def _inject_cookies(context: BrowserContext, platform: str, raw_cookie: str) -> None:
    base_url = PLATFORM_BASE_URLS[platform]
    parsed_url = urlparse(base_url)
    cookies = [
        {
            "name": key,
            "value": value,
            "domain": parsed_url.hostname,
            "path": "/",
            "httpOnly": False,
            "secure": parsed_url.scheme == "https",
            "sameSite": "Lax",
        }
        for key, value in parse_cookie_pairs(raw_cookie)
    ]
    if cookies:
        await context.add_cookies(cookies)


async def discover_monitor_videos(
    db: AsyncSession,
    target: MonitorTarget,
    owner_user_id: int,
) -> list[dict[str, Any]]:
    discovery_mode = normalize_monitor_discovery_mode(
        target.platform,
        getattr(target, "discovery_mode", None),
    )

    if discovery_mode == "rsshub":
        return await _discover_via_rsshub(target)
    if discovery_mode == "cookie":
        return await _discover_via_cookie(db, target, owner_user_id)
    raise MonitorDiscoveryError(f"暂不支持 {target.platform} 平台的 {discovery_mode} 发现方式。")


async def _discover_via_rsshub(target: MonitorTarget) -> list[dict[str, Any]]:
    rss_url = target.rss_url or build_monitor_rss_url(target.platform, target.platform_id)
    if not rss_url:
        raise MonitorDiscoveryError("当前监控源没有可用的 RSSHub 拉取地址。")
    try:
        return await rss_monitor.fetch_videos(rss_url=rss_url)
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        if status_code is None:
            raise MonitorDiscoveryError("RSSHub 拉取失败，请稍后重试。") from exc
        raise MonitorDiscoveryError(f"RSSHub 拉取失败: HTTP {status_code}") from exc
    except Exception as exc:
        raise MonitorDiscoveryError(str(exc)) from exc


async def _discover_via_cookie(
    db: AsyncSession,
    target: MonitorTarget,
    owner_user_id: int,
) -> list[dict[str, Any]]:
    raw_cookie = await get_decrypted_monitor_cookie(db, owner_user_id, target.platform)
    if not raw_cookie:
        if target.platform == "bilibili":
            raise MissingMonitorCredentialError(BILIBILI_COOKIE_REQUIRED_ERROR)
        raise MissingMonitorCredentialError(f"请先为 {target.platform} 配置用户级 Cookie，再执行检查。")

    try:
        if target.platform in BROWSER_DISCOVERY_PLATFORMS:
            async with browser_runtime.isolated_page(target.platform, raw_cookie) as page:
                videos = await _extract_profile_videos(page, target)
        elif target.platform == "bilibili":
            videos = await _extract_bilibili_cookie_videos(target, raw_cookie)
        else:
            raise MonitorDiscoveryError(f"Unsupported cookie discovery platform: {target.platform}")
    except MissingMonitorCredentialError:
        raise
    except InvalidMonitorCredentialError as exc:
        await mark_monitor_credential_validation(
            db,
            owner_user_id,
            target.platform,
            "invalid",
            str(exc),
        )
        raise
    except Exception as exc:
        raise MonitorDiscoveryError(str(exc)) from exc

    await mark_monitor_credential_validation(db, owner_user_id, target.platform, "valid", None)
    return videos


def _build_bilibili_mixin_key(img_key: str, sub_key: str) -> str:
    raw = img_key + sub_key
    return "".join(raw[index] for index in WBI_MIXIN_KEY_ENC_TAB if index < len(raw))[:32]


def _sanitize_wbi_value(value: Any) -> str:
    text = str(value)
    return "".join(ch for ch in text if ch not in "!'()*")


def _sign_bilibili_wbi_params(params: dict[str, Any], img_key: str, sub_key: str) -> dict[str, Any]:
    mixin_key = _build_bilibili_mixin_key(img_key, sub_key)
    normalized: dict[str, Any] = {
        key: _sanitize_wbi_value(value)
        for key, value in sorted(params.items())
        if value is not None
    }
    query = urlencode(normalized)
    normalized["w_rid"] = hashlib.md5(f"{query}{mixin_key}".encode("utf-8")).hexdigest()
    return normalized


def _extract_bilibili_wbi_key(raw_url: str) -> str:
    path = urlparse(raw_url).path
    filename = path.rsplit("/", 1)[-1]
    return filename.split(".")[0]


def _resolve_bilibili_cover(url: str) -> str:
    text = str(url or "").strip()
    if not text:
        return ""
    if text.startswith("//"):
        return normalize_thumbnail_url(f"https:{text}")
    if text.startswith("/"):
        return normalize_thumbnail_url(f"https://i0.hdslb.com{text}")
    return normalize_thumbnail_url(text)


def _format_bilibili_published(created_at: Any) -> str:
    try:
        timestamp = int(created_at)
    except (TypeError, ValueError):
        return ""
    return str(datetime.fromtimestamp(timestamp, timezone.utc).date())


def _parse_bilibili_duration(duration_text: Any) -> int | None:
    text = str(duration_text or "").strip()
    if not text:
        return None
    parts = text.split(":")
    try:
        numbers = [int(part) for part in parts]
    except ValueError:
        return None
    if len(numbers) == 2:
        minutes, seconds = numbers
        return minutes * 60 + seconds
    if len(numbers) == 3:
        hours, minutes, seconds = numbers
        return hours * 3600 + minutes * 60 + seconds
    return None


async def _extract_bilibili_cookie_videos(target: MonitorTarget, raw_cookie: str) -> list[dict[str, Any]]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        "Referer": target.homepage_url,
        "Cookie": raw_cookie,
    }
    async with httpx.AsyncClient(timeout=30, headers=headers, follow_redirects=True) as client:
        nav_response = await client.get("https://api.bilibili.com/x/web-interface/nav")
        nav_response.raise_for_status()
        nav_payload = nav_response.json()
        if nav_payload.get("code") == -101 or not nav_payload.get("data", {}).get("isLogin"):
            raise InvalidMonitorCredentialError("B站 Cookie 未登录或已失效，请重新配置。")

        wbi_img = nav_payload.get("data", {}).get("wbi_img") or {}
        img_key = _extract_bilibili_wbi_key(wbi_img.get("img_url", ""))
        sub_key = _extract_bilibili_wbi_key(wbi_img.get("sub_url", ""))
        if not img_key or not sub_key:
            raise MonitorDiscoveryError("未能获取 B站 WBI 签名参数，请稍后重试。")

        params = _sign_bilibili_wbi_params(
            {
                "mid": target.platform_id,
                "ps": 30,
                "pn": 1,
                "order": "pubdate",
                "tid": 0,
                "platform": "web",
                "web_location": "1550101",
                "wts": int(datetime.now(timezone.utc).timestamp()),
            },
            img_key,
            sub_key,
        )
        response = await client.get("https://api.bilibili.com/x/space/wbi/arc/search", params=params)
        response.raise_for_status()
        payload = response.json()
        code = payload.get("code", -1)
        if code == -352:
            raise MonitorDiscoveryError("B站 Cookie 模式拉取仍触发风控，请稍后重试或更换 Cookie。")
        if code != 0:
            raise MonitorDiscoveryError(payload.get("message") or f"B站视频列表拉取失败(code={code})")

    vlist = payload.get("data", {}).get("list", {}).get("vlist", []) or []
    videos = [
        {
            "title": str(item.get("title") or "Untitled").strip(),
            "url": f"https://www.bilibili.com/video/{item['bvid']}",
            "published": _format_bilibili_published(item.get("created")),
            "thumbnail": _resolve_bilibili_cover(item.get("pic", "")),
            "view_count": _parse_browser_count(item.get("play")),
            "like_count": None,
            "favorite_count": None,
            "duration_seconds": _parse_bilibili_duration(item.get("length")),
        }
        for item in vlist
        if item.get("bvid")
    ]
    if videos:
        await rss_monitor._enrich_bilibili_stats(videos)
    return videos


async def _extract_profile_videos(page: Page, target: MonitorTarget) -> list[dict[str, Any]]:
    response = await page.goto(target.homepage_url, wait_until="domcontentloaded", timeout=45000)
    response_status = response.status if response else None
    invalid_reason = _resolve_browser_invalid_reason(
        target.platform,
        response_status=response_status,
    )
    if invalid_reason:
        raise InvalidMonitorCredentialError(invalid_reason)
    if response_status and response_status >= 400:
        raise MonitorDiscoveryError(f"页面访问失败: HTTP {response_status}")

    await page.wait_for_timeout(2500)

    content = await page.content()
    title = await page.title()
    if target.platform == "xiaohongshu":
        videos = await _extract_xiaohongshu_videos(page, target.homepage_url)
    else:
        raise MonitorDiscoveryError(f"Unsupported browser discovery platform: {target.platform}")

    invalid_reason = _resolve_browser_invalid_reason(
        target.platform,
        title=title,
        content=content,
        videos_found=len(videos),
    )
    if invalid_reason:
        raise InvalidMonitorCredentialError(invalid_reason)

    if not videos:
        raise MonitorDiscoveryError("未抓取到可用内容，可能是 Cookie 失效、页面结构变化或平台反爬限制。")
    return videos


async def _collect_xiaohongshu_items(page: Page) -> list[dict[str, Any]]:
    return await page.evaluate(
        """
        () => {
          const results = [];
          const seen = new Set();
          const containers = Array.from(
            document.querySelectorAll(
              'section.note-item, section[class*="note-item"], .note-item'
            )
          );
          const directAnchors = Array.from(
            document.querySelectorAll(
              'a[href*="/explore/"], a[href*="/discovery/item/"], a[href*="/user/profile/"]'
            )
          );

          const pickHref = (container) => {
            const anchors = Array.from(container.querySelectorAll('a[href]'));
            const preferred =
              anchors.find((anchor) => {
                const href = anchor.href || anchor.getAttribute('href') || '';
                return href.includes('xsec_token=') && (
                  href.includes('/user/profile/') ||
                  href.includes('/explore/') ||
                  href.includes('/discovery/item/')
                );
              }) ||
              anchors.find((anchor) => {
                const href = anchor.href || anchor.getAttribute('href') || '';
                return (
                  href.includes('/explore/') ||
                  href.includes('/discovery/item/') ||
                  href.includes('/user/profile/')
                );
              });
            return preferred ? (preferred.href || preferred.getAttribute('href') || '') : '';
          };

          const parseSrcset = (value) => {
            if (!value) return [];
            return value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
              .map((item) => {
                const [url, descriptor] = item.split(/\\s+/);
                const width = descriptor && descriptor.endsWith('w')
                  ? Number.parseInt(descriptor.slice(0, -1), 10)
                  : 0;
                return { url: url || '', width: Number.isFinite(width) ? width : 0 };
              })
              .filter((item) => item.url);
          };

          const pickImageUrl = (container) => {
            const img = container.querySelector('img');
            if (!img) return '';

            const candidates = [
              ...(img.currentSrc ? [{ url: img.currentSrc, width: 0 }] : []),
              ...(img.src ? [{ url: img.src, width: 0 }] : []),
              ...parseSrcset(img.getAttribute('srcset') || ''),
              ...parseSrcset(img.getAttribute('data-srcset') || ''),
              ...((img.getAttribute('data-src') || '') ? [{ url: img.getAttribute('data-src') || '', width: 0 }] : []),
            ].filter((item) => item.url);

            if (!candidates.length) return '';

            candidates.sort((left, right) => right.width - left.width);
            return candidates[0].url || '';
          };

          const sources = [
            ...containers.map((container) => ({ container, href: pickHref(container) })),
            ...directAnchors.map((anchor) => ({
              container: anchor.closest('section, div, article') || anchor,
              href: anchor.href || anchor.getAttribute('href') || '',
            })),
          ];

          for (const source of sources) {
            const href = source.href || '';
            if (!href || seen.has(href)) continue;
            seen.add(href);

            const container = source.container;
            const rect = container?.getBoundingClientRect?.() || null;
            const titleNode = container.querySelector('img[alt], h3, h2, [class*="title"], [class*="desc"]');
            const title = (
              titleNode?.getAttribute?.('alt') ||
              titleNode?.textContent ||
              container.querySelector('a[title]')?.getAttribute?.('title') ||
              ''
            ).trim();
            const likeText = (
              container.querySelector('.like-wrapper .count')?.textContent ||
              container.querySelector('[class*="like-wrapper"] [class*="count"]')?.textContent ||
              ''
            ).trim();
            const stickyText = (
              container.querySelector('.top-tag-area .top-wrapper')?.textContent ||
              container.querySelector('[class*="top-tag-area"] [class*="top-wrapper"]')?.textContent ||
              ''
            ).trim();
            const hasVideoIcon = Array.from(container.querySelectorAll('use')).some((node) => {
              const ref = node.getAttribute('xlink:href') || node.getAttribute('href') || '';
              return ref.includes('play');
            });
            const hasVideoMarker = Boolean(
              container.querySelector('.bottom-tag-area .bottom-wrapper') ||
              container.querySelector('[class*="bottom-tag-area"] [class*="bottom-wrapper"]') ||
              hasVideoIcon
            );

            results.push({
              title,
              url: href,
              published: '',
              thumbnail: pickImageUrl(container),
              is_sticky: stickyText.includes('置顶'),
              note_type: hasVideoMarker ? 'video' : '',
              like_count: likeText,
              dom_top: Number.isFinite(rect?.top) ? window.scrollY + rect.top : null,
              dom_left: Number.isFinite(rect?.left) ? rect.left : null,
              dom_index: results.length,
            });
          }
          return results;
        }
        """
    )


async def _extract_xiaohongshu_videos(page: Page, homepage_url: str) -> list[dict[str, Any]]:
    items_by_url: dict[str, dict[str, Any]] = {}

    def merge_items(batch: list[dict[str, Any]]) -> None:
        for item in batch:
            raw_url = str(item.get("url", "")).strip()
            if not raw_url:
                continue

            previous = items_by_url.get(raw_url)
            if previous is None:
                items_by_url[raw_url] = item
                continue

            previous_is_sticky = bool(previous.get("is_sticky"))
            current_is_sticky = bool(item.get("is_sticky"))
            previous_top = _normalize_dom_coordinate(previous.get("dom_top"), float("inf"))
            current_top = _normalize_dom_coordinate(item.get("dom_top"), float("inf"))

            if current_is_sticky and not previous_is_sticky:
                items_by_url[raw_url] = item
            elif current_is_sticky == previous_is_sticky and current_top < previous_top:
                items_by_url[raw_url] = item

    merge_items(await _collect_xiaohongshu_items(page))

    for _ in range(3):
        if len(items_by_url) >= 20:
            break
        previous_scroll = await page.evaluate("() => window.scrollY")
        await page.mouse.wheel(0, 1400)
        await page.wait_for_timeout(900)
        merge_items(await _collect_xiaohongshu_items(page))
        current_scroll = await page.evaluate("() => window.scrollY")
        if current_scroll <= previous_scroll:
            break

    ordered_items = _sort_xiaohongshu_items(list(items_by_url.values()))
    return [_normalize_browser_video(item, homepage_url) for item in ordered_items[:20]]


def _normalize_dom_coordinate(value: Any, default: float) -> float:
    if value is None:
        return default
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _sort_xiaohongshu_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_key(item: dict[str, Any]) -> tuple[int, float, float, int]:
        return (
            0 if bool(item.get("is_sticky")) else 1,
            _normalize_dom_coordinate(item.get("dom_top"), float("inf")),
            _normalize_dom_coordinate(item.get("dom_left"), float("inf")),
            int(_parse_browser_count(item.get("dom_index")) or 0),
        )

    return sorted(items, key=sort_key)


def _parse_browser_count(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return int(value)

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value)

    text = str(value).strip()
    if not text:
        return None

    compact = text.replace(",", "").replace("，", "").replace(" ", "")
    compact = compact.removesuffix("+")
    multiplier = 10000 if "万" in compact else 1
    match = COUNT_NUMBER_RE.search(compact)
    if not match:
        return None

    try:
        base_value = float(match.group())
    except ValueError:
        return None
    return int(base_value * multiplier)


def _normalize_note_type(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    return text or None


def _normalize_browser_video(item: dict[str, Any], homepage_url: str) -> dict[str, Any]:
    raw_url = str(item.get("url", "")).strip()
    resolved_url = canonicalize_video_source_url(urljoin(homepage_url, raw_url))
    title = str(item.get("title", "")).strip() or "Untitled"
    return {
        "title": title,
        "url": resolved_url,
        "published": str(item.get("published", "")).strip(),
        "thumbnail": upgrade_xiaohongshu_thumbnail_url(str(item.get("thumbnail", "")).strip()),
        "is_sticky": bool(item.get("is_sticky")),
        "note_type": _normalize_note_type(item.get("note_type")),
        "view_count": _parse_browser_count(item.get("view_count")),
        "like_count": _parse_browser_count(item.get("like_count")),
        "favorite_count": _parse_browser_count(item.get("favorite_count")),
        "duration_seconds": _parse_browser_count(item.get("duration_seconds")),
    }
