from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.model_defs.auth import Permission, Role, User, role_permissions, user_roles
from app.schema_defs.auth import (
    RoleCreate,
    RoleOut,
    RoleUpdate,
    UserCreate,
    UserOut,
    UserResetPasswordRequest,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.auth_service import ALLOWED_PERMISSION_CODES, assign_roles_to_user, hash_password, serialize_role, serialize_user
from app.services.quota_service import default_quota_limits, normalize_quota_limits


async def list_users(db: AsyncSession) -> list[UserOut]:
    result = await db.execute(select(User).order_by(User.created_at.desc(), User.id.desc()))
    return [await serialize_user(db, user) for user in result.scalars().all()]


async def create_user(user_in: UserCreate, db: AsyncSession) -> UserOut:
    duplicate_username = await db.execute(select(User).where(User.username == user_in.username))
    if duplicate_username.scalars().first():
        raise HTTPException(status_code=400, detail="用户名已存在")

    duplicate_email = await db.execute(select(User).where(User.email == user_in.email))
    if duplicate_email.scalars().first():
        raise HTTPException(status_code=400, detail="邮箱已存在")

    user = User(
        username=user_in.username,
        email=user_in.email,
        display_name=user_in.display_name,
        password_hash=hash_password(user_in.password),
        is_active=user_in.is_active,
        is_super_admin=False,
    )
    db.add(user)
    await db.flush()
    await assign_roles_to_user(user.id, user_in.role_codes or ["user"], db)
    await db.commit()
    await db.refresh(user)
    return await serialize_user(db, user)


async def get_user_or_404(user_id: int, db: AsyncSession) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


async def update_user(user_id: int, user_in: UserUpdate, db: AsyncSession) -> UserOut:
    user = await get_user_or_404(user_id, db)
    if user.is_super_admin and user_in.is_active is False:
        raise HTTPException(status_code=400, detail="不能禁用超级管理员")

    payload = user_in.model_dump(exclude_unset=True)
    role_codes = payload.pop("role_codes", None)
    for key, value in payload.items():
        setattr(user, key, value)

    if role_codes is not None:
        await assign_roles_to_user(user.id, role_codes, db)

    await db.commit()
    await db.refresh(user)
    return await serialize_user(db, user)


async def update_user_status(user_id: int, status_in: UserStatusUpdate, db: AsyncSession) -> UserOut:
    user = await get_user_or_404(user_id, db)
    if user.is_super_admin and not status_in.is_active:
        raise HTTPException(status_code=400, detail="不能禁用超级管理员")
    user.is_active = status_in.is_active
    await db.commit()
    await db.refresh(user)
    return await serialize_user(db, user)


async def reset_user_password(user_id: int, password_in: UserResetPasswordRequest, db: AsyncSession) -> dict[str, bool]:
    user = await get_user_or_404(user_id, db)
    user.password_hash = hash_password(password_in.new_password)
    await db.commit()
    return {"ok": True}


async def delete_user(user_id: int, current_user_id: int, db: AsyncSession) -> dict[str, bool]:
    user = await get_user_or_404(user_id, db)
    if user.id == current_user_id:
        raise HTTPException(status_code=400, detail="不能删除当前登录账号")
    if user.is_super_admin:
        raise HTTPException(status_code=400, detail="不能删除超级管理员")
    await db.execute(delete(user_roles).where(user_roles.c.user_id == user.id))
    await db.delete(user)
    await db.commit()
    return {"ok": True}


async def list_roles(db: AsyncSession) -> list[RoleOut]:
    result = await db.execute(select(Role).order_by(Role.is_system.desc(), Role.created_at.asc()))
    return [await serialize_role(db, role) for role in result.scalars().all()]


async def get_role_or_404(role_id: int, db: AsyncSession) -> Role:
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    return role


async def _set_role_permissions(role_id: int, permission_codes: list[str], db: AsyncSession) -> None:
    await db.execute(delete(role_permissions).where(role_permissions.c.role_id == role_id))
    if not permission_codes:
        return
    result = await db.execute(select(Permission).where(Permission.code.in_(permission_codes)))
    permissions = list(result.scalars().all())
    found_codes = {permission.code for permission in permissions}
    missing = sorted(set(permission_codes) - found_codes)
    if missing:
        raise HTTPException(status_code=400, detail=f"Permissions not found: {', '.join(missing)}")
    for permission in permissions:
        await db.execute(role_permissions.insert().values(role_id=role_id, permission_id=permission.id))


async def create_role(role_in: RoleCreate, db: AsyncSession) -> RoleOut:
    duplicate = await db.execute(select(Role).where((Role.name == role_in.name) | (Role.code == role_in.code)))
    if duplicate.scalars().first():
        raise HTTPException(status_code=400, detail="角色名称或编码已存在")
    role = Role(
        name=role_in.name,
        code=role_in.code,
        description=role_in.description,
        quota_limits=normalize_quota_limits(role_in.quota_limits) if role_in.quota_limits is not None else default_quota_limits(),
        is_system=False,
    )
    db.add(role)
    await db.flush()
    await _set_role_permissions(role.id, role_in.permission_codes, db)
    await db.commit()
    await db.refresh(role)
    return await serialize_role(db, role)


async def update_role(role_id: int, role_in: RoleUpdate, db: AsyncSession) -> RoleOut:
    role = await get_role_or_404(role_id, db)
    payload = role_in.model_dump(exclude_unset=True)
    permission_codes = payload.pop("permission_codes", None)
    quota_limits = payload.pop("quota_limits", None)
    if role.is_system:
        payload.pop("code", None)
    for key, value in payload.items():
        setattr(role, key, value)
    if permission_codes is not None:
        await _set_role_permissions(role.id, permission_codes, db)
    if quota_limits is not None and role.code != "super_admin":
        role.quota_limits = normalize_quota_limits(quota_limits)
    await db.commit()
    await db.refresh(role)
    return await serialize_role(db, role)


async def delete_role(role_id: int, db: AsyncSession) -> dict[str, bool]:
    role = await get_role_or_404(role_id, db)
    if role.is_system:
        raise HTTPException(status_code=400, detail="系统角色不能删除")
    user_count = await db.execute(select(func.count()).select_from(user_roles).where(user_roles.c.role_id == role.id))
    if int(user_count.scalar() or 0) > 0:
        raise HTTPException(status_code=400, detail="该角色仍分配给用户，无法删除")
    await db.execute(delete(role_permissions).where(role_permissions.c.role_id == role.id))
    await db.delete(role)
    await db.commit()
    return {"ok": True}


async def list_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(
        select(Permission)
        .where(Permission.code.in_(ALLOWED_PERMISSION_CODES))
        .order_by(Permission.permission_group.asc(), Permission.code.asc())
    )
    return list(result.scalars().all())
