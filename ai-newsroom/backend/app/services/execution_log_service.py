from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SyncSession
from app.model_defs.plugins import AgentRunEvent


def append_run_event_sync(
    db,
    *,
    owner_user_id: int,
    task_id: int | None,
    job_id: str,
    run_id: str,
    phase: str,
    event_type: str,
    level: str,
    message: str,
    payload_json: dict | None,
    seq: int,
) -> AgentRunEvent:
    event = AgentRunEvent(
        owner_user_id=owner_user_id,
        task_id=task_id,
        job_id=job_id,
        run_id=run_id,
        phase=phase,
        event_type=event_type,
        level=level,
        message=message,
        payload_json=payload_json or {},
        seq=seq,
    )
    db.add(event)
    db.flush()
    return event


async def append_run_event(
    db: AsyncSession,
    *,
    owner_user_id: int,
    task_id: int | None,
    job_id: str,
    run_id: str,
    phase: str,
    event_type: str,
    level: str,
    message: str,
    payload_json: dict | None,
    seq: int,
) -> AgentRunEvent:
    event = AgentRunEvent(
        owner_user_id=owner_user_id,
        task_id=task_id,
        job_id=job_id,
        run_id=run_id,
        phase=phase,
        event_type=event_type,
        level=level,
        message=message,
        payload_json=payload_json or {},
        seq=seq,
    )
    db.add(event)
    await db.flush()
    return event


async def get_latest_task_run_events(
    db: AsyncSession,
    owner_user_id: int,
    task_id: int,
) -> list[AgentRunEvent]:
    latest_run_result = await db.execute(
        select(AgentRunEvent.run_id)
        .where(
            AgentRunEvent.owner_user_id == owner_user_id,
            AgentRunEvent.task_id == task_id,
        )
        .order_by(AgentRunEvent.created_at.desc(), AgentRunEvent.seq.desc())
        .limit(1)
    )
    run_id = latest_run_result.scalar_one_or_none()
    if not run_id:
        return []
    result = await db.execute(
        select(AgentRunEvent)
        .where(
            AgentRunEvent.owner_user_id == owner_user_id,
            AgentRunEvent.task_id == task_id,
            AgentRunEvent.run_id == run_id,
        )
        .order_by(AgentRunEvent.seq.asc(), AgentRunEvent.created_at.asc())
    )
    return list(result.scalars().all())


async def get_job_run_events_since(
    db: AsyncSession,
    owner_user_id: int,
    job_id: str,
    after_seq: int = 0,
) -> list[AgentRunEvent]:
    result = await db.execute(
        select(AgentRunEvent)
        .where(
            AgentRunEvent.owner_user_id == owner_user_id,
            AgentRunEvent.job_id == job_id,
            AgentRunEvent.seq > after_seq,
        )
        .order_by(AgentRunEvent.seq.asc(), AgentRunEvent.created_at.asc())
    )
    return list(result.scalars().all())


def get_latest_task_run_events_sync(owner_user_id: int, task_id: int) -> list[AgentRunEvent]:
    with SyncSession() as db:
        latest_run_result = db.execute(
            select(AgentRunEvent.run_id)
            .where(
                AgentRunEvent.owner_user_id == owner_user_id,
                AgentRunEvent.task_id == task_id,
            )
            .order_by(AgentRunEvent.created_at.desc(), AgentRunEvent.seq.desc())
            .limit(1)
        )
        run_id = latest_run_result.scalar_one_or_none()
        if not run_id:
            return []
        result = db.execute(
            select(AgentRunEvent)
            .where(
                AgentRunEvent.owner_user_id == owner_user_id,
                AgentRunEvent.task_id == task_id,
                AgentRunEvent.run_id == run_id,
            )
            .order_by(AgentRunEvent.seq.asc(), AgentRunEvent.created_at.asc())
        )
        return list(result.scalars().all())
