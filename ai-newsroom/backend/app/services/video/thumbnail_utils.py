from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse


def _normalize_url(url: str | None) -> str:
    return str(url or "").strip()


def _is_xiaohongshu_thumbnail(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return "xhscdn.com" in host or "xhscdn.net" in host or "xiaohongshu.com" in host


XIAOHONGSHU_PREVIEW_SUFFIX_RE = re.compile(
    r"!(?:nd_prv_[^/?#]+|nc_n_(?:webp|jpg)_(?:prv|mw)_[^/?#]+)$"
)


def upgrade_xiaohongshu_thumbnail_url(url: str | None) -> str:
    normalized = _normalize_url(url)
    if not normalized or not _is_xiaohongshu_thumbnail(normalized):
        return normalized

    parsed = urlparse(normalized)
    upgraded_path = XIAOHONGSHU_PREVIEW_SUFFIX_RE.sub("", parsed.path)
    if upgraded_path == parsed.path:
        return normalized
    return urlunparse(parsed._replace(path=upgraded_path))


def thumbnail_quality_score(url: str | None) -> int:
    normalized = _normalize_url(url)
    if not normalized:
        return 0

    if not _is_xiaohongshu_thumbnail(normalized):
        return 10

    if "!nd_prv_" in normalized:
        return 10
    if "!nc_n_webp_prv_" in normalized or "!nc_n_jpg_prv_" in normalized:
        return 20
    if "!nc_n_webp_mw_" in normalized or "!nc_n_jpg_mw_" in normalized:
        return 30

    return 40


def choose_better_thumbnail(current: str | None, candidate: str | None) -> str:
    current_normalized = _normalize_url(current)
    candidate_normalized = _normalize_url(candidate)
    if thumbnail_quality_score(candidate_normalized) > thumbnail_quality_score(current_normalized):
        return candidate_normalized
    return current_normalized
