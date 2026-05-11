#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.credential_service import parse_cookie_pairs  # noqa: E402
from app.services.monitor_discovery import (  # noqa: E402
    PLATFORM_BASE_URLS,
    _extract_douyin_videos,
    _extract_xiaohongshu_videos,
    _resolve_browser_invalid_reason,
)
from app.services.video.downloader import fetch_video_metadata  # noqa: E402


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Diagnose Douyin/Xiaohongshu monitor discovery and yt-dlp metadata fetch."
    )
    parser.add_argument(
        "--platform",
        required=True,
        choices=["douyin", "xiaohongshu"],
        help="Target platform.",
    )
    parser.add_argument(
        "--homepage-url",
        help="Profile URL to test monitor discovery.",
    )
    parser.add_argument(
        "--video-url",
        help="Single video URL to test yt-dlp metadata fetch.",
    )
    parser.add_argument(
        "--cookie",
        help="Raw Cookie header value.",
    )
    parser.add_argument(
        "--cookie-file",
        help="Path to a text file containing the raw Cookie header value.",
    )
    parser.add_argument(
        "--cookie-env",
        default="VIDEO_FETCH_COOKIE",
        help="Environment variable to read Cookie from if --cookie/--cookie-file is omitted.",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Run Chromium in headed mode for manual observation.",
    )
    parser.add_argument(
        "--output-dir",
        help="Directory to store screenshots, HTML, and JSON diagnostics.",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=45000,
        help="Page navigation timeout in milliseconds.",
    )
    return parser


def _load_cookie(args: argparse.Namespace) -> str:
    if args.cookie:
        return args.cookie.strip()
    if args.cookie_file:
        return Path(args.cookie_file).read_text(encoding="utf-8").strip()
    if args.cookie_env and os.getenv(args.cookie_env):
        return os.getenv(args.cookie_env, "").strip()
    raise SystemExit(
        "Missing cookie. Provide --cookie, --cookie-file, or set the environment variable "
        f"{args.cookie_env}."
    )


def _default_output_dir(platform: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return BACKEND_ROOT / "debug_artifacts" / f"{platform}_{stamp}"


def _preview_lines(text: str, limit: int = 15) -> list[str]:
    lines = [line.strip() for line in text.splitlines()]
    return [line for line in lines if line][:limit]


async def _inject_cookies(context, platform: str, raw_cookie: str) -> dict[str, Any]:
    pairs = parse_cookie_pairs(raw_cookie)
    base_url = PLATFORM_BASE_URLS[platform]
    hostname = base_url.split("://", 1)[-1]
    cookies = [
        {
            "name": key,
            "value": value,
            "domain": hostname,
            "path": "/",
            "httpOnly": False,
            "secure": True,
            "sameSite": "Lax",
        }
        for key, value in pairs
    ]
    if cookies:
        await context.add_cookies(cookies)
    return {
        "cookie_pairs": len(pairs),
        "cookie_names_sample": [key for key, _ in pairs[:10]],
    }


async def _collect_page_debug(page, platform: str) -> dict[str, Any]:
    selectors = {
        "douyin": {
            "video_anchor_count": 'a[href*="/video/"]',
            "modal_anchor_count": 'a[href*="modal_id="]',
        },
        "xiaohongshu": {
            "explore_anchor_count": 'a[href*="/explore/"]',
            "discovery_anchor_count": 'a[href*="/discovery/item/"]',
        },
    }[platform]

    js = """
    (selectors) => {
      const counts = {};
      for (const [label, selector] of Object.entries(selectors)) {
        counts[label] = document.querySelectorAll(selector).length;
      }
      return {
        counts,
        title: document.title || "",
        bodyTextPreview: (document.body?.innerText || "").slice(0, 3000),
        hrefPreview: Array.from(document.querySelectorAll("a[href]"))
          .map((node) => node.href || node.getAttribute("href") || "")
          .filter(Boolean)
          .slice(0, 30),
      };
    }
    """
    return await page.evaluate(js, selectors)


async def _run_monitor_discovery(
    platform: str,
    homepage_url: str,
    raw_cookie: str,
    output_dir: Path,
    timeout_ms: int,
    headed: bool,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)

    result: dict[str, Any] = {
        "platform": platform,
        "homepage_url": homepage_url,
        "output_dir": str(output_dir),
    }

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=not headed,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
            user_agent=USER_AGENT,
        )
        try:
            result["cookie"] = await _inject_cookies(context, platform, raw_cookie)
            page = await context.new_page()

            response = await page.goto(
                homepage_url,
                wait_until="domcontentloaded",
                timeout=timeout_ms,
            )
            result["response_status"] = response.status if response else None
            result["final_url"] = page.url

            await page.wait_for_timeout(2500)
            await page.mouse.wheel(0, 1600)
            await page.wait_for_timeout(1200)

            html = await page.content()
            text_snapshot = await page.locator("body").inner_text()

            screenshot_path = output_dir / "page.png"
            html_path = output_dir / "page.html"
            text_path = output_dir / "body.txt"
            await page.screenshot(path=str(screenshot_path), full_page=True)
            html_path.write_text(html, encoding="utf-8")
            text_path.write_text(text_snapshot, encoding="utf-8")

            result["artifacts"] = {
                "screenshot": str(screenshot_path),
                "html": str(html_path),
                "body_text": str(text_path),
            }
            result["title"] = await page.title()
            result["page_debug"] = await _collect_page_debug(page, platform)
            result["body_preview_lines"] = _preview_lines(text_snapshot)

            if platform == "douyin":
                videos = await _extract_douyin_videos(page, homepage_url)
            else:
                videos = await _extract_xiaohongshu_videos(page, homepage_url)

            videos_path = output_dir / "videos.json"
            videos_path.write_text(
                json.dumps(videos, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            result["video_count"] = len(videos)
            result["videos_preview"] = videos[:5]
            result["artifacts"]["videos_json"] = str(videos_path)
            result["invalid_reason"] = _resolve_browser_invalid_reason(
                platform,
                response_status=result["response_status"],
                title=result["title"],
                content=html,
                videos_found=len(videos),
            )
            result["ok"] = len(videos) > 0
            if not videos:
                result["error"] = (
                    "No videos extracted. Likely cookie invalid, page did not fully render, "
                    "or selectors no longer match the platform DOM."
                )
        finally:
            await context.close()
            await browser.close()

    return result


async def _run_video_metadata(
    video_url: str,
    raw_cookie: str,
) -> dict[str, Any]:
    metadata = await fetch_video_metadata(video_url, cookie_header=raw_cookie)
    return {
        "ok": True,
        "metadata": metadata,
    }


async def _async_main(args: argparse.Namespace) -> int:
    raw_cookie = _load_cookie(args)
    output_dir = Path(args.output_dir) if args.output_dir else _default_output_dir(args.platform)

    summary: dict[str, Any] = {
        "platform": args.platform,
        "homepage_test": None,
        "video_test": None,
    }

    if not args.homepage_url and not args.video_url:
        raise SystemExit("At least one of --homepage-url or --video-url is required.")

    if args.homepage_url:
        try:
            summary["homepage_test"] = await _run_monitor_discovery(
                platform=args.platform,
                homepage_url=args.homepage_url,
                raw_cookie=raw_cookie,
                output_dir=output_dir,
                timeout_ms=args.timeout_ms,
                headed=args.headed,
            )
        except Exception as exc:
            summary["homepage_test"] = {
                "ok": False,
                "error": str(exc),
                "output_dir": str(output_dir),
            }

    if args.video_url:
        try:
            summary["video_test"] = await _run_video_metadata(
                video_url=args.video_url,
                raw_cookie=raw_cookie,
            )
        except Exception as exc:
            summary["video_test"] = {
                "ok": False,
                "error": str(exc),
            }

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    homepage_ok = summary["homepage_test"] is None or summary["homepage_test"].get("ok")
    video_ok = summary["video_test"] is None or summary["video_test"].get("ok")
    return 0 if homepage_ok and video_ok else 1


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_async_main(args))


if __name__ == "__main__":
    raise SystemExit(main())
