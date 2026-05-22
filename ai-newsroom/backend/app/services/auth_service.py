import base64
import hashlib
import hmac
import json
import logging
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import Select, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.model_defs.auth import Permission, Role, User, role_permissions, user_roles
from app.schema_defs.auth import (
    AuthResponse,
    ChangePasswordRequest,
    CurrentUserOut,
    LoginRequest,
    PermissionOut,
    RegisterRequest,
    RoleOut,
    UserOut,
)
from app.services.quota_service import default_quota_limits, normalize_quota_limits, unlimited_quota_limits


logger = logging.getLogger(__name__)

_clerk_configured: bool | None = None


def _is_clerk_configured() -> bool:
    global _clerk_configured
    if _clerk_configured is None:
        _clerk_configured = bool(settings.clerk_jwks_url or settings.clerk_issuer)
    return _clerk_configured

settings = get_settings()


DEFAULT_PERMISSIONS: list[dict[str, str]] = [
    {"code": "discover.view", "name": "资讯全景", "permission_group": "discover", "description": "允许访问资讯全景模块"},
    {"code": "workspace.view", "name": "工作台", "permission_group": "workspace", "description": "允许访问工作台模块"},
    {"code": "network.view", "name": "情报网络", "permission_group": "network", "description": "允许访问情报网络模块"},
    {"code": "agents.view", "name": "智能体", "permission_group": "agents", "description": "允许访问智能体模块"},
    {"code": "system.manage", "name": "系统管理", "permission_group": "system", "description": "允许访问系统管理，并管理用户和角色"},
]

DEFAULT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "super_admin": {item["code"] for item in DEFAULT_PERMISSIONS},
    "user": {"discover.view", "workspace.view", "network.view", "agents.view"},
}
ALLOWED_PERMISSION_CODES = {item["code"] for item in DEFAULT_PERMISSIONS}


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("utf-8"))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    iterations = 200_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iteration_str, salt, digest = password_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    computed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iteration_str),
    ).hex()
    return hmac.compare_digest(computed, digest)


def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(UTC) + timedelta(hours=settings.auth_token_expire_hours)
    payload = {"sub": user_id, "exp": int(expires_at.timestamp())}
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = f"{_b64url_encode(json.dumps(header).encode('utf-8'))}.{_b64url_encode(json.dumps(payload).encode('utf-8'))}"
    signature = hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict[str, int]:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
        signing_input = f"{encoded_header}.{encoded_payload}"
        expected_signature = hmac.new(
            settings.auth_secret_key.encode("utf-8"),
            signing_input.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(expected_signature, _b64url_decode(encoded_signature)):
            raise ValueError("invalid signature")
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
        if int(payload["exp"]) < int(datetime.now(UTC).timestamp()):
            raise ValueError("token expired")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


async def ensure_default_access_control_data(db: AsyncSession) -> None:
    existing_permissions_list = list((await db.execute(select(Permission))).scalars().all())
    stale_permissions = [permission for permission in existing_permissions_list if permission.code not in ALLOWED_PERMISSION_CODES]
    if stale_permissions:
        stale_ids = [permission.id for permission in stale_permissions]
        await db.execute(delete(role_permissions).where(role_permissions.c.permission_id.in_(stale_ids)))
        await db.execute(delete(Permission).where(Permission.id.in_(stale_ids)))
        await db.flush()

    existing_permissions = {
        permission.code: permission
        for permission in (await db.execute(select(Permission))).scalars().all()
    }
    for permission_data in DEFAULT_PERMISSIONS:
        if permission_data["code"] not in existing_permissions:
            db.add(Permission(**permission_data))
    await db.flush()

    permissions = {
        permission.code: permission
        for permission in (await db.execute(select(Permission))).scalars().all()
    }
    existing_roles = {
        role.code: role
        for role in (await db.execute(select(Role))).scalars().all()
    }
    role_specs = [
        {
            "name": "超级管理员",
            "code": "super_admin",
            "description": "拥有全部系统权限",
            "is_system": True,
            "quota_limits": unlimited_quota_limits(),
        },
        {
            "name": "普通用户",
            "code": "user",
            "description": "默认业务角色，可访问资讯、工作台、情报网络与智能体",
            "is_system": True,
            "quota_limits": default_quota_limits(),
        },
    ]
    for role_data in role_specs:
        if role_data["code"] not in existing_roles:
            db.add(Role(**role_data))
    await db.flush()

    roles = {
        role.code: role
        for role in (await db.execute(select(Role))).scalars().all()
    }
    for role in roles.values():
        if role.quota_limits is None:
            role.quota_limits = unlimited_quota_limits() if role.code == "super_admin" else default_quota_limits()

    legacy_admin_role = roles.get("admin")
    if legacy_admin_role:
        fallback_role = roles["user"]
        assigned_user_ids = list(
            (
                await db.execute(
                    select(user_roles.c.user_id).where(user_roles.c.role_id == legacy_admin_role.id)
                )
            ).scalars().all()
        )
        for user_id in assigned_user_ids:
            has_fallback = await db.execute(
                select(user_roles.c.user_id).where(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == fallback_role.id,
                )
            )
            if not has_fallback.first():
                await db.execute(
                    user_roles.insert().values(user_id=user_id, role_id=fallback_role.id)
                )
        await db.execute(delete(user_roles).where(user_roles.c.role_id == legacy_admin_role.id))
        await db.execute(delete(role_permissions).where(role_permissions.c.role_id == legacy_admin_role.id))
        await db.delete(legacy_admin_role)
        await db.flush()
        roles = {
            role.code: role
            for role in (await db.execute(select(Role))).scalars().all()
        }

    for role_code, permission_codes in DEFAULT_ROLE_PERMISSIONS.items():
        role = roles[role_code]
        current_permission_ids = {
            permission_id
            for permission_id in (
                await db.execute(
                    select(role_permissions.c.permission_id).where(role_permissions.c.role_id == role.id)
                )
            ).scalars().all()
        }
        for permission_code in permission_codes:
            permission = permissions[permission_code]
            if permission.id not in current_permission_ids:
                await db.execute(
                    role_permissions.insert().values(role_id=role.id, permission_id=permission.id)
                )

    existing_admin = await db.execute(
        select(User).where(User.username == settings.default_admin_username)
    )
    admin_user = existing_admin.scalars().first()
    if not admin_user:
        admin_user = User(
            username=settings.default_admin_username,
            email=settings.default_admin_email,
            display_name=settings.default_admin_display_name,
            password_hash=hash_password(settings.default_admin_password),
            is_active=True,
        )
        db.add(admin_user)
        await db.flush()
        await db.execute(
            user_roles.insert().values(user_id=admin_user.id, role_id=roles["super_admin"].id)
        )

    await db.commit()


async def _load_user_permissions(db: AsyncSession, user_id: int) -> list[Permission]:
    result = await db.execute(
        select(Permission)
        .join(role_permissions, role_permissions.c.permission_id == Permission.id)
        .join(user_roles, user_roles.c.role_id == role_permissions.c.role_id)
        .where(user_roles.c.user_id == user_id, Permission.code.in_(ALLOWED_PERMISSION_CODES))
        .order_by(Permission.permission_group.asc(), Permission.code.asc())
    )
    permissions = result.scalars().all()
    seen: set[int] = set()
    deduped: list[Permission] = []
    for permission in permissions:
        if permission.id not in seen:
            seen.add(permission.id)
            deduped.append(permission)
    return deduped


async def load_user_permission_codes(db: AsyncSession, user_id: int) -> set[str]:
    return {permission.code for permission in await _load_user_permissions(db, user_id)}


async def _load_user_roles(db: AsyncSession, user_id: int) -> list[Role]:
    result = await db.execute(
        select(Role)
        .join(user_roles, user_roles.c.role_id == Role.id)
        .where(user_roles.c.user_id == user_id)
        .order_by(Role.created_at.asc())
    )
    return list(result.scalars().all())


async def serialize_role(db: AsyncSession, role: Role) -> RoleOut:
    permissions_result = await db.execute(
        select(Permission)
        .join(role_permissions, role_permissions.c.permission_id == Permission.id)
        .where(role_permissions.c.role_id == role.id, Permission.code.in_(ALLOWED_PERMISSION_CODES))
        .order_by(Permission.permission_group.asc(), Permission.code.asc())
    )
    user_count_result = await db.execute(
        select(func.count()).select_from(user_roles).where(user_roles.c.role_id == role.id)
    )
    return RoleOut(
        id=role.id,
        name=role.name,
        code=role.code,
        description=role.description,
        is_system=role.is_system,
        quota_limits=(
            unlimited_quota_limits()
            if role.code == "super_admin"
            else normalize_quota_limits(role.quota_limits)
        ),
        permissions=[PermissionOut.model_validate(permission) for permission in permissions_result.scalars().all()],
        user_count=int(user_count_result.scalar() or 0),
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


async def serialize_user(db: AsyncSession, user: User) -> UserOut:
    await db.refresh(user)
    roles = await _load_user_roles(db, user.id)
    permissions = await _load_user_permissions(db, user.id)
    serialized_roles = [await serialize_role(db, role) for role in roles]
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        clerk_user_id=user.clerk_user_id,
        is_active=user.is_active,
        roles=serialized_roles,
        permissions=[permission.code for permission in permissions],
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def get_user_by_identity(identity: str, db: AsyncSession) -> User | None:
    result = await db.execute(
        select(User).where((User.username == identity) | (User.email == identity))
    )
    return result.scalars().first()


async def get_role_by_code(role_code: str, db: AsyncSession) -> Role | None:
    result = await db.execute(select(Role).where(Role.code == role_code))
    return result.scalars().first()


async def assign_roles_to_user(user_id: int, role_codes: list[str], db: AsyncSession) -> None:
    role_codes = list(dict.fromkeys(role_codes or ["user"]))
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())

    result = await db.execute(select(Role).where(Role.code.in_(role_codes)))
    roles = list(result.scalars().all())
    found_codes = {role.code for role in roles}
    missing = sorted(set(role_codes) - found_codes)
    if missing:
        raise HTTPException(status_code=400, detail=f"Roles not found: {', '.join(missing)}")

    desired_role_ids = {role.id for role in roles}
    current_role_ids = set(
        (
            await db.execute(
                select(user_roles.c.role_id).where(user_roles.c.user_id == user_id)
            )
        ).scalars().all()
    )
    stale_role_ids = current_role_ids - desired_role_ids
    missing_role_ids = desired_role_ids - current_role_ids

    if stale_role_ids:
        await db.execute(
            user_roles.delete().where(
                user_roles.c.user_id == user_id,
                user_roles.c.role_id.in_(stale_role_ids),
            )
        )
    for role_id in missing_role_ids:
        await db.execute(
            pg_insert(user_roles)
            .values(user_id=user_id, role_id=role_id)
            .on_conflict_do_nothing()
        )


async def authenticate_user(login_in: LoginRequest, db: AsyncSession) -> AuthResponse:
    user = await get_user_by_identity(login_in.username, db)
    if not user or not user.password_hash or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前用户已被禁用")

    user.last_login_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=await serialize_user(db, user))


async def register_user(register_in: RegisterRequest, db: AsyncSession) -> AuthResponse:
    from app.services.agent_service import ensure_default_agents_for_user

    existing_user = await get_user_by_identity(register_in.username, db)
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")

    email_exists = await db.execute(select(User).where(User.email == register_in.email))
    if email_exists.scalars().first():
        raise HTTPException(status_code=400, detail="邮箱已存在")

    user = User(
        username=register_in.username,
        email=register_in.email,
        display_name=register_in.display_name,
        password_hash=hash_password(register_in.password),
        is_active=True,
        last_login_at=datetime.now(UTC),
    )
    db.add(user)
    await db.flush()
    await assign_roles_to_user(user.id, ["user"], db)
    await ensure_default_agents_for_user(db, user.id)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=await serialize_user(db, user))


async def get_or_create_user_from_clerk(
    db: AsyncSession,
    clerk_user_id: str,
    email: str | None = None,
    display_name: str | None = None,
) -> User:
    from app.services.clerk_sync_service import sync_clerk_user_created_or_updated

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalars().first()
    if user:
        now = datetime.now(UTC)
        if not user.last_login_at or now - user.last_login_at > timedelta(minutes=15):
            user.last_login_at = now
            await db.flush()
        return user

    data = {
        "id": clerk_user_id,
        "email_addresses": [{"id": "primary", "email_address": email}] if email else [],
        "primary_email_address_id": "primary" if email else None,
        "first_name": display_name,
    }
    user = await sync_clerk_user_created_or_updated(db, data)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Clerk user")
    user.last_login_at = datetime.now(UTC)
    await db.flush()
    return user


async def update_own_password(current_user: User, password_in: ChangePasswordRequest, db: AsyncSession) -> CurrentUserOut:
    if not verify_password(password_in.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码错误")
    current_user.password_hash = hash_password(password_in.new_password)
    await db.commit()
    await db.refresh(current_user)
    return CurrentUserOut.model_validate(await serialize_user(db, current_user))


async def update_profile(current_user: User, profile_in, db: AsyncSession) -> CurrentUserOut:
    if profile_in.display_name is not None:
        current_user.display_name = profile_in.display_name
    if profile_in.github_token is not None:
        current_user.github_token = profile_in.github_token.strip() or None
    await db.commit()
    await db.refresh(current_user)
    base = await serialize_user(db, current_user)
    return CurrentUserOut(
        **base.model_dump(),
        github_token_set=bool(current_user.github_token),
        github_token_masked=_mask_github_token(current_user.github_token),
    )


async def resolve_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.replace("Bearer ", "", 1)

    # 1) Try legacy local JWT first
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        if sub is not None:
            user = await db.get(User, int(sub))
            if user and user.is_active:
                return user
    except HTTPException:
        pass  # Not a valid local token — try Clerk

    # 2) If Clerk is configured, try verifying as a Clerk JWT
    if _is_clerk_configured():
        from app.services.clerk_auth import verify_clerk_token

        try:
            clerk_payload = await verify_clerk_token(token)
            clerk_user_id = clerk_payload.get("sub")
            if clerk_user_id:
                email = clerk_payload.get("email")
                name = clerk_payload.get("name")
                user = await get_or_create_user_from_clerk(db, clerk_user_id, email=email, display_name=name)
                if not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Account is disabled",
                    )
                return user
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.exception("Failed to sync authenticated Clerk user")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="AUTH_SYNC_FAILED") from exc
        except Exception as exc:
            logger.exception("Unexpected error while resolving Clerk user")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="AUTH_SYNC_FAILED") from exc

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def _mask_github_token(token: str | None) -> str | None:
    if not token:
        return None
    if len(token) <= 8:
        return "****"
    return f"{token[:4]}****{token[-4:]}"


async def get_current_user_out(current_user: User = Depends(resolve_current_user), db: AsyncSession = Depends(get_db)) -> CurrentUserOut:
    base = await serialize_user(db, current_user)
    return CurrentUserOut(
        **base.model_dump(),
        github_token_set=bool(current_user.github_token),
        github_token_masked=_mask_github_token(current_user.github_token),
    )


def require_permission(permission_code: str):
    async def dependency(
        current_user: User = Depends(resolve_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        permissions = await load_user_permission_codes(db, current_user.id)
        if permission_code not in permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return current_user

    return dependency


def build_admin_query() -> Select[tuple[User]]:
    return select(User).order_by(User.created_at.desc(), User.id.desc())
