import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.database import get_db
from app.models import Task
from app.services.auth_service import require_permission
from app.services.quota_service import DAILY_AI_RUNS, consume_daily_quota
from app.services.stream_service import (
    ensure_review_job,
    get_cached_review_payload,
    stream_review_events,
    stream_writing_task_events,
)

router = APIRouter(prefix="/api/stream", tags=["stream"])


async def _ensure_task_exists(db: AsyncSession, task_id: int, owner_user_id: int) -> None:
    result = await db.execute(
        select(Task.id).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Task not found")


@router.get("/{task_id}/write")
async def stream_writer(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    await _ensure_task_exists(db, task_id, current_user.id)
    await consume_daily_quota(db, current_user.id, DAILY_AI_RUNS)
    await db.commit()
    return EventSourceResponse(stream_writing_task_events(task_id, current_user.id))


@router.get("/{task_id}/review")
async def stream_assassin(
    task_id: int,
    reviewer_id: Optional[int] = None,
    poll_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("workspace.view")),
):
    await _ensure_task_exists(db, task_id, current_user.id)
    payload = await get_cached_review_payload(task_id, current_user.id)
    if payload:
        async def _cached():
            yield {"event": "start", "data": '{"status":"reviewing"}'}
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

        return EventSourceResponse(_cached())

    if not poll_only:
        await consume_daily_quota(db, current_user.id, DAILY_AI_RUNS)
        await db.commit()
    await ensure_review_job(task_id, current_user.id, reviewer_id, poll_only)
    return EventSourceResponse(stream_review_events(task_id, current_user.id))
