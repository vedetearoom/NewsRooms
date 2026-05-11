from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth_service import resolve_current_user
from app.services.quota_service import build_quota_snapshot

router = APIRouter(prefix="/api/quota", tags=["quota"])


@router.get("")
async def get_quota_snapshot(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(resolve_current_user),
):
    return await build_quota_snapshot(db, current_user.id)
