"""Video transcription module using Google Gemini."""

import asyncio
import json
import logging
import re
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)
TRANSCRIBE_TIMEOUT_SECONDS = 180

TRANSCRIBE_PROMPT = """请将以下音频完整逐句转录为带时间戳的文本。

输出要求：
- 输出 JSON 数组，格式：[{"time": "MM:SS", "text": "该时间段的文本内容"}]
- 每个片段大约 5-15 秒，按自然语句断句
- 时间戳格式为 MM:SS（如 00:00, 01:23）
- 必须完整转录所有内容，不要遗漏
- 仅输出 JSON，不要添加任何代码块标记或其他文字
"""

def _parse_json_array(text: str) -> list:
    """Robustly parse a JSON array from LLM output."""
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
        except json.JSONDecodeError:
            pass

    logger.error(f"Failed to parse JSON array from: {text[:300]}")
    return []


async def _generate_json_transcript(
    client: genai.Client,
    prompt: str,
    audio_file,
    *,
    temperature: float,
) -> str:
    logger.info("[Transcriber] Requesting Gemini transcription (timeout=%ss)", TRANSCRIBE_TIMEOUT_SECONDS)
    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt, audio_file],
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    response_mime_type="application/json",
                    max_output_tokens=65536,
                ),
            ),
            timeout=TRANSCRIBE_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        logger.error("[Transcriber] Gemini transcription timed out after %ss", TRANSCRIBE_TIMEOUT_SECONDS)
        raise TimeoutError(f"Gemini 转写超时（>{TRANSCRIBE_TIMEOUT_SECONDS} 秒）") from exc

    return response.text.strip() if response.text else ""

async def transcribe(audio_path: str, api_key: str) -> list[dict]:
    """Transcribe audio to timestamped text using Gemini native multimodal."""
    logger.info(f"[Transcriber] Transcribing audio: {audio_path}")

    client = genai.Client(api_key=api_key)
    audio_file = await asyncio.to_thread(client.files.upload, file=audio_path)
    logger.info(f"[Transcriber] Audio uploaded to Gemini: {audio_file.name}")

    text = await _generate_json_transcript(
        client,
        TRANSCRIBE_PROMPT,
        audio_file,
        temperature=0.1,
    )
    if not text:
        logger.warning("[Transcriber] Empty transcription response from Gemini")
        return []

    transcript = _parse_json_array(text)

    if not transcript and len(text) > 50:
        logger.warning(f"[Transcriber] JSON parse failed, raw length={len(text)}. Retrying with simpler prompt.")
        text2 = await _generate_json_transcript(
            client,
            "将以下音频内容转录为 JSON 数组。格式：[{\"time\": \"MM:SS\", \"text\": \"内容\"}]。仅输出 JSON。",
            audio_file,
            temperature=0.0,
        )
        transcript = _parse_json_array(text2)

    logger.info(f"[Transcriber] Transcription complete: {len(transcript)} segments")
    return transcript
