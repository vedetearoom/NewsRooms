from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schema_defs.auth import AuthResponse, ChangePasswordRequest, CurrentUserOut, LoginRequest, RegisterRequest
from app.services.auth_service import (
    authenticate_user,
    get_current_user_out,
    register_user,
    resolve_current_user,
    update_own_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, deprecated=True)
async def register(register_in: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await register_user(register_in, db)


@router.post("/login", response_model=AuthResponse, deprecated=True)
async def login(login_in: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await authenticate_user(login_in, db)


@router.get("/me", response_model=CurrentUserOut)
async def me(current_user: CurrentUserOut = Depends(get_current_user_out)):
    return current_user


@router.post("/change-password", response_model=CurrentUserOut, deprecated=True)
async def change_password(
    password_in: ChangePasswordRequest,
    current_user=Depends(resolve_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_own_password(current_user, password_in, db)
