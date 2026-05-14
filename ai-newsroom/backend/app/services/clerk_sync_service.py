import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model_defs.auth import User

logger = logging.getLogger(__name__)


ClerkUserData = dict[str, Any]


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
        user.clerk_user_id = clerk_user_id
        if email:
            user.email = email
        user.display_name = display_name
        user.username = await derive_unique_username(db, data, email, clerk_user_id, current_user_id=user.id)
        user.password_hash = None
        user.is_active = True
        user.clerk_deleted_at = None
        await ensure_default_agents_for_user(db, user.id)
        await db.flush()
        return user

    username = await derive_unique_username(db, data, email, clerk_user_id)
    user = User(
        username=username,
        email=email or f"{clerk_user_id}@clerk.placeholder",
        display_name=display_name,
        password_hash=None,
        clerk_user_id=clerk_user_id,
        clerk_deleted_at=None,
        is_active=True,
        is_super_admin=False,
        last_login_at=datetime.now(UTC),
    )
    db.add(user)
    await db.flush()
    await assign_roles_to_user(user.id, ["user"], db)
    await ensure_default_agents_for_user(db, user.id)
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
