import json
import logging
import re
from typing import Any

from google import genai
from google.genai import types

from app.models import Agent, RawArticle

logger = logging.getLogger(__name__)

CHINESE_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")
CHINESE_OUTPUT_RE = re.compile(
    r"(输出|生成|回复|内容|结果|标题|摘要|关键点|标签)[^。！？\n]{0,40}(中文|简体中文)"
    r"|"
    r"(中文|简体中文)[^。！？\n]{0,40}(输出|生成|回复|内容|结果|标题|摘要|关键点|标签)"
    r"|"
    r"(output|respond|write|generate)[^\n.]{0,60}(chinese|simplified chinese)",
    re.IGNORECASE,
)

PROCESS_PROMPT = """You are an intelligence analyst. Analyze the following batch of raw news articles and produce structured intelligence cards.

For each distinct story/topic (group similar articles together), produce one intelligence card as JSON:

{
  "title": "Concise headline (max 80 chars)",
  "summary": "2-3 sentence summary of the key facts",
  "key_points": ["point 1", "point 2", "point 3"],
  "source_urls": ["url1", "url2"],
  "tags": ["tag1", "tag2"],
  "category": "one of: AI, Tech, Business, Science, Policy, Security, Other",
  "importance_score": 0.0 to 1.0
}

Rules:
- Deduplicate: if multiple articles cover the same story, merge them into ONE card
- Focus on facts, not opinions
- importance_score: 1.0 = breaking/critical, 0.5 = notable, 0.1 = minor
- Return a JSON array of cards
- Default language rule: write user-visible fields in the same language as the original articles.
- If HIGH PRIORITY AGENT INSTRUCTIONS specify an output language, that language overrides the default language rule.
- Apply the output language to title, summary, key_points, and tags. Keep source_urls as URLs.

Articles:
"""


def build_articles_text(articles: list[RawArticle]) -> str:
    chunks = []
    for article in articles:
        chunks.append(
            f"\n---\nTitle: {article.title}\nURL: {article.url}\nContent: {(article.content or '')[:2000]}\n"
        )
    return "".join(chunks)


def build_processor_prompt(extractor: Agent | None) -> str:
    sections: list[str] = []
    if extractor and extractor.system_prompt:
        sections.append(
            "=== HIGH PRIORITY AGENT INSTRUCTIONS ===\n"
            "Follow these Agent instructions with higher priority than the default extraction rules below. "
            "If they specify output language, style, or field-level requirements, they override defaults.\n"
            f"{extractor.system_prompt}"
        )
    sections.append(f"=== DEFAULT EXTRACTION RULES ===\n{PROCESS_PROMPT}")
    if extractor and extractor.context_text:
        sections.append(f"=== REFERENCE EXAMPLES ===\n{extractor.context_text}")
    return "\n\n".join(sections)


def infer_agent_output_language(extractor: Agent | None) -> str | None:
    if not extractor:
        return None
    instruction_text = str(getattr(extractor, "system_prompt", "") or "")
    if CHINESE_OUTPUT_RE.search(instruction_text):
        return "zh"
    return None


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    if isinstance(value, str):
        return [value]
    return []


def card_matches_output_language(card_data: dict[str, Any], target_language: str | None) -> bool:
    if target_language != "zh":
        return True

    primary_text = " ".join(
        [
            str(card_data.get("title") or ""),
            str(card_data.get("summary") or ""),
            " ".join(_string_list(card_data.get("key_points"))),
        ]
    )
    return bool(CHINESE_CHAR_RE.search(primary_text))


def cards_match_output_language(cards_data: list[dict[str, Any]], target_language: str | None) -> bool:
    return all(card_matches_output_language(card_data, target_language) for card_data in cards_data)


def get_extractor_api_key(extractor: Agent | None) -> str:
    api_key = extractor.api_key if extractor and getattr(extractor, "api_key", None) else None
    if not api_key:
        raise ValueError("Extractor agent API key is not configured.")
    return api_key


async def generate_cards_response(
    *,
    extractor: Agent | None,
    target_model: str,
    system_prompt: str,
    articles_text: str,
) -> str:
    api_key = get_extractor_api_key(extractor)

    from app.services.llm_client import get_client
    oai_client = get_client(target_model, api_key)
    if oai_client is not None:
        response = await oai_client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": articles_text},
            ],
            temperature=0.3,
            max_tokens=8192,
        )
        return (response.choices[0].message.content or "").strip()

    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model=target_model,
        contents=system_prompt + "\n\n" + articles_text,
        config=types.GenerateContentConfig(
            max_output_tokens=16384,
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )
    return (response.text or "").strip()


async def repair_cards_output_language(
    *,
    extractor: Agent | None,
    target_model: str,
    cards_data: list[dict[str, Any]],
    target_language: str,
) -> list[dict[str, Any]] | None:
    if target_language != "zh":
        return cards_data

    api_key = get_extractor_api_key(extractor)
    repair_prompt = (
        "You are a strict JSON localization repair step.\n"
        "The Agent requires Simplified Chinese output. Rewrite ONLY user-visible fields into Simplified Chinese.\n"
        "Fields to rewrite: title, summary, key_points, tags, category.\n"
        "Preserve source_urls, importance_score, and all factual meaning. Proper nouns may stay in their original form.\n"
        "Return ONLY a valid JSON array with the same number of cards and the same schema. No markdown fences.\n\n"
        f"Cards JSON:\n{json.dumps(cards_data, ensure_ascii=False)}"
    )

    from app.services.llm_client import get_client
    oai_client = get_client(target_model, api_key)
    if oai_client is not None:
        response = await oai_client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": repair_prompt},
            ],
            temperature=0.0,
            max_tokens=8192,
        )
        text = (response.choices[0].message.content or "").strip()
    else:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=target_model,
            contents=repair_prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=8192,
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        text = (response.text or "").strip()

    return parse_cards_response(text)


async def enforce_cards_output_language(
    *,
    extractor: Agent | None,
    target_model: str,
    cards_data: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    target_language = infer_agent_output_language(extractor)
    if not target_language or cards_match_output_language(cards_data, target_language):
        return cards_data

    logger.warning("Card output did not match Agent language requirement; attempting repair.")
    repaired_cards = await repair_cards_output_language(
        extractor=extractor,
        target_model=target_model,
        cards_data=cards_data,
        target_language=target_language,
    )
    if repaired_cards and cards_match_output_language(repaired_cards, target_language):
        return repaired_cards

    raise ValueError("Agent requires Chinese output, but generated cards did not pass the Chinese output gate.")


def parse_cards_response(text: str) -> list[dict[str, Any]] | None:
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    cleaned = re.sub(r"^```(?:json)?\s*\n", "", text, count=1)
    cleaned = re.sub(r"\n```\s*$", "", cleaned).strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    start = text.find("[")
    end = text.rfind("]") + 1
    if start != -1 and end > start:
        try:
            parsed = json.loads(text[start:end])
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError as exc:
            logger.error("JSON parse failed: %s. Substring (first 300 chars): %s", exc, text[start:start + 300])

    logger.error("LLM did not return valid JSON array. Raw response (first 500 chars): %s", text[:500])
    return None


def build_url_to_article_ids(articles: list[RawArticle]) -> dict[str, list[int]]:
    url_to_ids: dict[str, list[int]] = {}
    for article in articles:
        if article.url:
            url_to_ids.setdefault(article.url, []).append(article.id)
    return url_to_ids
