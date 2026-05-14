from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.database import get_db
from app.schemas import CardOut
from app.services.auth_service import require_permission
from app.services.card_service import (
    delete_card as delete_card_service,
    get_card_or_404,
    list_card_categories,
    list_cards as list_cards_service,
    list_pinned_cards as list_pinned_cards_service,
    mark_card_read,
    today_cards as today_cards_service,
    toggle_card_archive,
    toggle_pin_card as toggle_pin_card_service,
)

router = APIRouter(prefix="/api/cards", tags=["cards"])

@router.get("", response_model=list[CardOut])
async def list_cards(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await list_cards_service(db, current_user.id, date_from, date_to, category, tag, archived)

@router.get("/today", response_model=list[CardOut])
async def today_cards(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await today_cards_service(db, current_user.id)

@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await list_card_categories(db, current_user.id)

@router.get("/pinned", response_model=list[CardOut])
async def list_pinned(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await list_pinned_cards_service(db, current_user.id, date_from, date_to, category, tag)

@router.patch("/{card_id}/pin")
async def toggle_pin(
    card_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("system.manage")),
):
    return await toggle_pin_card_service(db, current_user.id, card_id)

@router.get("/{card_id}", response_model=CardOut)
async def get_card(
    card_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await get_card_or_404(db, current_user.id, card_id)

@router.patch("/{card_id}/read")
async def mark_read(
    card_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await mark_card_read(db, current_user.id, card_id)

@router.patch("/{card_id}/archive")
async def archive_card(
    card_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await toggle_card_archive(db, current_user.id, card_id)

@router.delete("/{card_id}")
async def delete_card(
    card_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("discover.view")),
):
    return await delete_card_service(db, current_user.id, card_id)
