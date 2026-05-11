from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schema_defs.auth import (
    PermissionOut,
    RoleCreate,
    RoleOut,
    RoleUpdate,
    UserCreate,
    UserOut,
    UserResetPasswordRequest,
    UserStatusUpdate,
    UserUpdate,
)
from app.schema_defs.server import (
    RSSHubServerActionResult,
    RSSHubServerConfigOut,
    RSSHubServerConfigUpdateRequest,
)
from app.services.admin_service import (
    create_role,
    create_user,
    delete_role,
    delete_user,
    list_permissions,
    list_roles,
    list_users,
    reset_user_password,
    update_role,
    update_user,
    update_user_status,
)
from app.services.auth_service import require_permission
from app.services.rsshub_manager import (
    get_rsshub_server_config_payload,
    restart_rsshub,
    update_rsshub_server_config,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def get_users(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await list_users(db)


@router.post("/users", response_model=UserOut)
async def post_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await create_user(user_in, db)


@router.patch("/users/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await update_user(user_id, user_in, db)


@router.patch("/users/{user_id}/status", response_model=UserOut)
async def patch_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await update_user_status(user_id, status_in, db)


@router.post("/users/{user_id}/reset-password")
async def post_user_reset_password(
    user_id: int,
    password_in: UserResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await reset_user_password(user_id, password_in, db)


@router.delete("/users/{user_id}")
async def remove_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("system.manage")),
):
    return await delete_user(user_id, current_user.id, db)


@router.get("/roles", response_model=list[RoleOut])
async def get_roles(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await list_roles(db)


@router.post("/roles", response_model=RoleOut)
async def post_role(
    role_in: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await create_role(role_in, db)


@router.patch("/roles/{role_id}", response_model=RoleOut)
async def patch_role(
    role_id: int,
    role_in: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await update_role(role_id, role_in, db)


@router.delete("/roles/{role_id}")
async def remove_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    return await delete_role(role_id, db)


@router.get("/permissions", response_model=list[PermissionOut])
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("system.manage")),
):
    permissions = await list_permissions(db)
    return [PermissionOut.model_validate(permission) for permission in permissions]


@router.get("/server/rsshub", response_model=RSSHubServerConfigOut)
async def get_rsshub_server_config(
    _=Depends(require_permission("system.manage")),
):
    return get_rsshub_server_config_payload()


@router.put("/server/rsshub", response_model=RSSHubServerActionResult)
async def put_rsshub_server_config(
    payload: RSSHubServerConfigUpdateRequest,
    _=Depends(require_permission("system.manage")),
):
    return update_rsshub_server_config(
        payload.cookies,
        restart_after_save=payload.restart_after_save,
    )


@router.post("/server/rsshub/restart", response_model=RSSHubServerActionResult)
async def post_rsshub_restart(
    _=Depends(require_permission("system.manage")),
):
    result = restart_rsshub()
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail=str(result.get("message", "RSSHub 重启失败。")))
    return {
        "ok": bool(result.get("ok")),
        "message": str(result.get("message", "")),
        "restart_required": False,
        "restarted": bool(result.get("ok")),
        "restart_message": str(result.get("message", "")),
    }
