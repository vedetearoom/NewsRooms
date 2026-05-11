from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.task_repository import TaskRepository
from app.schemas import AgentRunEventOut, CritiqueOut, DraftOut, DraftUpdate, TaskCreate, TaskOut
from app.services.execution_log_service import get_latest_task_run_events
from app.services.quota_service import TASKS, ensure_resource_quota
from app.task_status import TaskStatus


async def list_tasks(db: AsyncSession, user_id: int) -> list[TaskOut]:
    return await TaskRepository(db, user_id).list_tasks()


async def create_task(db: AsyncSession, user_id: int, data: TaskCreate) -> TaskOut:
    await ensure_resource_quota(db, user_id, TASKS)
    return await TaskRepository(db, user_id).create_task(data)


async def get_task_or_404(db: AsyncSession, user_id: int, task_id: int) -> TaskOut:
    task = await TaskRepository(db, user_id).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def delete_task_or_404(db: AsyncSession, user_id: int, task_id: int) -> dict:
    success = await TaskRepository(db, user_id).delete(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


async def get_latest_draft(db: AsyncSession, user_id: int, task_id: int) -> DraftOut | None:
    return await TaskRepository(db, user_id).get_latest_draft(task_id)


async def get_task_critique(db: AsyncSession, user_id: int, task_id: int) -> CritiqueOut | None:
    return await TaskRepository(db, user_id).get_critique(task_id)


async def accept_task_draft(db: AsyncSession, user_id: int, task_id: int) -> dict:
    success = await TaskRepository(db, user_id).accept_draft(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


async def update_task_draft_content(db: AsyncSession, user_id: int, task_id: int, data: DraftUpdate) -> dict:
    success = await TaskRepository(db, user_id).update_draft_content(task_id, data)
    if not success:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"ok": True}


async def revert_task_to_in_progress(db: AsyncSession, user_id: int, task_id: int) -> dict:
    success = await TaskRepository(db, user_id).revert_to_in_progress(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


async def regenerate_task(db: AsyncSession, user_id: int, task_id: int, agent_id: int | None = None) -> dict:
    success = await TaskRepository(db, user_id).reset_for_regeneration(task_id, agent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


async def translate_task(db: AsyncSession, user_id: int, task_id: int, language: str) -> dict:
    repo = TaskRepository(db, user_id)
    task = await repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    config = dict(task.config or {})
    config["language"] = language
    task.config = config
    await db.commit()

    success = await repo.revert_to_in_progress(task_id)
    return {"ok": success}


async def update_task_title(db: AsyncSession, user_id: int, task_id: int, title: str) -> dict:
    success = await TaskRepository(db, user_id).update_title(task_id, title)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


async def update_task_status(db: AsyncSession, user_id: int, task_id: int, status: str) -> dict:
    repo = TaskRepository(db, user_id)
    if status == TaskStatus.PENDING.value:
        success = await repo.reset_for_regeneration(task_id)
    else:
        success = await repo.set_status(task_id, status)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


async def get_task_execution_log(db: AsyncSession, user_id: int, task_id: int) -> list[AgentRunEventOut]:
    repo = TaskRepository(db, user_id)
    task = await repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    events = await get_latest_task_run_events(db, user_id, task_id)
    return [AgentRunEventOut.model_validate(event) for event in events]
