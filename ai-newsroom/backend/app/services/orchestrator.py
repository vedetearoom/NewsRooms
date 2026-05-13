import json
import asyncio
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from app.models import Task, Draft, Critique, IntelligenceCard, Agent
from app.services.execution_log_service import get_job_run_events_since
from app.services.job_dispatcher import dispatch_plugin_prepare_write_job
from app.services.job_manager import JobStatus, job_manager
from app.services.quota_service import ACTIVE_BACKGROUND_JOBS, ensure_resource_quota
from app.services.plugin_runtime import load_bound_plugins
from app.services.writer_agent import WriterAgent
from app.services.assassin_agent import AssassinAgent
from app.task_status import TaskStatus

class AgentOrchestrator:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def stream_writing_task(self, task_id: int, owner_user_id: int):
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            yield {"event": "error", "data": json.dumps({"message": "Task not found"})}
            return

        # Fetch selected intelligence cards
        cards = []
        if task.card_ids:
            card_result = await self.db.execute(
                select(IntelligenceCard).where(
                    IntelligenceCard.id.in_(task.card_ids),
                    IntelligenceCard.owner_user_id == owner_user_id,
                )
            )
            cards = card_result.scalars().all()

        inspirations = []
        from app.models import InspirationAsset
        if task.inspiration_ids:
            insp_result = await self.db.execute(
                select(InspirationAsset).where(
                    InspirationAsset.id.in_(task.inspiration_ids),
                    InspirationAsset.owner_user_id == owner_user_id,
                )
            )
            inspirations = insp_result.scalars().all()

        # Update task status
        task.status = TaskStatus.WRITING.value
        await self.db.commit()

        # Create draft record
        draft = Draft(owner_user_id=owner_user_id, task_id=task_id, content="", agent="writer")
        self.db.add(draft)
        await self.db.flush()
        await self.db.refresh(draft)
        draft_id = draft.id

        yield {"event": "start", "data": json.dumps({"draft_id": draft_id, "status": TaskStatus.WRITING.value})}

        # Fetch Writer Agent to inject optional API key override
        from app.services.agent_dispatcher import AgentDispatcher
        assigned_writer_id = task.config.get("assigned_writer_id") if task.config else None
        writer_agent_model = await AgentDispatcher.get_agent(
            self.db,
            agent_id=assigned_writer_id,
            role="writer",
            owner_user_id=owner_user_id,
        )

        writer_api_key = writer_agent_model.api_key if writer_agent_model else None
        agent_prompt = writer_agent_model.system_prompt if writer_agent_model else None
        agent_context = writer_agent_model.context_text if writer_agent_model else None
        agent_model_ref = writer_agent_model.model_ref if writer_agent_model else "gemini-2.5-flash"
        write_config = dict(task.config or {})

        bound_plugins = []
        if writer_agent_model and writer_agent_model.id:
            bound_plugins = await load_bound_plugins(self.db, owner_user_id, writer_agent_model.id)

        if bound_plugins and writer_agent_model and writer_agent_model.id:
            yield {
                "event": "tooling_start",
                "data": json.dumps(
                    {
                        "plugin_count": len(bound_plugins),
                        "writer_agent_id": writer_agent_model.id,
                    }
                ),
            }

            await ensure_resource_quota(self.db, owner_user_id, ACTIVE_BACKGROUND_JOBS)
            job_id = await dispatch_plugin_prepare_write_job(task_id, owner_user_id, writer_agent_model.id)
            last_seq = 0
            job_status = None
            plugin_prepare_error = None

            while True:
                events = await get_job_run_events_since(self.db, owner_user_id, job_id, after_seq=last_seq)
                for event in events:
                    last_seq = max(last_seq, event.seq)
                    payload = {
                        "job_id": job_id,
                        "run_id": event.run_id,
                        "phase": event.phase,
                        "event_type": event.event_type,
                        "level": event.level,
                        "message": event.message,
                        "payload": event.payload_json or {},
                        "seq": event.seq,
                        "created_at": event.created_at.isoformat() if event.created_at else None,
                    }
                    yield {
                        "event": "tool_artifact" if event.event_type == "artifact" else "tool_log",
                        "data": json.dumps(payload),
                    }

                job_status = await job_manager.get_status(job_id)
                normalized_status = str(job_status.get("status")) if job_status else ""
                if normalized_status in {
                    JobStatus.COMPLETED.value,
                    str(JobStatus.COMPLETED),
                    JobStatus.FAILED.value,
                    str(JobStatus.FAILED),
                }:
                    break
                await asyncio.sleep(1)

            final_events = await get_job_run_events_since(self.db, owner_user_id, job_id, after_seq=last_seq)
            for event in final_events:
                last_seq = max(last_seq, event.seq)
                payload = {
                    "job_id": job_id,
                    "run_id": event.run_id,
                    "phase": event.phase,
                    "event_type": event.event_type,
                    "level": event.level,
                    "message": event.message,
                    "payload": event.payload_json or {},
                    "seq": event.seq,
                    "created_at": event.created_at.isoformat() if event.created_at else None,
                }
                yield {
                    "event": "tool_artifact" if event.event_type == "artifact" else "tool_log",
                    "data": json.dumps(payload),
                }

            result_payload = (job_status or {}).get("result") or {}
            normalized_status = str((job_status or {}).get("status") or "")
            if normalized_status in {JobStatus.FAILED.value, str(JobStatus.FAILED)} or result_payload.get("ok") is False:
                plugin_prepare_error = (
                    result_payload.get("error")
                    or (job_status or {}).get("error")
                    or "Plugin preparation failed"
                )

            if plugin_prepare_error:
                task.status = TaskStatus.FAILED.value
                await self.db.commit()
                yield {"event": "error", "data": json.dumps({"message": plugin_prepare_error})}
                return

            context_path = result_payload.get("context_path")
            plugin_artifacts = result_payload.get("artifacts") or []
            plugin_context_markdown = ""
            if context_path:
                try:
                    with open(context_path, encoding="utf-8") as file_obj:
                        plugin_context_markdown = file_obj.read().strip()
                except OSError:
                    plugin_context_markdown = ""

            if plugin_context_markdown:
                write_config["plugin_context_markdown"] = plugin_context_markdown
            if plugin_artifacts:
                write_config["plugin_artifact_manifest"] = plugin_artifacts

            yield {
                "event": "tooling_done",
                "data": json.dumps(
                    {
                        "job_id": job_id,
                        "run_id": result_payload.get("run_id"),
                        "plugin_count": len(bound_plugins),
                        "artifacts": plugin_artifacts,
                    }
                ),
            }

        # Stream from Writer Agent
        full_content = ""
        try:
            writer = WriterAgent(api_key=writer_api_key)
            async for chunk in writer.generate(
                task_type=task.task_type,
                cards=cards,
                inspirations=inspirations,
                config=write_config,
                agent_prompt=agent_prompt,
                agent_context=agent_context,
                model_ref=agent_model_ref
            ):
                full_content += chunk
                yield {"event": "chunk", "data": json.dumps({"text": chunk})}

            # Save completed draft
            draft.content = full_content
            task.status = TaskStatus.WRITTEN.value
            await self.db.commit()

            yield {"event": "done", "data": json.dumps({
                "draft_id": draft_id,
                "status": TaskStatus.WRITTEN.value,
                "content_length": len(full_content),
            })}

        except Exception as e:
            import traceback
            import tempfile
            with open(tempfile.gettempdir() + "/orchestrator_error.log", "w") as f:
                traceback.print_exc(file=f)
            task.status = TaskStatus.FAILED.value
            await self.db.commit()
            yield {"event": "error", "data": json.dumps({"message": str(e)})}

    async def stream_review_task(self, task_id: int, owner_user_id: int, reviewer_id: Optional[int] = None):
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            yield {"event": "error", "data": json.dumps({"message": "Task not found"})}
            return

        # Get latest draft
        draft_result = await self.db.execute(
            select(Draft)
            .where(Draft.task_id == task_id, Draft.owner_user_id == owner_user_id)
            .order_by(Draft.version.desc())
            .limit(1)
        )
        draft = draft_result.scalar_one_or_none()
        if not draft or not draft.content:
            yield {"event": "error", "data": json.dumps({"message": "No draft to review"})}
            return

        # If already reviewed, just stream the existing results
        critique_result = await self.db.execute(
            select(Critique)
            .where(Critique.draft_id == draft.id, Critique.owner_user_id == owner_user_id)
            .order_by(Critique.created_at.desc(), Critique.id.desc())
            .limit(1)
        )
        critique = critique_result.scalar_one_or_none()

        if critique and draft.revised_content:
            yield {"event": "critique", "data": json.dumps({
                "critiques": critique.critiques,
                "overall_score": critique.overall_score,
                "overall_comment": critique.overall_comment
            })}
            yield {"event": "revised", "data": json.dumps({"revised_content": draft.revised_content})}
            yield {"event": "done", "data": json.dumps({"status": "reviewed"})}
            return

        # Otherwise, trigger background review and wait for it
        await self.run_review_background(task_id, owner_user_id, reviewer_id)
        
        # Re-fetch to get the results saved by the background task
        await self.db.refresh(draft)
        critique_result = await self.db.execute(
            select(Critique)
            .where(Critique.draft_id == draft.id, Critique.owner_user_id == owner_user_id)
            .order_by(Critique.created_at.desc(), Critique.id.desc())
            .limit(1)
        )
        critique = critique_result.scalar_one_or_none()

        if critique and draft.revised_content:
            yield {"event": "critique", "data": json.dumps({
                "critiques": critique.critiques,
                "overall_score": critique.overall_score,
                "overall_comment": critique.overall_comment
            })}
            yield {"event": "revised", "data": json.dumps({"revised_content": draft.revised_content})}
            yield {"event": "done", "data": json.dumps({"status": "reviewed"})}
        else:
            yield {"event": "error", "data": json.dumps({"message": "Review failed to complete"})}

    async def run_review_background(self, task_id: int, owner_user_id: int, reviewer_id: Optional[int] = None):
        """Run review as a standalone background task that persists results to DB.
        This method does NOT yield SSE events — it just does the work and saves."""
        import logging
        logger = logging.getLogger(__name__)

        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            logger.error(f"Background review: Task {task_id} not found")
            return

        draft_result = await self.db.execute(
            select(Draft)
            .where(Draft.task_id == task_id, Draft.owner_user_id == owner_user_id)
            .order_by(Draft.version.desc())
            .limit(1)
        )
        draft = draft_result.scalar_one_or_none()
        if not draft or not draft.content:
            logger.error(f"Background review: No draft for task {task_id}")
            return

        task.status = TaskStatus.REVIEWING.value
        await self.db.commit()

        # Fetch Reviewer Agent
        from app.services.agent_dispatcher import AgentDispatcher
        reviewer_agent_model = await AgentDispatcher.get_agent(
            self.db,
            agent_id=reviewer_id,
            role="reviewer",
            owner_user_id=owner_user_id,
        )
            
        reviewer_api_key = reviewer_agent_model.api_key if reviewer_agent_model else None
        agent_prompt = reviewer_agent_model.system_prompt if reviewer_agent_model else None
        agent_context = reviewer_agent_model.context_text if reviewer_agent_model else None
        agent_model_ref = reviewer_agent_model.model_ref if reviewer_agent_model else "gemini-2.5-flash"

        assassin = AssassinAgent(api_key=reviewer_api_key)
        try:
            target_language = task.config.get("language", "en") if task.config else "en"

            critique_coro = assassin.review(
                draft.content, 
                task.task_type, 
                target_language=target_language,
                agent_prompt=agent_prompt,
                agent_context=agent_context,
                model_ref=agent_model_ref
            )
            revise_coro = assassin.revise_standalone(
                draft.content,
                agent_prompt=agent_prompt,
                agent_context=agent_context,
                model_ref=agent_model_ref,
                target_language=target_language
            )

            critique_data, revised = await asyncio.gather(critique_coro, revise_coro)

            await self.db.execute(
                delete(Critique).where(
                    Critique.draft_id == draft.id,
                    Critique.owner_user_id == owner_user_id,
                )
            )
            critique = Critique(
                owner_user_id=owner_user_id,
                task_id=task_id,
                draft_id=draft.id,
                critiques=critique_data.get("critiques", []),
                overall_score=critique_data.get("overall_score"),
                overall_comment=critique_data.get("overall_comment"),
            )
            self.db.add(critique)
            draft.revised_content = revised
            task.status = TaskStatus.WRITTEN.value
            await self.db.commit()

            logger.info(f"Background review completed for task {task_id}")

        except Exception as e:
            logger.error(f"Background review failed for task {task_id}: {e}")
            task.status = TaskStatus.FAILED.value
            await self.db.commit()
