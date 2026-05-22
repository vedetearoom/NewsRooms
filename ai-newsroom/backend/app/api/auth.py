from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schema_defs.activation_codes import ActivationCodeApprovalRequest, ActivationCodeApprovalResponse
from app.schema_defs.auth import AuthResponse, ChangePasswordRequest, CurrentUserOut, LoginRequest, ProfileUpdate, RegisterRequest
from app.services.activation_code_service import approve_email_with_activation_code
from app.services.auth_service import (
    authenticate_user,
    get_current_user_out,
    register_user,
    resolve_current_user,
    update_own_password,
    update_profile,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, deprecated=True)
async def register(register_in: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await register_user(register_in, db)


@router.post("/activation-code/approve", response_model=ActivationCodeApprovalResponse)
async def approve_with_activation_code(
    payload: ActivationCodeApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    ip_address = forwarded_for or (request.client.host if request.client else None)
    return await approve_email_with_activation_code(
        db,
        payload,
        ip_address=ip_address,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/login", response_model=AuthResponse, deprecated=True)
async def login(login_in: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await authenticate_user(login_in, db)


@router.get("/me", response_model=CurrentUserOut)
async def me(current_user: CurrentUserOut = Depends(get_current_user_out)):
    return current_user


@router.patch("/me", response_model=CurrentUserOut)
async def update_me(
    profile_in: ProfileUpdate,
    current_user=Depends(resolve_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_profile(current_user, profile_in, db)


@router.post("/change-password", response_model=CurrentUserOut, deprecated=True)
async def change_password(
    password_in: ChangePasswordRequest,
    current_user=Depends(resolve_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_own_password(current_user, password_in, db)
