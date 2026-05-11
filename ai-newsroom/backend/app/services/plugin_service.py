from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import PurePosixPath

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SyncSession
from app.job_results import job_failure, job_success
from app.model_defs.plugins import AgentPluginBinding, CustomPlugin
from app.models import Agent
from app.schemas import (
    AgentOut,
    AgentPluginBindRequest,
    AgentPluginSummaryOut,
    PluginInstallQueuedOut,
    PluginInstallRequest,
    PluginOut,
)
from app.services.execution_log_service import append_run_event_sync
from app.services.job_dispatcher import dispatch_plugin_install_job
from app.services.plugin_runtime import sync_agent_plugin_state
from app.services.plugin_source import (
    install_snapshot_from_github,
    parse_github_plugin_source,
    resolve_github_commit_sha,
)
from app.services.tenant_paths import ensure_user_plugins_root, get_plugin_snapshot_dir

logger = logging.getLogger(__name__)


def _derive_plugin_name(requested_name: str | None, repo: str, subdir: str) -> str:
    candidate = (requested_name or "").strip()
    if candidate:
        return candidate
    if subdir.strip("/"):
        return PurePosixPath(subdir.strip("/")).name or repo
    return repo


def plugin_to_out(plugin: CustomPlugin) -> PluginOut:
    return PluginOut.model_validate(plugin)


def plugin_summary_to_out(
    plugin: CustomPlugin,
    binding: AgentPluginBinding,
) -> AgentPluginSummaryOut:
    return AgentPluginSummaryOut(
        id=plugin.id,
        name=plugin.name,
        install_status=plugin.install_status,
        runtime_profile=plugin.runtime_profile,
        source_url=plugin.source_url,
        github_owner=plugin.github_owner,
        github_repo=plugin.github_repo,
        git_ref=plugin.git_ref,
        commit_sha=plugin.commit_sha,
        entry_hint=plugin.entry_hint,
        detected_files=list(plugin.detected_files or []),
        is_enabled=binding.is_enabled,
        sort_order=binding.sort_order,
    )


async def _load_plugin_summary_map(
    db: AsyncSession,
    owner_user_id: int,
    agent_ids: list[int],
) -> dict[int, list[AgentPluginSummaryOut]]:
    if not agent_ids:
        return {}

    result = await db.execute(
        select(CustomPlugin, AgentPluginBinding)
        .join(AgentPluginBinding, AgentPluginBinding.plugin_id == CustomPlugin.id)
        .where(
            CustomPlugin.owner_user_id == owner_user_id,
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.agent_id.in_(agent_ids),
        )
        .order_by(
            AgentPluginBinding.agent_id.asc(),
            AgentPluginBinding.sort_order.asc(),
            CustomPlugin.created_at.asc(),
        )
    )

    summary_map: dict[int, list[AgentPluginSummaryOut]] = {agent_id: [] for agent_id in agent_ids}
    for plugin, binding in result.all():
        summary_map.setdefault(binding.agent_id, []).append(plugin_summary_to_out(plugin, binding))
    return summary_map


def build_agent_out(
    agent: Agent,
    attached_plugins: list[AgentPluginSummaryOut] | None = None,
) -> AgentOut:
    plugins = attached_plugins or []
    has_enabled_plugins = any(plugin.is_enabled for plugin in plugins)
    return AgentOut(
        id=agent.id,
        name=agent.name,
        role=agent.role,
        model_ref=agent.model_ref,
        api_key=agent.api_key,
        audio_model_ref=agent.audio_model_ref,
        audio_api_key=agent.audio_api_key,
        system_prompt=agent.system_prompt,
        context_text=agent.context_text,
        system_skills=list(agent.system_skills or []),
        is_system=agent.is_system,
        is_active=agent.is_active,
        execution_mode="plugin_augmented" if has_enabled_plugins else "native",
        sandbox_enabled=has_enabled_plugins,
        attached_plugins=plugins,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


async def build_agent_output(db: AsyncSession, owner_user_id: int, agent: Agent) -> AgentOut:
    summary_map = await _load_plugin_summary_map(db, owner_user_id, [agent.id])
    return build_agent_out(agent, summary_map.get(agent.id, []))


async def build_agent_outputs(
    db: AsyncSession,
    owner_user_id: int,
    agents: list[Agent],
) -> list[AgentOut]:
    summary_map = await _load_plugin_summary_map(db, owner_user_id, [agent.id for agent in agents])
    return [build_agent_out(agent, summary_map.get(agent.id, [])) for agent in agents]


async def list_plugins(db: AsyncSession, owner_user_id: int) -> list[PluginOut]:
    result = await db.execute(
        select(CustomPlugin)
        .where(CustomPlugin.owner_user_id == owner_user_id)
        .order_by(CustomPlugin.updated_at.desc(), CustomPlugin.created_at.desc())
    )
    return [plugin_to_out(plugin) for plugin in result.scalars().all()]


async def get_plugin_or_404(db: AsyncSession, owner_user_id: int, plugin_id: int) -> CustomPlugin:
    result = await db.execute(
        select(CustomPlugin).where(
            CustomPlugin.id == plugin_id,
            CustomPlugin.owner_user_id == owner_user_id,
        )
    )
    plugin = result.scalar_one_or_none()
    if plugin is None:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return plugin


async def get_plugin_output(db: AsyncSession, owner_user_id: int, plugin_id: int) -> PluginOut:
    plugin = await get_plugin_or_404(db, owner_user_id, plugin_id)
    return plugin_to_out(plugin)


async def queue_plugin_install(
    request: PluginInstallRequest,
    db: AsyncSession,
    owner_user_id: int,
) -> PluginInstallQueuedOut:
    source = parse_github_plugin_source(request.source_url)
    plugin = CustomPlugin(
        owner_user_id=owner_user_id,
        name=_derive_plugin_name(request.name, source.repo, source.subdir),
        source_url=request.source_url,
        github_owner=source.owner,
        github_repo=source.repo,
        git_ref=source.ref,
        subdir=source.subdir or "",
        runtime_profile="light",
        requires_sandbox=True,
        install_status="queued",
    )
    db.add(plugin)
    await db.commit()
    await db.refresh(plugin)

    try:
        job_id = await dispatch_plugin_install_job(plugin.id, owner_user_id)
    except Exception as exc:
        plugin.install_status = "failed"
        plugin.error_message = str(exc)
        await db.commit()
        raise exc

    return PluginInstallQueuedOut(plugin=plugin_to_out(plugin), job_id=job_id)


async def delete_plugin_record(db: AsyncSession, owner_user_id: int, plugin_id: int) -> dict[str, bool]:
    plugin = await get_plugin_or_404(db, owner_user_id, plugin_id)
    await db.execute(
        delete(AgentPluginBinding).where(
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.plugin_id == plugin_id,
        )
    )
    await db.delete(plugin)
    await db.commit()

    plugin_root = ensure_user_plugins_root(owner_user_id) / str(plugin_id)
    if plugin_root.exists():
        shutil.rmtree(plugin_root, ignore_errors=True)

    return {"ok": True}


async def bind_plugin_to_agent(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    plugin_id: int,
    binding_in: AgentPluginBindRequest,
) -> AgentOut:
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == owner_user_id)
    )
    agent = agent_result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    plugin = await get_plugin_or_404(db, owner_user_id, plugin_id)
    if plugin.install_status != "installed" or not plugin.commit_sha:
        raise HTTPException(status_code=400, detail="Plugin is not installed yet")

    binding_result = await db.execute(
        select(AgentPluginBinding).where(
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.agent_id == agent_id,
            AgentPluginBinding.plugin_id == plugin_id,
        )
    )
    binding = binding_result.scalar_one_or_none()
    if binding is None:
        binding = AgentPluginBinding(
            owner_user_id=owner_user_id,
            agent_id=agent_id,
            plugin_id=plugin_id,
            sort_order=binding_in.sort_order,
            is_enabled=binding_in.is_enabled,
        )
        db.add(binding)
    else:
        binding.sort_order = binding_in.sort_order
        binding.is_enabled = binding_in.is_enabled

    await db.flush()
    await sync_agent_plugin_state(db, owner_user_id, agent_id)
    await db.commit()
    await db.refresh(agent)
    return await build_agent_output(db, owner_user_id, agent)


async def unbind_plugin_from_agent(
    db: AsyncSession,
    owner_user_id: int,
    agent_id: int,
    plugin_id: int,
) -> AgentOut:
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == owner_user_id)
    )
    agent = agent_result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    binding_result = await db.execute(
        select(AgentPluginBinding).where(
            AgentPluginBinding.owner_user_id == owner_user_id,
            AgentPluginBinding.agent_id == agent_id,
            AgentPluginBinding.plugin_id == plugin_id,
        )
    )
    binding = binding_result.scalar_one_or_none()
    if binding is not None:
        await db.delete(binding)
        await db.flush()

    await sync_agent_plugin_state(db, owner_user_id, agent_id)
    await db.commit()
    await db.refresh(agent)
    return await build_agent_output(db, owner_user_id, agent)


def run_plugin_install_job(plugin_id: int, owner_user_id: int, job_id: str):
    run_id = str(uuid.uuid4())
    seq = 0

    with SyncSession() as db:
        plugin = db.execute(
            select(CustomPlugin).where(
                CustomPlugin.id == plugin_id,
                CustomPlugin.owner_user_id == owner_user_id,
            )
        ).scalar_one_or_none()
        if plugin is None:
            return job_failure("plugin_install", "Plugin not found", plugin_id=plugin_id)

        def log(level: str, event_type: str, message: str, payload_json: dict | None = None):
            nonlocal seq
            seq += 1
            append_run_event_sync(
                db,
                owner_user_id=owner_user_id,
                task_id=None,
                job_id=job_id,
                run_id=run_id,
                phase="plugin_install",
                event_type=event_type,
                level=level,
                message=message,
                payload_json=payload_json,
                seq=seq,
            )
            db.commit()

        try:
            plugin.install_status = "installing"
            plugin.error_message = None
            db.commit()

            log("info", "start", "Resolving GitHub plugin source", {"source_url": plugin.source_url})
            source = parse_github_plugin_source(plugin.source_url)

            log("info", "log", "Resolving pinned commit SHA", {"git_ref": source.ref})
            commit_sha = resolve_github_commit_sha(source)

            plugin_root = ensure_user_plugins_root(owner_user_id) / str(plugin.id)
            if plugin_root.exists():
                shutil.rmtree(plugin_root, ignore_errors=True)

            snapshot_dir = get_plugin_snapshot_dir(owner_user_id, plugin.id, commit_sha)
            log("info", "log", "Downloading and validating repository snapshot", {"commit_sha": commit_sha})
            snapshot = install_snapshot_from_github(source, commit_sha, snapshot_dir)

            plugin.name = plugin.name or _derive_plugin_name(None, source.repo, source.subdir)
            plugin.github_owner = source.owner
            plugin.github_repo = source.repo
            plugin.git_ref = source.ref
            plugin.subdir = source.subdir or ""
            plugin.commit_sha = commit_sha
            plugin.entry_hint = snapshot.entry_hint
            plugin.detected_files = snapshot.detected_files
            plugin.root_relpath = snapshot.root_relpath
            plugin.install_status = "installed"
            plugin.requires_sandbox = True
            plugin.error_message = None
            db.commit()

            log(
                "info",
                "done",
                "Plugin installed successfully",
                {
                    "plugin_id": plugin.id,
                    "commit_sha": commit_sha,
                    "entry_hint": snapshot.entry_hint,
                    "detected_file_count": len(snapshot.detected_files),
                },
            )
            return job_success(
                "plugin_install",
                plugin_id=plugin.id,
                commit_sha=commit_sha,
                entry_hint=snapshot.entry_hint,
                detected_files=snapshot.detected_files,
            )
        except HTTPException as exc:
            error_message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            logger.warning(
                "Plugin installation rejected for plugin=%s user=%s: %s",
                plugin_id,
                owner_user_id,
                error_message,
            )
        except Exception as exc:  # noqa: BLE001
            error_message = str(exc)
            logger.exception("Plugin installation failed for plugin=%s user=%s", plugin_id, owner_user_id)

        plugin.install_status = "failed"
        plugin.error_message = error_message
        db.commit()
        log("error", "error", error_message, {"plugin_id": plugin_id})
        return job_failure("plugin_install", error_message, plugin_id=plugin_id)
