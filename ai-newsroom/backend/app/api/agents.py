from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.schemas import (
    AgentCreate,
    AgentUpdate,
    AgentOut,
    AgentRewriteRequest,
    AgentChatRequest,
    AgentActionProposalOut,
    AgentMessageOut,
    AgentSkillCatalogItemOut,
    AgentThreadChatRequest,
    AgentThreadCreate,
    AgentThreadOut,
)
from app.services.auth_service import require_permission
from app.services.quota_service import DAILY_AGENT_MESSAGES, consume_daily_quota
from app.services.agent_skill_service import list_agent_skill_catalog
from app.services.agent_service import (
    activate_agent_record,
    create_agent_record,
    delete_agent_record,
    get_agent_response_or_404,
    list_agents as list_agent_records,
    rewrite_with_writer,
    stream_chat_with_inspirations,
    update_agent_record,
)
from app.services.agent_workbench_service import (
    approve_agent_action,
    clear_agent_thread_context,
    create_agent_thread,
    delete_agent_thread,
    list_agent_thread_messages,
    list_agent_threads,
    reject_agent_action,
    stream_agent_thread_chat,
)

router = APIRouter(prefix="/api/agents", tags=["agents"])
skills_router = APIRouter(prefix="/api/agent-skills", tags=["agent-skills"])

@router.get("", response_model=List[AgentOut])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await list_agent_records(db, current_user.id)

@router.post("/rewrite")
async def rewrite_text(
    req: AgentRewriteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    await consume_daily_quota(db, current_user.id, DAILY_AGENT_MESSAGES)
    return await rewrite_with_writer(req, db, current_user.id)

@router.post("/chat")
async def chat_with_inspirations(
    req: AgentChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    await consume_daily_quota(db, current_user.id, DAILY_AGENT_MESSAGES)
    await db.commit()
    return StreamingResponse(stream_chat_with_inspirations(req, db, current_user.id), media_type="text/event-stream")


@skills_router.get("/catalog", response_model=list[AgentSkillCatalogItemOut])
async def get_agent_skill_catalog(
    current_user=Depends(require_permission("agents.view")),
):
    return list_agent_skill_catalog()

@router.post("", response_model=AgentOut)
async def create_agent(
    agent_in: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await create_agent_record(agent_in, db, current_user.id)

@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await get_agent_response_or_404(agent_id, db, current_user.id)

@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: int,
    agent_in: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await update_agent_record(agent_id, agent_in, db, current_user.id)

@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await delete_agent_record(agent_id, db, current_user.id)

@router.patch("/{agent_id}/activate", response_model=AgentOut)
async def activate_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await activate_agent_record(agent_id, db, current_user.id)


@router.get("/{agent_id}/threads", response_model=List[AgentThreadOut])
async def get_agent_threads(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await list_agent_threads(db, current_user.id, agent_id)


@router.post("/{agent_id}/threads", response_model=AgentThreadOut)
async def post_agent_thread(
    agent_id: int,
    data: AgentThreadCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await create_agent_thread(db, current_user.id, agent_id, data)


@router.post("/{agent_id}/threads/{thread_id}/clear", response_model=AgentThreadOut)
async def clear_thread_context(
    agent_id: int,
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await clear_agent_thread_context(db, current_user.id, agent_id, thread_id)


@router.delete("/{agent_id}/threads/{thread_id}")
async def delete_thread(
    agent_id: int,
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await delete_agent_thread(db, current_user.id, agent_id, thread_id)


@router.get("/{agent_id}/threads/{thread_id}/messages", response_model=List[AgentMessageOut])
async def get_agent_thread_messages(
    agent_id: int,
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await list_agent_thread_messages(db, current_user.id, agent_id, thread_id)


@router.post("/{agent_id}/threads/{thread_id}/chat")
async def post_agent_thread_chat(
    agent_id: int,
    thread_id: int,
    req: AgentThreadChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    await consume_daily_quota(db, current_user.id, DAILY_AGENT_MESSAGES)
    await db.commit()
    return StreamingResponse(
        stream_agent_thread_chat(req, db, current_user.id, agent_id, thread_id),
        media_type="text/event-stream",
    )


@router.post("/{agent_id}/threads/{thread_id}/actions/{action_id}/approve", response_model=AgentActionProposalOut)
async def approve_thread_action(
    agent_id: int,
    thread_id: int,
    action_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await approve_agent_action(db, current_user.id, agent_id, thread_id, action_id)


@router.post("/{agent_id}/threads/{thread_id}/actions/{action_id}/reject", response_model=AgentActionProposalOut)
async def reject_thread_action(
    agent_id: int,
    thread_id: int,
    action_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agents.view")),
):
    return await reject_agent_action(db, current_user.id, agent_id, thread_id, action_id)
