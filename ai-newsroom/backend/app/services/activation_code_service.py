import hashlib
import hmac
import re
import secrets
import time
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.model_defs.auth import ActivationCode, ActivationCodeRedemption, Role, User
from app.schema_defs.activation_codes import (
    ActivationCodeApprovalRequest,
    ActivationCodeApprovalResponse,
    ActivationCodeCreate,
    ActivationCodeOut,
    ActivationCodeRedemptionOut,
    ActivationCodeUpdate,
)


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")
_RATE_LIMIT_WINDOW_SECONDS = 10 * 60
_RATE_LIMIT_MAX_FAILURES = 8
_failed_activation_attempts: dict[str, list[float]] = {}


def normalize_activation_code(value: str) -> str:
    return re.sub(r"[\s-]+", "", value.strip()).upper()


def normalize_email(value: str) -> str:
    return value.strip().lower()


def hash_activation_code(value: str) -> str:
    settings = get_settings()
    normalized = normalize_activation_code(value)
    return hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def generate_activation_code() -> str:
    raw = secrets.token_hex(6).upper()
    return f"NR-{raw[:4]}-{raw[4:8]}-{raw[8:12]}"


def code_hint(value: str) -> str:
    normalized = normalize_activation_code(value)
    if len(normalized) <= 6:
        return f"***{normalized[-2:]}"
    return f"{normalized[:2]}***{normalized[-4:]}"


def _remaining_uses(code: ActivationCode) -> int | None:
    if code.max_uses is None:
        return None
    return max(0, int(code.max_uses) - int(code.used_count or 0))


def serialize_activation_code(code: ActivationCode, plain_code: str | None = None) -> ActivationCodeOut:
    return ActivationCodeOut(
        id=code.id,
        name=code.name,
        code_value=code.code_value,
        code_hint=code.code_hint,
        plain_code=plain_code,
        max_uses=code.max_uses,
        used_count=code.used_count or 0,
        remaining_uses=_remaining_uses(code),
        expires_at=code.expires_at,
        is_active=bool(code.is_active),
        default_role_code=code.default_role_code,
        note=code.note,
        created_at=code.created_at,
        updated_at=code.updated_at,
    )


def serialize_redemption(
    redemption: ActivationCodeRedemption,
    activation_code_name: str | None = None,
) -> ActivationCodeRedemptionOut:
    return ActivationCodeRedemptionOut(
        id=redemption.id,
        activation_code_id=redemption.activation_code_id,
        activation_code_name=activation_code_name,
        email=redemption.email,
        username=redemption.username,
        reason=redemption.reason,
        status=redemption.status,
        clerk_user_id=redemption.clerk_user_id,
        failure_reason=redemption.failure_reason,
        ip_address=redemption.ip_address,
        user_agent=redemption.user_agent,
        created_at=redemption.created_at,
        updated_at=redemption.updated_at,
    )


def _validate_registration_inputs(email: str, username: str) -> None:
    if not _EMAIL_RE.match(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_EMAIL", "message": "请输入有效的邮箱地址。"},
        )
    if not _USERNAME_RE.match(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_USERNAME", "message": "用户名只能包含字母、数字、点、下划线和短横线。"},
        )
    if username.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_USERNAME", "message": "用户名不能是纯数字。"},
        )


def _rate_limit_key(ip_address: str | None, email: str, activation_code: str) -> str:
    return f"{ip_address or 'unknown'}:{email}:{normalize_activation_code(activation_code)}"


def _check_rate_limit(key: str) -> None:
    now = time.monotonic()
    attempts = [ts for ts in _failed_activation_attempts.get(key, []) if now - ts < _RATE_LIMIT_WINDOW_SECONDS]
    _failed_activation_attempts[key] = attempts
    if len(attempts) >= _RATE_LIMIT_MAX_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "ACTIVATION_RATE_LIMITED", "message": "尝试次数过多，请稍后再试。"},
        )


def _record_failed_attempt(key: str) -> None:
    now = time.monotonic()
    attempts = [ts for ts in _failed_activation_attempts.get(key, []) if now - ts < _RATE_LIMIT_WINDOW_SECONDS]
    attempts.append(now)
    _failed_activation_attempts[key] = attempts


async def _ensure_role_exists(db: AsyncSession, role_code: str) -> None:
    if role_code in {"super_admin", "admin"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "ACTIVATION_ROLE_FORBIDDEN", "message": "注册码默认角色不能是管理员。"},
        )
    result = await db.execute(select(Role.id).where(Role.code == role_code))
    if result.scalar() is None:
        raise HTTPException(status_code=400, detail=f"角色不存在: {role_code}")


def _activation_code_invalid_detail(code: str, message: str) -> dict[str, str]:
    return {"code": code, "message": message}


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


async def create_activation_code(
    db: AsyncSession,
    payload: ActivationCodeCreate,
    created_by_user_id: int | None,
) -> ActivationCodeOut:
    await _ensure_role_exists(db, payload.default_role_code)
    plain_code = payload.code.strip() if payload.code else generate_activation_code()
    normalized = normalize_activation_code(plain_code)
    code_hash_value = hash_activation_code(normalized)
    hint = code_hint(normalized)

    duplicate = await db.execute(select(ActivationCode.id).where(ActivationCode.code_hash == code_hash_value))
    if duplicate.scalar() is not None:
        raise HTTPException(status_code=400, detail="注册码已存在")

    code = ActivationCode(
        name=payload.name.strip() if payload.name else hint,
        code_hash=code_hash_value,
        code_value=plain_code,
        code_hint=hint,
        max_uses=payload.max_uses,
        used_count=0,
        expires_at=payload.expires_at,
        is_active=True,
        default_role_code=payload.default_role_code,
        note=payload.note,
        created_by_user_id=created_by_user_id,
    )
    db.add(code)
    await db.commit()
    await db.refresh(code)
    return serialize_activation_code(code, plain_code=plain_code)


async def list_activation_codes(db: AsyncSession) -> list[ActivationCodeOut]:
    result = await db.execute(select(ActivationCode).order_by(ActivationCode.created_at.desc(), ActivationCode.id.desc()))
    return [serialize_activation_code(code) for code in result.scalars().all()]


async def update_activation_code(db: AsyncSession, code_id: int, payload: ActivationCodeUpdate) -> ActivationCodeOut:
    code = await db.get(ActivationCode, code_id)
    if not code:
        raise HTTPException(status_code=404, detail="注册码不存在")

    data = payload.model_dump(exclude_unset=True)
    if "default_role_code" in data and data["default_role_code"]:
        await _ensure_role_exists(db, data["default_role_code"])
    for key, value in data.items():
        setattr(code, key, value)

    await db.commit()
    await db.refresh(code)
    return serialize_activation_code(code)


async def list_activation_code_redemptions(
    db: AsyncSession,
    activation_code_id: int | None = None,
) -> list[ActivationCodeRedemptionOut]:
    stmt = select(ActivationCodeRedemption, ActivationCode.code_value, ActivationCode.code_hint).join(
        ActivationCode,
        ActivationCode.id == ActivationCodeRedemption.activation_code_id,
    )
    if activation_code_id is not None:
        stmt = stmt.where(ActivationCodeRedemption.activation_code_id == activation_code_id)
    stmt = stmt.order_by(ActivationCodeRedemption.created_at.desc(), ActivationCodeRedemption.id.desc())
    result = await db.execute(stmt)
    return [serialize_redemption(redemption, code_value or code_hint) for redemption, code_value, code_hint in result.all()]


async def approve_email_with_activation_code(
    db: AsyncSession,
    payload: ActivationCodeApprovalRequest,
    ip_address: str | None,
    user_agent: str | None,
) -> ActivationCodeApprovalResponse:
    email = normalize_email(payload.email)
    username = payload.username.strip()
    _validate_registration_inputs(email, username)

    rate_key = _rate_limit_key(ip_address, email, payload.activation_code)
    _check_rate_limit(rate_key)

    code_hash_value = hash_activation_code(payload.activation_code)
    result = await db.execute(select(ActivationCode).where(ActivationCode.code_hash == code_hash_value))
    code = result.scalars().first()
    if not code:
        _record_failed_attempt(rate_key)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_activation_code_invalid_detail("ACTIVATION_CODE_INVALID", "注册码无效。"),
        )

    active_user = await db.execute(select(User).where(User.email == email, User.is_active.is_(True)))
    if active_user.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ACCOUNT_EXISTS", "message": "该邮箱已注册，请直接登录。"},
        )

    existing_redemption = await db.execute(
        select(ActivationCodeRedemption).where(
            ActivationCodeRedemption.activation_code_id == code.id,
            ActivationCodeRedemption.email == email,
            ActivationCodeRedemption.status.in_(["approved", "completed"]),
        )
    )
    existing = existing_redemption.scalars().first()
    if existing:
        return ActivationCodeApprovalResponse(
            ok=True,
            redemption_id=existing.id,
            activation_code_id=code.id,
            status=existing.status,
            email=email,
            username=existing.username,
        )

    username_user = await db.execute(select(User).where(User.username == username, User.is_active.is_(True)))
    if username_user.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "USERNAME_EXISTS", "message": "用户名已存在，请更换后重试。"},
        )

    now = datetime.now(UTC)
    if not code.is_active:
        _record_failed_attempt(rate_key)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_activation_code_invalid_detail("ACTIVATION_CODE_DISABLED", "注册码已停用。"),
        )
    if code.expires_at and _as_aware_utc(code.expires_at) < now:
        _record_failed_attempt(rate_key)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_activation_code_invalid_detail("ACTIVATION_CODE_EXPIRED", "注册码已过期。"),
        )
    if code.max_uses is not None and int(code.used_count or 0) >= int(code.max_uses):
        _record_failed_attempt(rate_key)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_activation_code_invalid_detail("ACTIVATION_CODE_USED_UP", "注册码使用次数已用完。"),
        )

    redemption = ActivationCodeRedemption(
        activation_code_id=code.id,
        email=email,
        username=username,
        reason=payload.reason.strip() if payload.reason else None,
        status="approved",
        ip_address=ip_address,
        user_agent=(user_agent or "")[:512] or None,
    )
    db.add(redemption)
    code.used_count = int(code.used_count or 0) + 1
    await db.flush()

    return ActivationCodeApprovalResponse(
        ok=True,
        redemption_id=redemption.id,
        activation_code_id=code.id,
        status="approved",
        email=email,
        username=username,
    )


async def mark_redemption_completed_for_clerk_user(
    db: AsyncSession,
    email: str | None,
    clerk_user_id: str,
) -> None:
    if not email:
        return
    normalized_email = normalize_email(email)
    result = await db.execute(
        select(ActivationCodeRedemption)
        .where(
            ActivationCodeRedemption.email == normalized_email,
            ActivationCodeRedemption.status.in_(["approved"]),
        )
        .order_by(ActivationCodeRedemption.created_at.desc(), ActivationCodeRedemption.id.desc())
    )
    redemption = result.scalars().first()
    if not redemption:
        return
    redemption.status = "completed"
    redemption.clerk_user_id = clerk_user_id
    await db.flush()


async def activation_role_codes_for_email(db: AsyncSession, email: str | None) -> list[str]:
    if not email:
        return []
    normalized_email = normalize_email(email)
    result = await db.execute(
        select(ActivationCode.default_role_code)
        .join(ActivationCodeRedemption, ActivationCodeRedemption.activation_code_id == ActivationCode.id)
        .where(
            ActivationCodeRedemption.email == normalized_email,
            ActivationCodeRedemption.status.in_(["approved", "completed"]),
        )
        .order_by(ActivationCodeRedemption.created_at.desc(), ActivationCodeRedemption.id.desc())
    )
    role_code = result.scalars().first()
    return [role_code] if role_code else []


def activation_metadata_from_clerk_data(data: dict[str, Any]) -> dict[str, Any]:
    raw = data.get("unsafe_metadata") or data.get("public_metadata") or {}
    if not isinstance(raw, dict):
        return {}
    return raw
