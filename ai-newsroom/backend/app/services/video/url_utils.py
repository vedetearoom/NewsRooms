from __future__ import annotations

from urllib.parse import parse_qs, urlencode, urlparse


def _extract_douyin_video_id(url: str) -> str | None:
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    if "douyin" not in host:
        return None

    path = parsed.path.strip("/")
    parts = [part for part in path.split("/") if part]
    query = parse_qs(parsed.query)

    if parts[:1] == ["video"] and len(parts) >= 2 and parts[1].isdigit():
        return parts[1]

    if parts[:2] == ["m", "video"] and len(parts) >= 3 and parts[2].isdigit():
        return parts[2]

    modal_id = query.get("modal_id", [None])[0]
    if isinstance(modal_id, str) and modal_id.isdigit():
        return modal_id

    return None


def _canonicalize_xiaohongshu_note_url(url: str) -> str | None:
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    if "xiaohongshu" not in host:
        return None

    path = parsed.path.strip("/")
    parts = [part for part in path.split("/") if part]
    query = parse_qs(parsed.query)
    note_id: str | None = None

    if parts[:1] == ["explore"] and len(parts) >= 2:
        note_id = parts[1]
    elif parts[:2] == ["discovery", "item"] and len(parts) >= 3:
        note_id = parts[2]
    elif parts[:2] == ["user", "profile"] and len(parts) >= 4:
        note_id = parts[3]

    if not note_id:
        return None

    normalized = f"https://www.xiaohongshu.com/explore/{note_id}"
    xsec_token = query.get("xsec_token", [None])[0]
    xsec_source = query.get("xsec_source", [None])[0]
    params: list[tuple[str, str]] = []
    if isinstance(xsec_token, str) and xsec_token:
        params.append(("xsec_token", xsec_token))
    if isinstance(xsec_source, str) and xsec_source:
        params.append(("xsec_source", xsec_source))
    if params:
        normalized = f"{normalized}?{urlencode(params)}"
    return normalized


def get_video_source_identity(url: str) -> str:
    normalized = url.strip()
    if not normalized:
        return normalized

    douyin_video_id = _extract_douyin_video_id(normalized)
    if douyin_video_id:
        return f"douyin:{douyin_video_id}"

    xiaohongshu_url = _canonicalize_xiaohongshu_note_url(normalized)
    if xiaohongshu_url:
        parsed = urlparse(xiaohongshu_url)
        parts = [part for part in parsed.path.strip("/").split("/") if part]
        if parts[:1] == ["explore"] and len(parts) >= 2:
            return f"xiaohongshu:{parts[1]}"

    return canonicalize_video_source_url(normalized)


def canonicalize_video_source_url(url: str) -> str:
    normalized = url.strip()
    if not normalized:
        return normalized

    douyin_video_id = _extract_douyin_video_id(normalized)
    if douyin_video_id:
        return f"https://www.douyin.com/video/{douyin_video_id}"

    xiaohongshu_url = _canonicalize_xiaohongshu_note_url(normalized)
    if xiaohongshu_url:
        return xiaohongshu_url

    return normalized
