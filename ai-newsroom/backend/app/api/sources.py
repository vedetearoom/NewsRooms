from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import SourceCreate, SourceOut
from app.services.auth_service import require_permission
from app.services.source_service import (
    create_source as create_source_service,
    delete_source as delete_source_service,
    list_sources as list_sources_service,
    toggle_source as toggle_source_service,
    trigger_source_scrape,
    update_source as update_source_service,
)

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("", response_model=list[SourceOut])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await list_sources_service(db, current_user.id)


@router.post("", response_model=SourceOut)
async def create_source(
    data: SourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await create_source_service(db, current_user.id, data)


@router.delete("/{source_id}")
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await delete_source_service(db, current_user.id, source_id)


@router.patch("/{source_id}", response_model=SourceOut)
async def update_source(
    source_id: int,
    data: SourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await update_source_service(db, current_user.id, source_id, data)


@router.patch("/{source_id}/toggle")
async def toggle_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await toggle_source_service(db, current_user.id, source_id)

@router.post("/{source_id}/scrape")
async def manual_scrape_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("network.view")),
):
    return await trigger_source_scrape(db, current_user.id, source_id)
