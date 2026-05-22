import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model_defs.auth import User

logger = logging.getLogger(__name__)


ClerkUserData = dict[str, Any]


def _clerk_admin_emails() -> set[str]:
    from app.config import get_settings

    return {
        email.strip().lower()
        for email in get_settings().clerk_admin_emails.split(",")
        if email.strip()
    }


def role_codes_for_clerk_email(email: str | None) -> list[str]:
    if email and email.lower() in _clerk_admin_emails():
        return ["super_admin"]
    return ["user"]


def extract_primary_email(data: ClerkUserData) -> str | None:
    primary_email_id = data.get("primary_email_address_id")
    email_addresses = data.get("email_addresses") or []

    for email_address in email_addresses:
        if email_address.get("id") == primary_email_id:
            email = email_address.get("email_address")
            return email.lower() if isinstance(email, str) else None

    for email_address in email_addresses:
        email = email_address.get("email_address")
        if isinstance(email, str) and email:
            return email.lower()

    return None


def extract_display_name(data: ClerkUserData, email: str | None) -> str:
    metadata = data.get("unsafe_metadata") or data.get("public_metadata") or {}
    if isinstance(metadata, dict):
        newsroom_username = (metadata.get("newsroom_username") or "").strip()
        if newsroom_username:
            return newsroom_username

    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    full_name = " ".join(part for part in (first_name, last_name) if part)
    if full_name:
        return full_name

    username = (data.get("username") or "").strip()
    if username:
        return username

    if email:
        return email.split("@", 1)[0]

    return "User"


def _base_username(data: ClerkUserData, email: str | None, clerk_user_id: str) -> str:
    metadata = data.get("unsafe_metadata") or data.get("public_metadata") or {}
    if isinstance(metadata, dict):
        newsroom_username = (metadata.get("newsroom_username") or "").strip()
        if newsroom_username:
            return newsroom_username[:64]

    username = (data.get("username") or "").strip()
    if username:
        return username[:64]
    if email:
        return email.split("@", 1)[0][:64]
    return f"clerk_{clerk_user_id[:8]}"


async def derive_unique_username(
    db: AsyncSession,
    data: ClerkUserData,
    email: str | None,
    clerk_user_id: str,
    current_user_id: int | None = None,
) -> str:
    base = _base_username(data, email, clerk_user_id).strip() or f"clerk_{clerk_user_id[:8]}"
    candidates = [base[:64], f"{base[:55]}_{clerk_user_id[:8]}", f"u_{clerk_user_id[:12]}"]

    for candidate in candidates:
        result = await db.execute(select(User).where(User.username == candidate))
        existing = result.scalars().first()
        if not existing or existing.id == current_user_id:
            return candidate

    return f"u_{clerk_user_id[:8]}_{int(datetime.now(UTC).timestamp())}"[:64]


async def sync_clerk_user_created_or_updated(db: AsyncSession, data: ClerkUserData) -> User | None:
    from app.services.agent_service import ensure_default_agents_for_user
    from app.services.activation_code_service import (
        activation_role_codes_for_email,
        mark_redemption_completed_for_clerk_user,
    )
    from app.services.auth_service import assign_roles_to_user

    clerk_user_id = data.get("id") or data.get("sub")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        logger.warning("Clerk sync skipped: missing user id")
        return None

    email = extract_primary_email(data)
    display_name = extract_display_name(data, email)

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalars().first()

    if not user and email:
        email_result = await db.execute(select(User).where(User.email == email))
        email_user = email_result.scalars().first()
        if email_user:
            can_relink = (
                email_user.clerk_user_id is None
                or email_user.clerk_deleted_at is not None
                or not email_user.is_active
            )
            if can_relink:
                user = email_user
            else:
                logger.warning(
                    "Clerk sync conflict: email %s already belongs to active user %s linked to Clerk %s",
                    email,
                    email_user.id,
                    email_user.clerk_user_id,
                )
                return email_user

    if user:
        was_inactive = not user.is_active or user.clerk_deleted_at is not None
        user.clerk_user_id = clerk_user_id
        if email:
            user.email = email
        user.display_name = display_name
        user.username = await derive_unique_username(db, data, email, clerk_user_id, current_user_id=user.id)
        user.password_hash = None
        user.is_active = True
        user.clerk_deleted_at = None
        role_codes = role_codes_for_clerk_email(email)
        if "super_admin" not in role_codes:
            activation_role_codes = await activation_role_codes_for_email(db, email)
            if activation_role_codes and was_inactive:
                await assign_roles_to_user(user.id, activation_role_codes, db)
        await ensure_default_agents_for_user(db, user.id)
        await mark_redemption_completed_for_clerk_user(db, email, clerk_user_id)
        await db.flush()
        return user

    role_codes = role_codes_for_clerk_email(email)
    if "super_admin" not in role_codes:
        activation_role_codes = await activation_role_codes_for_email(db, email)
        role_codes = activation_role_codes or role_codes
    username = await derive_unique_username(db, data, email, clerk_user_id)
    user = User(
        username=username,
        email=email or f"{clerk_user_id}@clerk.placeholder",
        display_name=display_name,
        password_hash=None,
        clerk_user_id=clerk_user_id,
        clerk_deleted_at=None,
        is_active=True,
        last_login_at=datetime.now(UTC),
    )
    db.add(user)
    await db.flush()
    await assign_roles_to_user(user.id, role_codes, db)
    await ensure_default_agents_for_user(db, user.id)
    await mark_redemption_completed_for_clerk_user(db, email, clerk_user_id)
    await db.flush()
    return user


async def disable_user_for_clerk_delete(db: AsyncSession, data: ClerkUserData) -> User | None:
    clerk_user_id = data.get("id")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        logger.warning("Clerk delete sync skipped: missing user id")
        return None

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalars().first()
    if not user:
        return None

    user.is_active = False
    user.clerk_deleted_at = datetime.now(UTC)
    await db.flush()
    return user
