"""Video downloader module using yt-dlp."""

import asyncio
from contextlib import suppress
import logging
import os
import shutil
import tempfile
from urllib.parse import urlparse

from app.services.video.url_utils import canonicalize_video_source_url

logger = logging.getLogger(__name__)

BILIBILI_412_ERROR = "B站风控或登录态异常，下载音频失败。请重新保存 B站 Cookie，或稍后重试。"
BILIBILI_NO_FORMATS_ERROR = "B站视频需要登录态才能获取，请先配置 B站 Cookie 后重试。"

IGNORED_COOKIE_ATTRIBUTES = {
    "path",
    "domain",
    "expires",
    "max-age",
    "samesite",
    "secure",
    "httponly",
    "priority",
    "partitioned",
}

COOKIE_FILE_DOMAINS = {
    "bilibili": ".bilibili.com",
    "xiaohongshu": ".xiaohongshu.com",
}


def _rewrite_platform_download_error(source_url: str, exc: Exception) -> Exception:
    platform = detect_platform(source_url)
    message = str(exc)
    if platform == "bilibili" and (
        "HTTP Error 412" in message or "Precondition Failed" in message
    ):
        return ValueError(BILIBILI_412_ERROR)
    if platform == "bilibili" and "No video formats found" in message:
        return ValueError(BILIBILI_NO_FORMATS_ERROR)
    if (
        platform == "xiaohongshu"
        and "No video formats found" in message
        and "xsec_token=" not in source_url
    ):
        return ValueError("小红书链接缺少 xsec_token，请先重新检查监控源，再执行解构。")
    return exc


def detect_platform(url: str) -> str:
    """Detect video platform from URL."""
    host = urlparse(url).hostname or ""
    if "bilibili" in host or "b23.tv" in host:
        return "bilibili"
    elif "youtube" in host or "youtu.be" in host:
        return "youtube"
    elif "douyin" in host or "tiktok" in host:
        return "douyin"
    elif "xiaohongshu" in host or "xhslink" in host:
        return "xiaohongshu"
    return "other"


def _sync_download(url: str, opts: dict) -> dict:
    """Synchronous yt-dlp download (runs in executor)."""
    import yt_dlp

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return info or {}


def _sync_extract_metadata(url: str, opts: dict) -> dict:
    """Synchronous metadata extraction only (no download)."""
    import yt_dlp

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info or {}


def _format_upload_date(upload_date: str | None) -> str:
    if not upload_date or len(upload_date) != 8 or not upload_date.isdigit():
        return ""
    return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"


def _normalize_video_url(source_url: str, info: dict) -> str:
    normalized = (
        info.get("webpage_url")
        or info.get("original_url")
        or info.get("url")
        or source_url
    )
    return str(normalized).strip()


def _build_request_headers(video_url: str, cookie_header: str | None = None) -> dict[str, str]:
    """Build browser-like headers for yt-dlp.

    cookie_header is accepted for backwards-compatible callers, but cookies are
    passed through yt-dlp's cookiefile option so they are scoped by domain.
    """
    platform = detect_platform(video_url)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
    }
    if platform == "bilibili":
        headers["Referer"] = "https://www.bilibili.com/"
        headers["Origin"] = "https://www.bilibili.com"
        headers["Accept-Language"] = "zh-CN,zh;q=0.9,en;q=0.8"
    elif platform == "douyin":
        headers["Referer"] = "https://www.douyin.com/"
    elif platform == "xiaohongshu":
        headers["Referer"] = "https://www.xiaohongshu.com/"

    return headers


def _normalize_cookie_header(raw_cookie: str) -> str:
    normalized = raw_cookie.strip().replace("\r\n", "; ").replace("\n", "; ")
    header_name, separator, remainder = normalized.partition(":")
    if separator and header_name.strip().lower() == "cookie":
        normalized = remainder.strip()
    return normalized.strip(" ;")


def _extract_cookie_pairs(raw_cookie: str) -> list[tuple[str, str]]:
    normalized = _normalize_cookie_header(raw_cookie)
    if not normalized:
        return []

    pairs: list[tuple[str, str]] = []
    for chunk in normalized.split(";"):
        part = chunk.strip()
        if not part or "=" not in part:
            continue
        key, _, value = part.partition("=")
        key = key.strip()
        if not key or key.lower() in IGNORED_COOKIE_ATTRIBUTES or key.startswith("$"):
            continue
        normalized_value = value.strip()
        if not normalized_value:
            continue
        pairs.append((key, normalized_value))
    return pairs


def _sanitize_cookie_file_value(value: str) -> str:
    return value.replace("\t", " ").replace("\r", "").replace("\n", "")


def _write_yt_dlp_cookie_file(
    video_url: str,
    cookie_header: str | None,
    *,
    directory: str | None = None,
) -> str | None:
    if not cookie_header:
        return None

    platform = detect_platform(video_url)
    domain = COOKIE_FILE_DOMAINS.get(platform)
    if not domain:
        return None

    cookie_pairs = _extract_cookie_pairs(cookie_header)
    if not cookie_pairs:
        raise ValueError("平台 Cookie 格式无效，请重新配置。")

    fd, path = tempfile.mkstemp(
        prefix=f"newsroom_{platform}_",
        suffix=".cookies.txt",
        dir=directory,
        text=True,
    )
    with os.fdopen(fd, "w", encoding="utf-8") as cookie_file:
        cookie_file.write("# Netscape HTTP Cookie File\n")
        cookie_file.write("# Generated by AI Newsroom for yt-dlp.\n")
        for name, value in cookie_pairs:
            cookie_file.write(
                "\t".join(
                    [
                        domain,
                        "TRUE",
                        "/",
                        "TRUE",
                        "0",
                        _sanitize_cookie_file_value(name),
                        _sanitize_cookie_file_value(value),
                    ]
                )
                + "\n"
            )
    return path


def _apply_cookie_file_option(
    ydl_opts: dict,
    video_url: str,
    cookie_header: str | None,
    *,
    directory: str | None = None,
) -> str | None:
    cookie_file = _write_yt_dlp_cookie_file(
        video_url,
        cookie_header,
        directory=directory,
    )
    if cookie_file:
        ydl_opts["cookiefile"] = cookie_file
    return cookie_file


def _remove_file(path: str | None) -> None:
    if path:
        with suppress(OSError):
            os.remove(path)


async def download_audio(video_url: str, cookie_header: str | None = None) -> dict:
    """Download audio-only stream from a video URL using yt-dlp.

    Returns dict with: audio_path, title, author, duration, thumbnail, platform
    """
    source_url = canonicalize_video_source_url(video_url)
    temp_dir = tempfile.mkdtemp(prefix="newsroom_audio_")
    output_template = os.path.join(temp_dir, "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "http_headers": _build_request_headers(source_url),
    }

    logger.info(f"[Downloader] Downloading audio from: {source_url}")

    loop = asyncio.get_event_loop()
    cookie_file = None
    try:
        cookie_file = _apply_cookie_file_option(
            ydl_opts,
            source_url,
            cookie_header,
            directory=temp_dir,
        )
        info = await loop.run_in_executor(None, _sync_download, source_url, ydl_opts)
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise _rewrite_platform_download_error(source_url, exc) from exc
    finally:
        _remove_file(cookie_file)

    # Find the downloaded MP3 file
    audio_path = None
    for f in os.listdir(temp_dir):
        if f.endswith(".mp3"):
            audio_path = os.path.join(temp_dir, f)
            break

    if not audio_path:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise FileNotFoundError(f"Audio download failed — no MP3 found in {temp_dir}")

    duration = info.get("duration") or 0
    platform = detect_platform(source_url)

    result = {
        "audio_path": audio_path,
        "title": info.get("title", ""),
        "author": info.get("uploader") or info.get("channel") or info.get("creator") or "",
        "duration": int(duration),
        "thumbnail": info.get("thumbnail", ""),
        "platform": platform,
        "video_url": canonicalize_video_source_url(
            str(info.get("webpage_url") or source_url).strip()
        ),
    }

    logger.info(
        f"[Downloader] Audio downloaded: {result['title']} "
        f"({result['duration']}s) by {result['author']} [{platform}]"
    )
    return result


async def fetch_video_metadata(video_url: str, cookie_header: str | None = None) -> dict:
    """Fetch video metadata without downloading audio."""
    original_url = video_url.strip()
    source_url = canonicalize_video_source_url(original_url)
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "skip_download": True,
        "http_headers": _build_request_headers(source_url),
    }

    logger.info("[Downloader] Fetching metadata for: %s", source_url)
    loop = asyncio.get_event_loop()
    cookie_file = None
    try:
        cookie_file = _apply_cookie_file_option(ydl_opts, source_url, cookie_header)
        info = await loop.run_in_executor(None, _sync_extract_metadata, source_url, ydl_opts)
    except Exception as exc:
        raise _rewrite_platform_download_error(source_url, exc) from exc
    finally:
        _remove_file(cookie_file)

    normalized_url = canonicalize_video_source_url(_normalize_video_url(source_url, info))
    platform = detect_platform(normalized_url)

    return {
        "original_url": original_url,
        "normalized_url": normalized_url,
        "title": info.get("title", ""),
        "author": info.get("uploader") or info.get("channel") or info.get("creator") or "",
        "published": _format_upload_date(info.get("upload_date")),
        "thumbnail": info.get("thumbnail", ""),
        "duration_seconds": int(info.get("duration") or 0) or None,
        "view_count": info.get("view_count"),
        "like_count": info.get("like_count"),
        "favorite_count": info.get("favorite_count"),
        "comment_count": info.get("comment_count"),
        "description": info.get("description") or info.get("fulltitle") or "",
        "tags": info.get("tags") or [],
        "channel": info.get("channel") or "",
        "uploader_id": info.get("uploader_id") or info.get("channel_id") or "",
        "webpage_url": info.get("webpage_url") or normalized_url,
        "platform": platform,
    }
