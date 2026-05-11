import base64
import hashlib
from datetime import datetime, timezone

from fastapi import HTTPException
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import UserPlatformCredential

MONITOR_CREDENTIAL_PLATFORMS = [
    {
        "key": "bilibili",
        "label": "B站",
        "hint": "登录 bilibili.com 后复制浏览器请求头里的完整 Cookie。",
        "base_url": "https://www.bilibili.com",
    },
    {
        "key": "xiaohongshu",
        "label": "小红书",
        "hint": "登录 xiaohongshu.com 后复制浏览器请求头里的完整 Cookie。",
        "base_url": "https://www.xiaohongshu.com",
    },
]

IGNORED_COOKIE_ATTRIBUTES = {
    "path",
    "domain",
    "expires",
    "max-age",
    "samesite",
    "secure",
    "httponly",
    "priority",
    "partitioned",
}


def get_monitor_credential_platforms() -> list[dict[str, str]]:
    return list(MONITOR_CREDENTIAL_PLATFORMS)


def _build_fernet() -> Fernet:
    settings = get_settings()
    secret = settings.credential_encryption_secret or settings.auth_secret_key
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def _mask_cookie(raw_cookie: str) -> str:
    value = raw_cookie.strip()
    if not value:
        return ""
    if len(value) <= 12:
        return f"{value[:2]}...{value[-2:]}"
    return f"{value[:8]}...{value[-6:]}"


def normalize_cookie_header(raw_cookie: str) -> str:
    normalized = raw_cookie.strip().replace("\r\n", "; ").replace("\n", "; ")
    header_name, separator, remainder = normalized.partition(":")
    if separator and header_name.strip().lower() == "cookie":
        normalized = remainder.strip()
    return normalized.strip(" ;")


def _extract_cookie_pairs(raw_cookie: str) -> list[tuple[str, str]]:
    normalized = normalize_cookie_header(raw_cookie)
    if not normalized:
        return []

    pairs: list[tuple[str, str]] = []
    for chunk in normalized.split(";"):
        part = chunk.strip()
        if not part or "=" not in part:
            continue
        key, _, value = part.partition("=")
        key = key.strip()
        if not key or key.lower() in IGNORED_COOKIE_ATTRIBUTES or key.startswith("$"):
            continue
        normalized_value = value.strip()
        if not normalized_value:
            continue
        pairs.append((key, normalized_value))

    return pairs


def validate_cookie_syntax(raw_cookie: str) -> None:
    if not _extract_cookie_pairs(raw_cookie):
        raise HTTPException(status_code=400, detail="Cookie 格式无效，请粘贴完整请求头 Cookie。")


def parse_cookie_pairs(raw_cookie: str) -> list[tuple[str, str]]:
    pairs = _extract_cookie_pairs(raw_cookie)
    if not pairs:
        raise HTTPException(status_code=400, detail="Cookie 格式无效，请粘贴完整请求头 Cookie。")
    return pairs


def encrypt_cookie(raw_cookie: str) -> str:
    return _build_fernet().encrypt(raw_cookie.encode("utf-8")).decode("utf-8")


def decrypt_cookie(ciphertext: str) -> str:
    try:
        return _build_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("无法解密平台 Cookie，请检查 credential_encryption_secret 配置。") from exc


def _get_platform_spec(platform: str) -> dict[str, str]:
    for spec in MONITOR_CREDENTIAL_PLATFORMS:
        if spec["key"] == platform:
            return spec
    raise HTTPException(status_code=404, detail="Unsupported monitor credential platform")


async def list_monitor_credentials(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(
        select(UserPlatformCredential).where(UserPlatformCredential.user_id == user_id)
    )
    rows = {row.platform: row for row in result.scalars().all()}

    platforms = []
    for spec in MONITOR_CREDENTIAL_PLATFORMS:
        row = rows.get(spec["key"])
        platforms.append(
            {
                "key": spec["key"],
                "label": spec["label"],
                "hint": spec["hint"],
                "cookie_masked": row.cookie_masked if row else "",
                "is_configured": bool(row),
                "last_validated_at": row.last_validated_at if row else None,
                "last_validation_status": row.last_validation_status if row else None,
                "last_validation_error": row.last_validation_error if row else None,
            }
        )
    return {"platforms": platforms}


async def upsert_monitor_credential(
    db: AsyncSession,
    user_id: int,
    platform: str,
    raw_cookie: str,
) -> dict:
    spec = _get_platform_spec(platform)
    normalized_cookie = normalize_cookie_header(raw_cookie)
    if not normalized_cookie:
        raise HTTPException(status_code=400, detail="Cookie 不能为空")

    validate_cookie_syntax(normalized_cookie)

    result = await db.execute(
        select(UserPlatformCredential).where(
            UserPlatformCredential.user_id == user_id,
            UserPlatformCredential.platform == platform,
        )
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        row = UserPlatformCredential(
            user_id=user_id,
            platform=platform,
            cookie_ciphertext=encrypt_cookie(normalized_cookie),
            cookie_masked=_mask_cookie(normalized_cookie),
            last_validated_at=now,
            last_validation_status="saved",
            last_validation_error=None,
        )
        db.add(row)
    else:
        row.cookie_ciphertext = encrypt_cookie(normalized_cookie)
        row.cookie_masked = _mask_cookie(normalized_cookie)
        row.last_validated_at = now
        row.last_validation_status = "saved"
        row.last_validation_error = None

    await db.commit()
    await db.refresh(row)
    return {
        "ok": True,
        "message": f"{spec['label']} Cookie 已保存。",
        "platform": platform,
    }


async def delete_monitor_credential(db: AsyncSession, user_id: int, platform: str) -> dict:
    _get_platform_spec(platform)
    result = await db.execute(
        select(UserPlatformCredential).where(
            UserPlatformCredential.user_id == user_id,
            UserPlatformCredential.platform == platform,
        )
    )
    row = result.scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.commit()
    return {"ok": True}


async def get_decrypted_monitor_cookie(db: AsyncSession, user_id: int, platform: str) -> str | None:
    result = await db.execute(
        select(UserPlatformCredential).where(
            UserPlatformCredential.user_id == user_id,
            UserPlatformCredential.platform == platform,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return decrypt_cookie(row.cookie_ciphertext)


async def mark_monitor_credential_validation(
    db: AsyncSession,
    user_id: int,
    platform: str,
    status: str,
    error: str | None = None,
) -> None:
    result = await db.execute(
        select(UserPlatformCredential).where(
            UserPlatformCredential.user_id == user_id,
            UserPlatformCredential.platform == platform,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return

    row.last_validated_at = datetime.now(timezone.utc)
    row.last_validation_status = status
    row.last_validation_error = error
    await db.commit()
