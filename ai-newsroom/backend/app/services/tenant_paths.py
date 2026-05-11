from __future__ import annotations

from pathlib import Path

from app.config import get_settings


def get_tenant_root() -> Path:
    return Path(get_settings().newsroom_tenant_root).expanduser()


def get_user_root(user_id: int) -> Path:
    return get_tenant_root() / "users" / str(user_id)


def ensure_user_workspace(user_id: int) -> Path:
    path = get_user_root(user_id) / "workspace"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ensure_user_plugins_root(user_id: int) -> Path:
    path = get_user_root(user_id) / "plugins"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ensure_user_runs_root(user_id: int) -> Path:
    path = get_user_root(user_id) / "runs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ensure_plugin_snapshot_dir(user_id: int, plugin_id: int, commit_sha: str) -> Path:
    path = ensure_user_plugins_root(user_id) / str(plugin_id) / commit_sha
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_plugin_snapshot_dir(user_id: int, plugin_id: int, commit_sha: str) -> Path:
    return ensure_user_plugins_root(user_id) / str(plugin_id) / commit_sha


def ensure_task_run_dir(user_id: int, task_id: int, run_id: str) -> Path:
    path = ensure_user_runs_root(user_id) / str(task_id) / run_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_task_run_dir(user_id: int, task_id: int, run_id: str) -> Path:
    return ensure_user_runs_root(user_id) / str(task_id) / run_id


def get_run_context_path(user_id: int, task_id: int, run_id: str) -> Path:
    return get_task_run_dir(user_id, task_id, run_id) / "context.md"


def ensure_run_artifacts_dir(user_id: int, task_id: int, run_id: str) -> Path:
    path = ensure_task_run_dir(user_id, task_id, run_id) / "artifacts"
    path.mkdir(parents=True, exist_ok=True)
    return path
