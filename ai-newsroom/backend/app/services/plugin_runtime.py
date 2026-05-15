from __future__ import annotations

import logging
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import SyncSession
from app.job_results import job_failure, job_success
from app.model_defs.plugins import AgentPluginBinding, CustomPlugin
from app.models import Agent, Task
from app.services.execution_log_service import append_run_event_sync
from app.services.hermes_runner import HermesRunConfig, HermesSandboxError, run_hermes_query
from app.services.tenant_paths import (
    ensure_run_artifacts_dir,
    ensure_task_run_dir,
    ensure_user_plugins_root,
    ensure_user_workspace,
    get_run_context_path,
)

logger = logging.getLogger(__name__)


def sync_agent_plugin_state_sync(db, owner_user_id: int, agent_id: int) -> Agent | None:
    agent = db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == owner_user_id)
    ).scalar_one_or_none()
    if not agent:
        return None
    enabled_count = db.execute(
        select(AgentPluginBinding.id).where(
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.agent_id == agent_id,
            AgentPluginBinding.is_enabled == True,
        )
    ).scalars().all()
    has_plugins = bool(enabled_count)
    agent.execution_mode = "plugin_augmented" if has_plugins else "native"
    agent.sandbox_enabled = has_plugins
    db.flush()
    return agent


async def sync_agent_plugin_state(db: AsyncSession, owner_user_id: int, agent_id: int) -> Agent | None:
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == owner_user_id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        return None
    bindings_result = await db.execute(
        select(AgentPluginBinding.id).where(
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.agent_id == agent_id,
            AgentPluginBinding.is_enabled == True,
        )
    )
    has_plugins = bool(bindings_result.scalars().first())
    agent.execution_mode = "plugin_augmented" if has_plugins else "native"
    agent.sandbox_enabled = has_plugins
    await db.flush()
    return agent


def load_bound_plugins_sync(db, owner_user_id: int, agent_id: int) -> list[tuple[CustomPlugin, AgentPluginBinding]]:
    rows = db.execute(
        select(CustomPlugin, AgentPluginBinding)
        .join(AgentPluginBinding, AgentPluginBinding.plugin_id == CustomPlugin.id)
        .where(
            CustomPlugin.owner_user_id == owner_user_id,
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.agent_id == agent_id,
            AgentPluginBinding.is_enabled == True,
        )
        .order_by(AgentPluginBinding.sort_order.asc(), CustomPlugin.created_at.asc())
    ).all()
    return [(row[0], row[1]) for row in rows]


async def load_bound_plugins(db: AsyncSession, owner_user_id: int, agent_id: int) -> list[tuple[CustomPlugin, AgentPluginBinding]]:
    result = await db.execute(
        select(CustomPlugin, AgentPluginBinding)
        .join(AgentPluginBinding, AgentPluginBinding.plugin_id == CustomPlugin.id)
        .where(
            CustomPlugin.owner_user_id == owner_user_id,
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.agent_id == agent_id,
            AgentPluginBinding.is_enabled == True,
        )
        .order_by(AgentPluginBinding.sort_order.asc(), CustomPlugin.created_at.asc())
    )
    return [(row[0], row[1]) for row in result.all()]


def get_sandbox_image_for_plugins(bindings: list[tuple[CustomPlugin, AgentPluginBinding]]) -> str:
    settings = get_settings()
    return settings.hermes_sandbox_light_image


def run_plugin_prepare_write_job(task_id: int, owner_user_id: int, writer_agent_id: int, job_id: str):
    run_id = str(uuid.uuid4())
    seq = 0

    def log(level: str, event_type: str, message: str, payload_json: dict | None = None):
        nonlocal seq
        seq += 1
        append_run_event_sync(
            db,
            owner_user_id=owner_user_id,
            task_id=task_id,
            job_id=job_id,
            run_id=run_id,
            phase="plugin_prepare_write",
            event_type=event_type,
            level=level,
            message=message,
            payload_json=payload_json,
            seq=seq,
        )
        db.commit()

    with SyncSession() as db:
        task = db.execute(
            select(Task).where(Task.id == task_id, Task.owner_user_id == owner_user_id)
        ).scalar_one_or_none()
        if not task:
            return job_failure("plugin_prepare_write", "Task not found", task_id=task_id)

        agent = db.execute(
            select(Agent).where(Agent.id == writer_agent_id, Agent.owner_user_id == owner_user_id)
        ).scalar_one_or_none()
        if not agent:
            return job_failure("plugin_prepare_write", "Writer agent not found", task_id=task_id)

        if agent.provider_id and not agent.api_key:
            from app.model_defs.providers import ModelProvider
            provider = db.execute(
                select(ModelProvider).where(ModelProvider.id == agent.provider_id)
            ).scalar_one_or_none()
            if provider:
                agent.api_key = provider.api_key

        bindings = load_bound_plugins_sync(db, owner_user_id, writer_agent_id)
        if not bindings:
            return job_success(
                "plugin_prepare_write",
                task_id=task_id,
                writer_agent_id=writer_agent_id,
                run_id=run_id,
                plugin_count=0,
                context_path=None,
                artifacts=[],
            )

        workspace_dir = ensure_user_workspace(owner_user_id)
        plugins_root = ensure_user_plugins_root(owner_user_id)
        run_dir = ensure_task_run_dir(owner_user_id, task_id, run_id)
        artifacts_dir = ensure_run_artifacts_dir(owner_user_id, task_id, run_id)
        context_path = get_run_context_path(owner_user_id, task_id, run_id)
        context_path.write_text("", encoding="utf-8")

        log("info", "start", "Starting sandboxed plugin preparation", {"plugin_count": len(bindings)})

        settings = get_settings()
        provider = "gemini"
        model = "gemini-2.5-flash"
        api_key = (agent.api_key or settings.gemini_api_key or "").strip()
        base_url = None
        from app.services.llm_client import match_provider
        compat = match_provider(agent.model_ref) if agent.model_ref else None
        if compat:
            provider = "custom"
            model = agent.model_ref
            base_url = compat.base_url
            if compat.name == "deepseek":
                api_key = (agent.api_key or settings.deepseek_api_key or "").strip()
            elif compat.name == "alibaba":
                api_key = (agent.api_key or settings.qwen_api_key or "").strip()
            else:
                api_key = (agent.api_key or "").strip()
        elif agent.model_ref:
            model = agent.model_ref

        if not api_key:
            log("error", "error", "No API key available for Hermes execution")
            return job_failure("plugin_prepare_write", "Writer agent API key is not configured for Hermes.")

        missing_plugins = [
            plugin.name
            for plugin, _binding in bindings
            if plugin.install_status != "installed" or not plugin.commit_sha
        ]
        if missing_plugins:
            message = f"Plugins are not ready for execution: {', '.join(missing_plugins)}"
            log("error", "error", message)
            return job_failure("plugin_prepare_write", message, task_id=task_id, writer_agent_id=writer_agent_id)

        hermes_home = run_dir / ".hermes-home"
        sandbox_config = HermesRunConfig(
            hermes_home=hermes_home,
            image=get_sandbox_image_for_plugins(bindings),
            model=model,
            provider=provider,
            api_key=api_key,
            workspace_dir=workspace_dir,
            plugins_dir=plugins_root,
            run_dir=run_dir,
            timeout_seconds=settings.hermes_sandbox_timeout_seconds,
            base_url=base_url,
        )
        prompt = _build_plugin_prepare_prompt(task, bindings)

        stdout_lines: list[str] = []
        try:
            stdout_lines = run_hermes_query(
                sandbox_config,
                prompt,
                on_output=lambda line: log("info", "log", line, None),
            )
        except HermesSandboxError as exc:
            log("error", "error", str(exc), None)
            return job_failure("plugin_prepare_write", str(exc), task_id=task_id, writer_agent_id=writer_agent_id)

        if not context_path.exists() or not context_path.read_text(encoding="utf-8").strip():
            fallback = "\n".join(line for line in stdout_lines if line.strip())[-4000:].strip()
            context_path.write_text(
                fallback or "No structured plugin context was generated.",
                encoding="utf-8",
            )

        artifacts = sorted(
            str(path.relative_to(run_dir))
            for path in artifacts_dir.rglob("*")
            if path.is_file()
        )
        for artifact in artifacts:
            log("info", "artifact", f"Generated artifact: {artifact}", {"artifact": artifact})
        log("info", "done", "Sandboxed plugin preparation completed", {"artifact_count": len(artifacts)})

        return job_success(
            "plugin_prepare_write",
            task_id=task_id,
            writer_agent_id=writer_agent_id,
            run_id=run_id,
            plugin_count=len(bindings),
            context_path=str(context_path),
            artifacts=artifacts,
        )


def _build_plugin_prepare_prompt(
    task: Task,
    bindings: list[tuple[CustomPlugin, AgentPluginBinding]],
) -> str:
    plugin_lines = []
    for plugin, binding in bindings:
        plugin_lines.append(
            f"- Plugin `{plugin.name}` mounted under `/plugins/{plugin.id}/{plugin.commit_sha or 'pending'}`\n"
            f"  entry_hint: {plugin.entry_hint or 'unknown'}\n"
            f"  detected_files: {', '.join((plugin.detected_files or [])[:12])}\n"
            f"  binding_order: {binding.sort_order}"
        )

    custom_instructions = ""
    if task.config and task.config.get("custom_instructions"):
        custom_instructions = f"\nCustom instructions from the user:\n{task.config['custom_instructions']}\n"

    target_language = "en"
    if task.config and task.config.get("language"):
        target_language = str(task.config.get("language"))

    return (
        "You are operating inside a locked-down Docker terminal sandbox.\n"
        "Only inspect mounted plugin code under /plugins. Never attempt to read host secrets or internal network resources.\n"
        "Use the mounted plugins to gather useful context for the writing task.\n"
        f"Current writing task type: {task.task_type}\n"
        f"Current writing task title: {task.title or 'Untitled'}\n"
        f"Target output language: {target_language}\n"
        f"{custom_instructions}"
        "Write the final structured context to `/run/newsroom/context.md`.\n"
        "Put any machine-readable outputs into `/run/newsroom/artifacts`.\n"
        "If a plugin contains SKILL.md or README-like instructions, read that first before executing anything.\n"
        "Do not install dependencies at runtime. Work only with what is already available in the image.\n\n"
        "The context.md file should contain:\n"
        "1. Key facts gathered by the plugins\n"
        "2. Source provenance with URLs or filenames when available\n"
        "3. Any extracted structured insights useful to a downstream writer\n"
        "4. Warnings about missing data or partially successful plugin runs\n\n"
        "Available plugins:\n"
        f"{chr(10).join(plugin_lines)}\n\n"
        "When you are done, briefly summarize what you collected."
    )
