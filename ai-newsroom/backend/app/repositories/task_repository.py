from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models import AgentRunEvent, Task, Draft, Critique
from app.schemas import TaskCreate, DraftUpdate
from app.task_status import TaskStatus

class TaskRepository:
    def __init__(self, db: AsyncSession, owner_user_id: int):
        self.db = db
        self.owner_user_id = owner_user_id

    async def list_tasks(self) -> Sequence[Task]:
        result = await self.db.execute(
            select(Task)
            .where(Task.owner_user_id == self.owner_user_id)
            .order_by(Task.created_at.desc())
        )
        return result.scalars().all()

    async def create_task(self, data: TaskCreate) -> Task:
        initial_draft = data.initial_draft
        dump = data.model_dump()
        dump.pop("initial_draft", None)
        task = Task(owner_user_id=self.owner_user_id, **dump)
        if not task.title:
            titles = {
                "daily_report": "Daily AI Intelligence Report",
                "twitter_thread": "Twitter/X Thread",
                "newsletter": "Newsletter Edition",
                "deep_dive": "Deep Dive Analysis",
                "summary": "Executive Summary",
                "multi_source_synthesis": "Multi-source Synthesis",
            }
            task.title = titles.get(task.task_type, f"Task: {task.task_type}")
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)
        
        if initial_draft:
            draft = Draft(
                task_id=task.id,
                content=initial_draft,
                version=1,
                owner_user_id=self.owner_user_id,
            )
            self.db.add(draft)
            task.status = TaskStatus.WRITING.value
            await self.db.flush()
            await self.db.refresh(task)
            
        return task

    async def get_by_id(self, task_id: int) -> Optional[Task]:
        result = await self.db.execute(
            select(Task).where(
                Task.id == task_id,
                Task.owner_user_id == self.owner_user_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete(self, task_id: int) -> bool:
        task = await self.get_by_id(task_id)
        if not task:
            return False
        
        await self.db.execute(delete(AgentRunEvent).where(AgentRunEvent.task_id == task_id))
        await self.db.execute(delete(Critique).where(Critique.task_id == task_id))
        await self.db.execute(delete(Draft).where(Draft.task_id == task_id))
        await self.db.delete(task)
        await self.db.commit()
        return True

    async def get_latest_draft(self, task_id: int) -> Optional[Draft]:
        result = await self.db.execute(
            select(Draft)
            .where(Draft.task_id == task_id, Draft.owner_user_id == self.owner_user_id)
            .order_by(Draft.version.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_critique(self, task_id: int) -> Optional[Critique]:
        result = await self.db.execute(
            select(Critique)
            .where(Critique.task_id == task_id, Critique.owner_user_id == self.owner_user_id)
            .order_by(Critique.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def accept_draft(self, task_id: int) -> bool:
        task = await self.get_by_id(task_id)
        if not task:
            return False

        draft = await self.get_latest_draft(task_id)
        if draft and draft.revised_content:
            draft.content = draft.revised_content
            draft.revised_content = None

        task.status = TaskStatus.COMPLETED.value
        await self.db.commit()
        return True

    async def set_status(self, task_id: int, status: str) -> bool:
        task = await self.get_by_id(task_id)
        if not task:
            return False

        task.status = status
        await self.db.commit()
        return True

    async def reset_for_regeneration(self, task_id: int, agent_id: int | None = None) -> bool:
        task = await self.get_by_id(task_id)
        if not task:
            return False

        await self.db.execute(delete(AgentRunEvent).where(AgentRunEvent.task_id == task_id))
        await self.db.execute(delete(Critique).where(Critique.task_id == task_id))
        await self.db.execute(delete(Draft).where(Draft.task_id == task_id))
        
        if agent_id is not None:
            config = dict(task.config or {})
            config["assigned_writer_id"] = agent_id
            task.config = config
            
        task.status = TaskStatus.PENDING.value
        await self.db.commit()
        return True

    async def revert_to_in_progress(self, task_id: int) -> bool:
        task = await self.get_by_id(task_id)
        if not task:
            return False

        # Delete critique records so they won't be re-loaded
        await self.db.execute(delete(Critique).where(Critique.task_id == task_id))
        # Clear revised_content from draft
        draft = await self.get_latest_draft(task_id)
        if draft:
            draft.revised_content = None

        task.status = TaskStatus.WRITING.value
        await self.db.commit()
        return True

    async def update_draft_content(self, task_id: int, data: DraftUpdate) -> bool:
        draft = await self.get_latest_draft(task_id)
        if not draft:
            return False

        draft.content = data.content
        draft.revised_content = None
        await self.db.commit()
        return True

    async def update_title(self, task_id: int, title: str) -> bool:
        task = await self.get_by_id(task_id)
        if not task:
            return False
        task.title = title
        await self.db.commit()
        return True
