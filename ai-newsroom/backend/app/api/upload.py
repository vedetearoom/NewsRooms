from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.config import get_settings
from app.database import get_db
from app.services.auth_service import require_permission
from app.services.quota_service import DAILY_IMAGE_GENERATIONS, DAILY_IMAGE_UPLOADS, consume_daily_quota
from app.services.upload_service import (
    delete_image_file,
    generate_image_asset,
    read_image_asset,
    upload_image_file,
)

router = APIRouter(prefix="/api", tags=["upload"])
assets_router = APIRouter(tags=["assets"])
settings = get_settings()


@assets_router.get(f"/{settings.minio_bucket}/{{filename:path}}")
async def get_public_asset(filename: str):
    content, media_type = await read_image_asset(filename)
    return Response(content=content, media_type=media_type)


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    await consume_daily_quota(db, current_user.id, DAILY_IMAGE_UPLOADS)
    await db.commit()
    return await upload_image_file(file)


@router.delete("/upload/{filename}")
async def delete_image(
    filename: str,
    _=Depends(require_permission("workspace.view")),
):
    return await delete_image_file(filename)

class GenerateImageRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"


@router.post("/generate-image")
async def generate_image(
    req: GenerateImageRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    try:
        await consume_daily_quota(db, current_user.id, DAILY_IMAGE_GENERATIONS)
        await db.commit()
        return await generate_image_asset(req.prompt, req.aspect_ratio, current_user.id)
    except HTTPException as exc:
        if isinstance(exc.detail, dict) and str(exc.detail.get("code", "")).startswith("QUOTA_"):
            raise
        # Expected provider/config failures are returned as a business error so
        # browsers do not emit a noisy "Failed to load resource: 500" console line.
        error_code = exc.detail if isinstance(exc.detail, str) else "IMAGE_GENERATION_FAILED"
        return {"ok": False, "error_code": error_code}
