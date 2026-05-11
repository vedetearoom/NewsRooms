from __future__ import annotations

import asyncio
import json

from sqlalchemy import select

from app.database import async_session
from app.models import Critique, Draft, Task
from app.services.job_dispatcher import dispatch_review_job
from app.services.orchestrator import AgentOrchestrator
from app.task_status import TaskStatus


async def stream_writing_task_events(task_id: int, owner_user_id: int):
    async with async_session() as db:
        orchestrator = AgentOrchestrator(db)
        async for event in orchestrator.stream_writing_task(task_id, owner_user_id):
            yield event


async def get_cached_review_payload(task_id: int, owner_user_id: int) -> dict | None:
    async with async_session() as db:
        draft = await _get_latest_draft(db, task_id, owner_user_id)
        if not draft:
            return None

        critique = await _get_draft_critique(db, draft.id, owner_user_id)
        if not critique or not draft.revised_content:
            return None

        return {
            "critiques": critique.critiques,
            "overall_score": critique.overall_score,
            "overall_comment": critique.overall_comment,
            "revised_content": draft.revised_content,
        }


async def ensure_review_job(task_id: int, owner_user_id: int, reviewer_id: int | None, poll_only: bool) -> None:
    if not poll_only:
        previous_status: str | None = None
        async with async_session() as db:
            task = await _get_task_for_update(db, task_id, owner_user_id)
            if not task:
                return
            if task.status == TaskStatus.REVIEWING.value:
                return
            previous_status = task.status
            task.status = TaskStatus.REVIEWING.value
            await db.commit()

        try:
            await dispatch_review_job(task_id, owner_user_id, reviewer_id)
        except Exception:
            async with async_session() as db:
                task = await _get_task_for_update(db, task_id, owner_user_id)
                if task and task.status == TaskStatus.REVIEWING.value:
                    task.status = previous_status or TaskStatus.WRITTEN.value
                    await db.commit()
            raise


async def stream_review_events(task_id: int, owner_user_id: int):
    yield {"event": "start", "data": '{"status":"reviewing"}'}

    for _ in range(90):
        await asyncio.sleep(2)
        payload = await get_cached_review_payload(task_id, owner_user_id)
        if payload:
            yield {
                "event": "critique",
                "data": json.dumps(
                    {
                        "critiques": payload["critiques"],
                        "overall_score": payload["overall_score"],
                        "overall_comment": payload["overall_comment"],
                    }
                ),
            }
            yield {
                "event": "revised",
                "data": json.dumps({"revised_content": payload["revised_content"]}),
            }
            yield {"event": "done", "data": '{"status":"reviewed"}'}
            return

    yield {"event": "error", "data": '{"message":"Review timed out after 3 minutes"}'}


async def _get_latest_draft(db, task_id: int, owner_user_id: int):
    draft_result = await db.execute(
        select(Draft)
        .where(Draft.task_id == task_id, Draft.owner_user_id == owner_user_id)
        .order_by(Draft.version.desc())
        .limit(1)
    )
    return draft_result.scalar_one_or_none()


async def _get_draft_critique(db, draft_id: int, owner_user_id: int):
    critique_result = await db.execute(
        select(Critique)
        .where(Critique.draft_id == draft_id, Critique.owner_user_id == owner_user_id)
        .order_by(Critique.created_at.desc(), Critique.id.desc())
        .limit(1)
    )
    return critique_result.scalar_one_or_none()


async def _get_task_for_update(db, task_id: int, owner_user_id: int):
    task_result = await db.execute(
        select(Task)
        .where(Task.id == task_id, Task.owner_user_id == owner_user_id)
        .with_for_update()
    )
    return task_result.scalar_one_or_none()
