from __future__ import annotations

import asyncio
import mimetypes
import uuid
from pathlib import Path, PurePosixPath

import boto3
from botocore.config import Config as BotoConfig
from fastapi import HTTPException, UploadFile

from app.config import get_settings
from app.database import async_session
from app.models import Agent
from sqlalchemy import select
from sqlalchemy import desc

settings = get_settings()
LOCAL_ASSET_ROOT = Path(settings.newsroom_tenant_root).expanduser() / "assets" / settings.minio_bucket


class ImageGenerationError(Exception):
    def __init__(self, code: str, status_code: int = 500):
        super().__init__(code)
        self.code = code
        self.status_code = status_code


s3_client = boto3.client(
    "s3",
    endpoint_url=settings.minio_endpoint,
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key,
    region_name="us-east-1",
    config=BotoConfig(s3={"addressing_style": "path"}),
)


def build_public_asset_url(filename: str) -> str:
    # Keep one public URL shape for local dev, Docker, and Nginx deployments.
    return f"/{settings.minio_bucket}/{filename}"


def build_public_image_url(filename: str) -> str:
    return build_public_asset_url(filename)


def _safe_asset_key(filename: str) -> str:
    path = PurePosixPath(filename)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise HTTPException(status_code=404, detail="Asset not found")
    return "/".join(path.parts)


def _local_asset_path(filename: str) -> Path:
    key = _safe_asset_key(filename)
    return LOCAL_ASSET_ROOT.joinpath(*key.split("/"))


def _guess_mime_type(filename: str, fallback: str = "application/octet-stream") -> str:
    return mimetypes.guess_type(filename)[0] or fallback


def _write_local_asset(filename: str, content: bytes) -> None:
    path = _local_asset_path(filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def _read_local_asset(filename: str) -> tuple[bytes, str] | None:
    path = _local_asset_path(filename)
    if not path.is_file():
        return None
    return path.read_bytes(), _guess_mime_type(filename)


async def store_asset_bytes(filename: str, content: bytes, content_type: str) -> None:
    try:
        await asyncio.to_thread(
            s3_client.put_object,
            Bucket=settings.minio_bucket,
            Key=_safe_asset_key(filename),
            Body=content,
            ContentType=content_type,
        )
    except Exception:
        await asyncio.to_thread(_write_local_asset, filename, content)


async def read_image_asset(filename: str) -> tuple[bytes, str]:
    local_asset = await asyncio.to_thread(_read_local_asset, filename)
    if local_asset:
        return local_asset

    key = _safe_asset_key(filename)
    try:
        obj = await asyncio.to_thread(
            s3_client.get_object,
            Bucket=settings.minio_bucket,
            Key=key,
        )
        body = await asyncio.to_thread(obj["Body"].read)
        content_type = obj.get("ContentType") or _guess_mime_type(filename)
        return body, content_type
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Asset not found") from exc


async def delete_asset_file(filename: str) -> None:
    path = _local_asset_path(filename)
    if path.is_file():
        await asyncio.to_thread(path.unlink)

    try:
        await asyncio.to_thread(
            s3_client.delete_object,
            Bucket=settings.minio_bucket,
            Key=_safe_asset_key(filename),
        )
    except Exception:
        return


async def upload_image_file(file: UploadFile) -> dict[str, str]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    ext = (file.filename or "image.png").rsplit(".", 1)[-1] if file.filename else "png"
    filename = f"img_{uuid.uuid4().hex[:8]}.{ext}"

    try:
        await store_asset_bytes(filename, content, file.content_type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Image upload failed") from exc

    return {"url": build_public_image_url(filename)}


async def delete_image_file(filename: str) -> dict[str, str]:
    try:
        await delete_asset_file(filename)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Image deletion failed") from exc

    return {"message": "Deleted successfully"}


async def get_image_generation_settings(db, user_id: int) -> tuple[str, str, str | None]:
    from app.services.agent_service import ensure_default_agents_for_user

    await ensure_default_agents_for_user(db, user_id)
    result = await db.execute(
        select(Agent)
        .where(
            Agent.owner_user_id == user_id,
            Agent.role == "illustrator",
        )
        .order_by(desc(Agent.is_active), desc(Agent.created_at))
        .limit(1)
    )
    illustrator = result.scalar_one_or_none()

    style_prefix = ""
    model_ref = "gemini-2.5-flash-image"
    agent_api_key: str | None = None
    if illustrator:
        if illustrator.system_prompt:
            style_prefix = illustrator.system_prompt.strip() + "\n\n"
        if illustrator.model_ref:
            model_ref = illustrator.model_ref
        from app.services.provider_resolution import resolve_agent_api_key
        resolved = await resolve_agent_api_key(illustrator, db)
        agent_api_key = resolved or illustrator.api_key

    return style_prefix, model_ref, agent_api_key


async def generate_image_asset(prompt: str, aspect_ratio: str = "16:9", user_id: int | None = None) -> dict[str, str]:
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")

    style_prefix = ""
    model_ref = "gemini-2.5-flash-image"
    agent_api_key: str | None = None

    if user_id is not None:
        async with async_session() as db:
            style_prefix, model_ref, agent_api_key = await get_image_generation_settings(db, user_id)

    final_prompt = style_prefix + prompt

    try:
        if model_ref.startswith("qwen-image") or model_ref.startswith("z-image"):
            image_bytes, mime_type = await _generate_qwen(
                final_prompt, model_ref, agent_api_key, aspect_ratio
            )
        else:
            image_bytes, mime_type = await _generate_gemini(
                final_prompt, model_ref, agent_api_key
            )

        ext = (
            "png"
            if "png" in mime_type
            else "jpg"
            if "jpeg" in mime_type
            else "webp"
            if "webp" in mime_type
            else "png"
        )
        filename = f"gen_img_{uuid.uuid4().hex[:8]}.{ext}"

        await store_asset_bytes(filename, image_bytes, mime_type)
        return {"url": build_public_image_url(filename)}
    except HTTPException:
        raise
    except ImageGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.code) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="IMAGE_GENERATION_FAILED") from exc


async def _generate_gemini(
    prompt: str, model: str, api_key: str | None
) -> tuple[bytes, str]:
    from google import genai
    from google.genai import types

    if not api_key:
        raise ImageGenerationError("IMAGE_API_KEY_MISSING", 400)

    client = genai.Client(api_key=api_key)
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data:
            return part.inline_data.data, (part.inline_data.mime_type or "image/png")

    raise ImageGenerationError("IMAGE_PROVIDER_NO_IMAGE", 502)


async def _generate_qwen(
    prompt: str,
    model: str,
    api_key: str | None,
    aspect_ratio: str = "16:9",
) -> tuple[bytes, str]:
    import httpx

    if not api_key:
        raise ImageGenerationError("IMAGE_API_KEY_MISSING", 400)

    size_map = {
        "16:9": "2688*1536",
        "9:16": "1536*2688",
        "1:1": "2048*2048",
        "4:3": "2368*1728",
        "3:4": "1728*2368",
    }
    size = size_map.get(aspect_ratio, "2688*1536")

    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ]
        },
        "parameters": {
            "negative_prompt": "低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。",
            "prompt_extend": False,
            "watermark": False,
            "size": size,
            "n": 1,
        },
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=payload, headers=headers)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in {401, 403}:
                raise ImageGenerationError("IMAGE_API_AUTH_FAILED", 401) from exc
            if status_code == 429:
                raise ImageGenerationError("IMAGE_API_RATE_LIMITED", 429) from exc
            raise ImageGenerationError("IMAGE_PROVIDER_UNAVAILABLE", 502) from exc
        data = resp.json()

    try:
        image_url = data["output"]["choices"][0]["message"]["content"][0]["image"]
    except (KeyError, IndexError) as exc:
        raise ImageGenerationError("IMAGE_PROVIDER_NO_IMAGE", 502) from exc

    async with httpx.AsyncClient(timeout=60) as client:
        img_resp = await client.get(image_url)
        try:
            img_resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise ImageGenerationError("IMAGE_PROVIDER_UNAVAILABLE", 502) from exc
        return img_resp.content, "image/png"
