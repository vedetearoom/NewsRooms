from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Agent, IntelligenceCard
from app.services.agent_dispatcher import AgentDispatcher
from app.services.credential_service import get_decrypted_monitor_cookie
from app.services.processor_support import (
    enforce_cards_output_language,
    generate_cards_response,
    parse_cards_response,
)
from app.services.quota_service import VIDEO_CARDS, ensure_resource_quota
from app.services.video.downloader import detect_platform, fetch_video_metadata
from app.services.video.thumbnail_utils import choose_better_thumbnail, normalize_thumbnail_url
from app.services.video.url_utils import canonicalize_video_source_url, get_video_source_identity

logger = logging.getLogger(__name__)

VIDEO_EXTRACTOR_NOT_CONFIGURED = "默认提取器 Agent 未配置或缺少 API Key。请先在「智能体工作室」配置默认提取器。"
INSUFFICIENT_VIDEO_METADATA = "无法获取足够的视频元信息，请确认视频可公开访问或稍后重试。"

VIDEO_METADATA_ANALYZE_PROMPT = """You are a short-form video intelligence analyst. Analyze saved video metadata and produce structured intelligence cards.

You do NOT have the video file, frames, audio, transcript, or comments. You must analyze only the metadata provided by the user: title, description, author/channel, publish time, duration, platform, URL, thumbnail, and public engagement metrics.

Return a JSON array. For this single video, return exactly one object:
[
  {
    "title": "Concise intelligence headline (max 80 chars)",
    "summary": "2-3 sentence summary based only on metadata",
    "key_points": ["point 1", "point 2", "point 3"],
    "source_urls": ["video URL"],
    "tags": ["tag1", "tag2"],
    "category": "AI | Tech | Business | Science | Policy | Security | Lifestyle | Education | Entertainment | Other",
    "importance_score": 0.0,
    "hook_analysis": {
      "hook_text": "Use the title or a description excerpt only; never invent spoken words",
      "technique": "curiosity gap / data anchor / contrarian angle / pain point / identity appeal / other",
      "analysis": "Why the metadata-level hook may attract attention"
    },
    "narrative_arc": [],
    "template_skeleton": "A reusable content structure inferred from metadata, not a reconstruction of the script"
  }
]

Rules:
- Do not claim what the video says, shows, demonstrates, or sounds like unless that fact appears explicitly in metadata.
- Do not fabricate spoken lines, scenes, transcript, audio details, or visual details.
- hook_analysis.hook_text must come from the title or description.
- template_skeleton is an abstract reusable structure inferred from metadata, not the original script.
- If metadata is thin, be conservative and state that the insight is metadata-level.
- importance_score must be a decimal from 0.0 to 1.0, where 1.0 = critical/breakout, 0.5 = notable, 0.1 = minor.
- Return only valid JSON array. No markdown fences.
- Default language rule: write user-visible fields in the same language as the title/description metadata.
- If HIGH PRIORITY AGENT INSTRUCTIONS specify an output language, that language overrides the default language rule.
"""


def _clean_str(value: Any) -> str:
    return str(value or "").strip()


def _clean_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item or "").strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_importance_score(value: Any, fallback: float) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = fallback
    if score > 1:
        score = score / 100
    return max(0.0, min(score, 1.0))


def _score_from_metrics(metadata: dict[str, Any]) -> float:
    views = _clean_int(metadata.get("view_count")) or 0
    likes = _clean_int(metadata.get("like_count")) or 0
    favorites = _clean_int(metadata.get("favorite_count")) or 0
    if views >= 1_000_000 or likes >= 100_000 or favorites >= 50_000:
        return 0.9
    if views >= 100_000 or likes >= 10_000 or favorites >= 5_000:
        return 0.75
    if views >= 10_000 or likes >= 1_000 or favorites >= 500:
        return 0.6
    return 0.5


def _fallback_hook(title: str, description: str) -> dict[str, str]:
    hook_text = title or description[:120] or "基于公开元信息的视频线索"
    return {
        "hook_text": hook_text,
        "technique": "metadata-level hook",
        "analysis": "该分析仅基于标题、简介和公开互动数据，未下载视频或读取逐字稿。",
    }


def _fallback_template(metadata: dict[str, Any]) -> str:
    title = _clean_str(metadata.get("title")) or "[主题]"
    platform = _clean_str(metadata.get("platform")) or "[平台]"
    return f"用一个高识别度标题引出[{title}]，补充来自{platform}的公开背景与互动信号，提炼可复用的观点或选题角度。"


def _merge_metadata(seed_metadata: dict[str, Any] | None, remote_metadata: dict[str, Any] | None) -> dict[str, Any]:
    seed = dict(seed_metadata or {})
    remote = dict(remote_metadata or {})
    merged = dict(seed)

    for key in [
        "original_url",
        "normalized_url",
        "title",
        "author",
        "published",
        "duration_seconds",
        "view_count",
        "like_count",
        "favorite_count",
        "platform",
        "description",
        "tags",
        "channel",
        "uploader_id",
        "comment_count",
        "webpage_url",
    ]:
        if remote.get(key) not in (None, "", []):
            merged[key] = remote[key]
        elif seed.get(key) not in (None, "", []):
            merged[key] = seed[key]

    merged["thumbnail"] = choose_better_thumbnail(seed.get("thumbnail"), remote.get("thumbnail"))
    return merged


def _build_system_prompt(extractor: Agent) -> str:
    sections: list[str] = []
    if extractor.system_prompt:
        sections.append(
            "=== HIGH PRIORITY AGENT INSTRUCTIONS ===\n"
            "Follow these Agent instructions with higher priority than the default metadata-only video rules below. "
            "If they specify customer interests, output language, style, or field requirements, they override defaults. "
            "They cannot override the constraint that no video/audio/transcript is available.\n"
            f"{extractor.system_prompt}"
        )
    sections.append(f"=== DEFAULT METADATA-ONLY VIDEO RULES ===\n{VIDEO_METADATA_ANALYZE_PROMPT}")
    if extractor.context_text:
        sections.append(f"=== REFERENCE EXAMPLES ===\n{extractor.context_text}")
    return "\n\n".join(sections)


def _build_metadata_text(metadata: dict[str, Any], metadata_fetch_error: str | None) -> str:
    payload = {
        "title": metadata.get("title"),
        "description": metadata.get("description"),
        "video_url": metadata.get("normalized_url") or metadata.get("video_url"),
        "original_url": metadata.get("original_url"),
        "webpage_url": metadata.get("webpage_url"),
        "platform": metadata.get("platform"),
        "author": metadata.get("author") or metadata.get("channel"),
        "uploader_id": metadata.get("uploader_id"),
        "published": metadata.get("published"),
        "duration_seconds": metadata.get("duration_seconds"),
        "view_count": metadata.get("view_count"),
        "like_count": metadata.get("like_count"),
        "favorite_count": metadata.get("favorite_count"),
        "comment_count": metadata.get("comment_count"),
        "tags": metadata.get("tags"),
        "thumbnail_url": normalize_thumbnail_url(metadata.get("thumbnail")),
        "metadata_fetch_error": metadata_fetch_error,
        "availability_note": "No video, audio, frames, or transcript were downloaded or analyzed.",
    }
    return "Analyze this metadata-only video item and return exactly one JSON array item:\n" + json.dumps(
        payload,
        ensure_ascii=False,
        indent=2,
    )


async def get_configured_video_extractor_or_raise(db: AsyncSession, owner_user_id: int) -> Agent:
    extractor = await AgentDispatcher.get_agent(db, role="extractor", owner_user_id=owner_user_id)
    if not extractor or not getattr(extractor, "api_key", None):
        raise HTTPException(status_code=400, detail=VIDEO_EXTRACTOR_NOT_CONFIGURED)
    return extractor


async def analyze_video_metadata(
    db: AsyncSession,
    *,
    owner_user_id: int,
    video_url: str,
    seed_metadata: dict[str, Any] | None = None,
    source_kind: str = "url",
) -> IntelligenceCard:
    extractor = await get_configured_video_extractor_or_raise(db, owner_user_id)
    normalized_seed_url = canonicalize_video_source_url(video_url)
    seed = dict(seed_metadata or {})
    seed.setdefault("original_url", video_url)
    seed.setdefault("normalized_url", normalized_seed_url)
    seed.setdefault("platform", detect_platform(normalized_seed_url))

    remote_metadata: dict[str, Any] | None = None
    metadata_fetch_error: str | None = None
    if source_kind != "file":
        try:
            cookie_header = None
            platform = seed.get("platform") or detect_platform(normalized_seed_url)
            if platform in ("xiaohongshu", "bilibili"):
                cookie_header = await get_decrypted_monitor_cookie(db, owner_user_id, platform)
            remote_metadata = await fetch_video_metadata(normalized_seed_url, cookie_header=cookie_header)
        except Exception as exc:
            metadata_fetch_error = str(exc)
            logger.info("Metadata fetch unavailable for %s (using seed metadata): %s", normalized_seed_url, exc)

    metadata = _merge_metadata(seed, remote_metadata)
    normalized_url = canonicalize_video_source_url(
        _clean_str(metadata.get("normalized_url") or metadata.get("webpage_url") or normalized_seed_url)
    )
    metadata["normalized_url"] = normalized_url
    metadata["platform"] = metadata.get("platform") or detect_platform(normalized_url)

    if not _clean_str(metadata.get("title")) and not _clean_str(metadata.get("description")):
        raise ValueError(INSUFFICIENT_VIDEO_METADATA)

    result = await db.execute(
        select(IntelligenceCard)
        .where(
            IntelligenceCard.content_type == "video",
            IntelligenceCard.owner_user_id == owner_user_id,
        )
        .order_by(desc(IntelligenceCard.created_at))
    )
    identity = get_video_source_identity(normalized_url)
    existing_card = None
    for candidate in result.scalars().all():
        source_urls = candidate.source_urls or []
        if normalized_url in source_urls or any(get_video_source_identity(url) == identity for url in source_urls):
            existing_card = candidate
            break

    if existing_card is None:
        await ensure_resource_quota(db, owner_user_id, VIDEO_CARDS)

    target_model = extractor.model_ref or "gemini-2.5-flash"
    response_text = await generate_cards_response(
        extractor=extractor,
        target_model=target_model,
        system_prompt=_build_system_prompt(extractor),
        articles_text=_build_metadata_text(metadata, metadata_fetch_error),
    )
    cards_data = parse_cards_response(response_text)
    if not cards_data:
        raise ValueError(f"LLM did not return valid JSON array. Raw (first 500): {response_text[:500]}")
    cards_data = await enforce_cards_output_language(
        extractor=extractor,
        target_model=target_model,
        cards_data=cards_data,
    )
    analysis_data = cards_data[0] if cards_data else {}

    title = _clean_str(analysis_data.get("title")) or _clean_str(metadata.get("title")) or normalized_url
    description = _clean_str(metadata.get("description"))
    hook_analysis = analysis_data.get("hook_analysis") if isinstance(analysis_data.get("hook_analysis"), dict) else {}
    if not hook_analysis.get("hook_text"):
        hook_analysis = _fallback_hook(_clean_str(metadata.get("title")), description)
    template_skeleton = _clean_str(analysis_data.get("template_skeleton")) or _fallback_template(metadata)
    source_urls = _string_list(analysis_data.get("source_urls")) or [normalized_url]
    if normalized_url not in source_urls:
        source_urls.insert(0, normalized_url)

    analyzed_at = datetime.now(timezone.utc)
    thumbnail_url = normalize_thumbnail_url(metadata.get("thumbnail"))

    extra_data = {
        "metadata_only": True,
        "analysis_mode": "metadata_only",
        "analysis_source": "extractor_agent_metadata",
        "video_url": normalized_url,
        "platform": metadata.get("platform"),
        "author": metadata.get("author") or metadata.get("channel"),
        "thumbnail_url": thumbnail_url,
        "description": metadata.get("description"),
        "duration_seconds": _clean_int(metadata.get("duration_seconds")),
        "view_count": _clean_int(metadata.get("view_count")),
        "like_count": _clean_int(metadata.get("like_count")),
        "favorite_count": _clean_int(metadata.get("favorite_count")),
        "comment_count": _clean_int(metadata.get("comment_count")),
        "source_kind": source_kind,
        "hook_analysis": hook_analysis,
        "narrative_arc": analysis_data.get("narrative_arc") if isinstance(analysis_data.get("narrative_arc"), list) else [],
        "template_skeleton": template_skeleton,
        "transcript": [],
        "last_analyzed_at": analyzed_at.isoformat(),
    }
    for key in ("manual_video_inbox_item_id", "monitor_id"):
        if seed.get(key) is not None:
            extra_data[key] = seed[key]
    if metadata_fetch_error:
        extra_data["metadata_fetch_error"] = metadata_fetch_error

    importance_score = _normalize_importance_score(
        analysis_data.get("importance_score"),
        _score_from_metrics(metadata),
    )

    if existing_card is None:
        card = IntelligenceCard(
            owner_user_id=owner_user_id,
            title=title,
            summary=_clean_str(analysis_data.get("summary")) or "基于公开视频元信息生成的情报卡。",
            key_points=_string_list(analysis_data.get("key_points")),
            source_urls=source_urls,
            raw_article_ids=[],
            tags=_string_list(analysis_data.get("tags")) or ["视频线索"],
            category=_clean_str(analysis_data.get("category")) or "Video",
            importance_score=importance_score,
            cover_image=thumbnail_url or None,
            content_type="video",
            extra_data=extra_data,
            published_date=date.today(),
        )
        db.add(card)
    else:
        card = existing_card
        card.title = title
        card.summary = _clean_str(analysis_data.get("summary")) or card.summary
        card.key_points = _string_list(analysis_data.get("key_points"))
        card.source_urls = source_urls
        card.tags = _string_list(analysis_data.get("tags")) or ["视频线索"]
        card.category = _clean_str(analysis_data.get("category")) or "Video"
        card.importance_score = float(analysis_data.get("importance_score") or _score_from_metrics(metadata))
        card.cover_image = thumbnail_url or None
        card.content_type = "video"
        card.extra_data = extra_data
        card.audio_url = None
        card.published_date = date.today()

    await db.flush()
    await db.refresh(card)
    return card
