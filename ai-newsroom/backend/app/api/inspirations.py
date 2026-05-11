from fastapi import APIRouter, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.auth_service import require_permission
from app.services.inspiration_service import (
    create_inspiration_asset,
    delete_inspiration_asset,
    list_inspirations,
)

router = APIRouter(prefix="/api/inspirations", tags=["inspirations"])

class InspirationBase(BaseModel):
    title: str
    hook_text: Optional[str] = None
    hook_technique: Optional[str] = None
    template_skeleton: Optional[str] = None
    source_url: Optional[str] = None
    platform: Optional[str] = None
    author: Optional[str] = None
    tags: Optional[List[str]] = []
    audio_url: Optional[str] = None
    extra_data: Optional[dict] = {}

class InspirationResponse(InspirationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[InspirationResponse])
async def get_inspirations(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    items = await list_inspirations(db, current_user.id)
    return [InspirationResponse.model_validate(item) for item in items]

@router.post("", response_model=InspirationResponse)
async def create_inspiration(
    data: InspirationBase,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    item = await create_inspiration_asset(
        db,
        title=data.title,
        hook_text=data.hook_text,
        hook_technique=data.hook_technique,
        template_skeleton=data.template_skeleton,
        source_url=data.source_url,
        platform=data.platform,
        author=data.author,
        tags=data.tags,
        audio_url=data.audio_url,
        extra_data=data.extra_data,
        owner_user_id=current_user.id,
    )
    return InspirationResponse.model_validate(item)

@router.delete("/{asset_id}")
async def delete_inspiration(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await delete_inspiration_asset(db, asset_id, current_user.id)
