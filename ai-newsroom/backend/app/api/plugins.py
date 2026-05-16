from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    AgentOut,
    AgentPluginBindRequest,
    PluginInstallQueuedOut,
    PluginInstallRequest,
    PluginOut,
)
from app.services.auth_service import require_permission
from app.services.plugin_service import (
    bind_plugin_to_agent,
    delete_plugin_record,
    get_plugin_output,
    list_plugins,
    queue_plugin_install,
    unbind_plugin_from_agent,
)

router = APIRouter(prefix="/api", tags=["plugins"])


@router.post("/plugins/install", response_model=PluginInstallQueuedOut)
async def install_plugin(
    request: PluginInstallRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await queue_plugin_install(request, db, current_user.id, getattr(current_user, "github_token", None))


@router.get("/plugins", response_model=list[PluginOut])
async def get_plugins(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await list_plugins(db, current_user.id)


@router.get("/plugins/{plugin_id}", response_model=PluginOut)
async def get_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await get_plugin_output(db, current_user.id, plugin_id)


@router.delete("/plugins/{plugin_id}")
async def delete_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await delete_plugin_record(db, current_user.id, plugin_id)


@router.post("/agents/{agent_id}/plugins/{plugin_id}", response_model=AgentOut)
async def attach_plugin_to_agent(
    agent_id: int,
    plugin_id: int,
    binding_in: AgentPluginBindRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await bind_plugin_to_agent(db, current_user.id, agent_id, plugin_id, binding_in)


@router.delete("/agents/{agent_id}/plugins/{plugin_id}", response_model=AgentOut)
async def detach_plugin_from_agent(
    agent_id: int,
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await unbind_plugin_from_agent(db, current_user.id, agent_id, plugin_id)
