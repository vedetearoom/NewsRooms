from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import AgentRunEventOut, TaskCreate, TaskOut, DraftOut, DraftUpdate, CritiqueOut
from pydantic import BaseModel
from app.task_status import TaskStatus, normalize_task_status
from pydantic import field_validator
from app.services.auth_service import require_permission
from app.services.task_service import (
    accept_task_draft as accept_task_draft_service,
    create_task as create_task_service,
    delete_task_or_404 as delete_task_or_404_service,
    get_latest_draft as get_latest_draft_service,
    get_task_critique as get_task_critique_service,
    get_task_execution_log as get_task_execution_log_service,
    get_task_or_404 as get_task_or_404_service,
    list_tasks as list_tasks_service,
    regenerate_task as regenerate_task_service,
    revert_task_to_in_progress as revert_task_to_in_progress_service,
    translate_task as translate_task_service,
    update_task_draft_content as update_task_draft_content_service,
    update_task_status as update_task_status_service,
    update_task_title as update_task_title_service,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("", response_model=list[TaskOut])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await list_tasks_service(db, current_user.id)

@router.post("", response_model=TaskOut)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await create_task_service(db, current_user.id, data)

@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await get_task_or_404_service(db, current_user.id, task_id)

@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await delete_task_or_404_service(db, current_user.id, task_id)

@router.get("/{task_id}/draft", response_model=Optional[DraftOut])
async def get_latest_draft(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await get_latest_draft_service(db, current_user.id, task_id)

@router.get("/{task_id}/critique", response_model=Optional[CritiqueOut])
async def get_critique(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await get_task_critique_service(db, current_user.id, task_id)


@router.get("/{task_id}/execution-log", response_model=list[AgentRunEventOut])
async def get_execution_log(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    return await get_task_execution_log_service(db, current_user.id, task_id)

@router.patch("/{task_id}/accept")
async def accept_draft(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    """Accept the assassin's revisions and finalize the draft."""
    return await accept_task_draft_service(db, current_user.id, task_id)

@router.patch("/{task_id}/draft")
async def update_draft_content(
    task_id: int,
    data: DraftUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    """Save user's manual edits to the draft content."""
    return await update_task_draft_content_service(db, current_user.id, task_id, data)

@router.patch("/{task_id}/revert")
async def revert_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    """Revert a completed task back to in progress."""
    return await revert_task_to_in_progress_service(db, current_user.id, task_id)

class RegenerateConfig(BaseModel):
    agent_id: Optional[int] = None

@router.patch("/{task_id}/regenerate")
async def regenerate_task(
    task_id: int,
    data: Optional[RegenerateConfig] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    """Reset a task to pending and clear prior draft/review artifacts."""
    agent_id = data.agent_id if data else None
    return await regenerate_task_service(db, current_user.id, task_id, agent_id)

class TranslateConfig(BaseModel):
    language: str

class TitleUpdate(BaseModel):
    title: str

@router.patch("/{task_id}/translate")
async def translate_task(
    task_id: int,
    data: TranslateConfig,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    """Update config language and revert to trigger translation generation."""
    return await translate_task_service(db, current_user.id, task_id, data.language)

@router.patch("/{task_id}/title")
async def update_task_title(
    task_id: int,
    data: TitleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    """Update the task title."""
    return await update_task_title_service(db, current_user.id, task_id, data.title)

class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = normalize_task_status(value)
        if normalized is None:
            raise ValueError("Invalid task status")
        return normalized

@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: int,
    data: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    """Compatibility endpoint for task status updates."""
    return await update_task_status_service(db, current_user.id, task_id, data.status)
