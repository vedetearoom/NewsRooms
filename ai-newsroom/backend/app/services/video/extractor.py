"""Video structural extraction module using LLM (Gemini/Qwen)."""

import json
import logging
import re
from datetime import date, datetime, timezone
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai import types

from app.models import IntelligenceCard
from app.services.processor_support import (
    card_matches_output_language,
    infer_agent_output_language,
    repair_cards_output_language,
)
from app.services.quota_service import VIDEO_CARDS, ensure_resource_quota

logger = logging.getLogger(__name__)

VIDEO_ANALYZE_PROMPT = """你是一位短视频爆款内容解构专家。分析以下视频逐字稿，提取结构化模板。

必须输出以下 JSON（不可修改字段名）：
{
  "title": "视频核心主题（最多 80 字）",
  "summary": "2-3 句话概括视频核心内容和亮点",
  "key_points": ["要点1", "要点2", "要点3"],
  "tags": ["标签1", "标签2"],
  "category": "AI | Tech | Business | Lifestyle | Education | Entertainment | Other",
  "importance_score": 0.0 到 1.0（1.0=极度爆款/破圈，0.5=一般热度，0.1=冷门）,
  "hook_analysis": {
    "hook_text": "视频前3秒的原始文案（从逐字稿中精确提取）",
    "technique": "钩子手法分类（好奇心缺口/数据锚点/反常识/痛点共鸣/悬念/对比冲突/身份认同/...）",
    "analysis": "详细分析为什么这个开头能抓住注意力（50-100字）"
  },
  "narrative_arc": [
    {"time": "MM:SS", "label": "节点描述", "emotion_shift": "抛出痛点/反转/引发共鸣等转折点"}
  ],
  "template_skeleton": "将视频脚本抽象为填空式模板，用[___占位符___]标注可替换部分"
}

规则：
- hook_analysis 是最重要的部分，请尽量详细和有洞察力
- narrative_arc 按时间顺序排列，客观总结每个内容转折点和叙事/情绪拐点
- template_skeleton 要抽象到可以直接套用到其他主题
- 输出语言与逐字稿语言一致（中文逐字稿就输出中文分析）
- 仅输出有效 JSON，不要包裹代码块
"""

def _parse_json_object(text: str) -> dict | None:
    """Robustly parse a JSON object from LLM output."""
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    cleaned = re.sub(r"^```(?:json)?\s*\n", "", text, count=1)
    cleaned = re.sub(r"\n```\s*$", "", cleaned).strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            parsed = json.loads(text[start:end])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    logger.error(f"Failed to parse JSON object from: {text[:300]}")
    return None


from app.services.agent_dispatcher import AgentDispatcher

async def analyze_video_transcript(
    transcript: list[dict],
    video_info: dict,
    db: AsyncSession,
    owner_user_id: int,
    audio_url: str | None = None,
) -> IntelligenceCard:
    """Analyze transcript with LLM to extract structured video template."""
    extractor = None
    try:
        extractor = await AgentDispatcher.get_agent(db, role="extractor", owner_user_id=owner_user_id)
    except Exception:
        extractor = None

    target_model = (extractor.model_ref if extractor and extractor.model_ref else "gemini-2.5-flash")
    api_key = (extractor.api_key if extractor and getattr(extractor, "api_key", None) else None)

    if not api_key:
        raise ValueError("提取器(Extractor) Agent 未配置 API Key。")

    prompt_sections: list[str] = []

    if extractor and extractor.system_prompt:
        prompt_sections.append(
            "=== HIGH PRIORITY AGENT INSTRUCTIONS ===\n"
            "Follow these Agent instructions with higher priority than the default video analysis rules below. "
            "If they specify output language, style, or field-level requirements, they override defaults.\n"
            f"{extractor.system_prompt}"
        )
    prompt_sections.append(f"=== DEFAULT VIDEO ANALYSIS RULES ===\n{VIDEO_ANALYZE_PROMPT}")
    if extractor and extractor.context_text:
        prompt_sections.append(f"=== REFERENCE EXAMPLES ===\n{extractor.context_text}")
    system_prompt = "\n\n".join(prompt_sections)

    transcript_text = "\n".join(
        f"[{seg.get('time', '??:??')}] {seg.get('text', '')}" for seg in transcript
    )

    user_message = (
        f"视频信息：\n"
        f"- 标题：{video_info.get('title', '未知')}\n"
        f"- 作者：{video_info.get('author', '未知')}\n"
        f"- 平台：{video_info.get('platform', '未知')}\n"
        f"- 时长：{video_info.get('duration', 0)}秒\n\n"
        f"逐字稿：\n{transcript_text}"
    )

    logger.info(f"[VideoExtractor] Analyzing transcript with {target_model} (agent: {extractor.name if extractor else 'none'})")

    if target_model.startswith("qwen"):
        from openai import AsyncOpenAI
        oai_client = AsyncOpenAI(api_key=api_key, base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
        response = await oai_client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            max_tokens=8192,
        )
        text = response.choices[0].message.content.strip()
    else:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=target_model,
            contents=system_prompt + "\n\n" + user_message,
            config=types.GenerateContentConfig(
                max_output_tokens=8192,
                temperature=0.3,
                response_mime_type="application/json",
            ),
        )
        text = response.text.strip()

    analysis_data = _parse_json_object(text)

    if not analysis_data:
        raise ValueError(f"LLM did not return valid JSON. Raw (first 500): {text[:500]}")

    target_language = infer_agent_output_language(extractor)
    if target_language and not card_matches_output_language(analysis_data, target_language):
        logger.warning("[VideoExtractor] Output language mismatch; attempting card language repair.")
        repaired_cards = await repair_cards_output_language(
            extractor=extractor,
            target_model=target_model,
            cards_data=[analysis_data],
            target_language=target_language,
        )
        repaired_card = repaired_cards[0] if repaired_cards else None
        if repaired_card and card_matches_output_language(repaired_card, target_language):
            for field in ("title", "summary", "key_points", "tags", "category"):
                if field in repaired_card:
                    analysis_data[field] = repaired_card[field]
        else:
            raise ValueError("Agent requires Chinese output, but video card did not pass the Chinese output gate.")

    extra_data = {
        "platform": video_info.get("platform", ""),
        "author": video_info.get("author", ""),
        "video_url": video_info.get("video_url", ""),
        "duration_seconds": video_info.get("duration", 0),
        "thumbnail_url": video_info.get("thumbnail", ""),
        "transcript": transcript,
        "hook_analysis": analysis_data.get("hook_analysis", {}),
        "narrative_arc": analysis_data.get("narrative_arc", []),
        "template_skeleton": analysis_data.get("template_skeleton", ""),
        "last_analyzed_at": datetime.now(timezone.utc).isoformat(),
    }

    video_url = video_info.get("video_url", "")
    existing_card = None
    result = await db.execute(
        select(IntelligenceCard)
        .where(
            IntelligenceCard.content_type == "video",
            IntelligenceCard.owner_user_id == owner_user_id,
        )
        .order_by(desc(IntelligenceCard.created_at))
    )
    for candidate in result.scalars().all():
        if video_url and video_url in (candidate.source_urls or []):
            existing_card = candidate
            break

    if existing_card is None:
        await ensure_resource_quota(db, owner_user_id, VIDEO_CARDS)
        card = IntelligenceCard(
            owner_user_id=owner_user_id,
            title=analysis_data.get("title", video_info.get("title", "Untitled Video")),
            summary=analysis_data.get("summary", ""),
            key_points=analysis_data.get("key_points", []),
            source_urls=[video_url],
            tags=analysis_data.get("tags", []),
            category=analysis_data.get("category", "Other"),
            importance_score=analysis_data.get("importance_score", 0.5),
            cover_image=video_info.get("thumbnail", ""),
            content_type="video",
            extra_data=extra_data,
            audio_url=audio_url,
            published_date=date.today(),
        )
        db.add(card)
        action = "created"
    else:
        card = existing_card
        card.title = analysis_data.get("title", video_info.get("title", card.title))
        card.summary = analysis_data.get("summary", "")
        card.key_points = analysis_data.get("key_points", [])
        card.source_urls = [video_url]
        card.tags = analysis_data.get("tags", [])
        card.category = analysis_data.get("category", "Other")
        card.importance_score = analysis_data.get("importance_score", 0.5)
        card.cover_image = video_info.get("thumbnail", "")
        card.content_type = "video"
        card.extra_data = extra_data
        card.audio_url = audio_url
        card.published_date = date.today()
        action = "updated"

    await db.flush()
    await db.refresh(card)

    logger.info("[VideoExtractor] Card %s: id=%s, title=%s", action, card.id, card.title)
    return card
