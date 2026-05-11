"""Video transcription module using DashScope Qwen Audio."""

import asyncio
import json
import logging
import re
from openai import AsyncOpenAI

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


import base64
import httpx

async def _generate_json_transcript(
    api_key: str,
    model: str,
    prompt: str,
    file_id_or_path: str,
    *,
    temperature: float,
) -> str:
    logger.info("[QwenTranscriber] Requesting Qwen transcription (timeout=%ss) using model %s", TRANSCRIBE_TIMEOUT_SECONDS, model)
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    if "omni" in model.lower():
        # For Omni models, we use base64 encoding directly from the local file
        audio_path = file_id_or_path
        with open(audio_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")
        
        url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": f"data:audio/mp3;base64,{b64_data}",
                                "format": "mp3"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            "temperature": temperature
        }
    else:
        # For Qwen-Audio native API, we use the uploaded file_id
        file_id = file_id_or_path
        url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
        payload = {
            "model": model,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"audio": file_id},
                            {"text": prompt}
                        ]
                    }
                ]
            },
            "parameters": {
                "temperature": temperature
            }
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=TRANSCRIBE_TIMEOUT_SECONDS)
            result = response.json()
            if response.status_code != 200:
                raise Exception(f"DashScope API Error: {result}")
            
            # Extract text from response based on API format
            try:
                if "omni" in model.lower():
                    return result["choices"][0]["message"]["content"].strip()
                else:
                    return result["output"]["choices"][0]["message"]["content"][0]["text"].strip()
            except (KeyError, IndexError) as e:
                logger.error("[QwenTranscriber] Unexpected response structure: %s", result)
                return ""
    except httpx.TimeoutException as exc:
        logger.error("[QwenTranscriber] Qwen transcription timed out after %ss", TRANSCRIBE_TIMEOUT_SECONDS)
        raise TimeoutError(f"Qwen 转写超时（>{TRANSCRIBE_TIMEOUT_SECONDS} 秒）") from exc
    except Exception as exc:
        logger.error("[QwenTranscriber] Request failed: %s", exc)
        raise

async def transcribe(audio_path: str, api_key: str, model: str = "qwen-audio-turbo-latest") -> list[dict]:
    """Transcribe audio to timestamped text using Qwen multimodal."""
    logger.info(f"[QwenTranscriber] Transcribing audio: {audio_path}")

    is_omni = "omni" in model.lower()
    file_id_or_path = audio_path
    
    if not is_omni:
        client = AsyncOpenAI(
            api_key=api_key, 
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        # Upload local audio to DashScope temporary file service
        logger.info(f"[QwenTranscriber] Uploading audio to DashScope...")
        try:
            with open(audio_path, "rb") as f:
                file_obj = await client.files.create(file=f, purpose="file-extract")
            logger.info(f"[QwenTranscriber] Audio uploaded. File ID: {file_obj.id}")
            file_id_or_path = file_obj.id
        except Exception as e:
            logger.error(f"[QwenTranscriber] Upload failed: {e}")
            return []

    try:
        text = await _generate_json_transcript(
            api_key,
            model,
            TRANSCRIBE_PROMPT,
            file_id_or_path,
            temperature=0.1,
        )
        if not text:
            logger.warning("[QwenTranscriber] Empty transcription response from Qwen")
            return []

        transcript = _parse_json_array(text)

        if not transcript and len(text) > 50:
            logger.warning(f"[QwenTranscriber] JSON parse failed, raw length={len(text)}. Retrying with simpler prompt.")
            text2 = await _generate_json_transcript(
                api_key,
                model,
                "将以下音频内容转录为 JSON 数组。格式：[{\"time\": \"MM:SS\", \"text\": \"内容\"}]。仅输出 JSON。",
                file_id_or_path,
                temperature=0.0,
            )
            transcript = _parse_json_array(text2)

        logger.info(f"[QwenTranscriber] Transcription complete: {len(transcript)} segments")
        return transcript
    finally:
        pass
