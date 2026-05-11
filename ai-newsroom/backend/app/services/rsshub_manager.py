import logging
import subprocess
from shutil import which
from pathlib import Path

from fastapi import HTTPException

from app.config import get_settings
from app.services.credential_service import normalize_cookie_header, validate_cookie_syntax

logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
WORKSPACE_ROOT = PROJECT_ROOT.parent

# ── Cookie Config (multi-platform) ──
# Platforms that support cookie configuration
COOKIE_PLATFORMS = [
    {"key": "bilibili", "label": "B站", "env_var": "BILIBILI_COOKIE_0",
     "hint": "登录 bilibili.com → F12 → Network → 复制 Cookie 值"},
    {"key": "xiaohongshu", "label": "小红书", "env_var": "XIAOHONGSHU_COOKIE",
     "hint": "登录 xiaohongshu.com → F12 → Network → 复制 Cookie 值"},
]


def _mask_value(raw_value: str) -> str:
    value = raw_value.strip()
    if not value:
        return ""
    if len(value) <= 12:
        return f"{value[:2]}...{value[-2:]}"
    return f"{value[:10]}...{value[-8:]}"


def get_rsshub_env_path() -> Path:
    """Get the path to rsshub.env file."""
    return get_docker_compose_dir() / "rsshub.env"


def get_docker_compose_dir() -> Path:
    settings = get_settings()
    docker_dir = Path(settings.docker_compose_dir)
    if docker_dir.is_absolute():
        return docker_dir

    # Prefer project-local docker/ if it exists, otherwise fall back to the workspace sibling docker/.
    project_local = (PROJECT_ROOT / docker_dir).resolve()
    workspace_sibling = (WORKSPACE_ROOT / docker_dir).resolve()

    if project_local.exists():
        return project_local
    if workspace_sibling.exists():
        return workspace_sibling

    if str(docker_dir).startswith(".."):
        return project_local
    return workspace_sibling


def get_docker_compose_file_path() -> Path:
    return get_docker_compose_dir() / "docker-compose.yml"


def _build_display_path(filename: str) -> str:
    configured_dir = get_settings().docker_compose_dir.strip() or "docker"
    config_path = Path(configured_dir)
    if config_path.is_absolute():
        return str(config_path / filename)
    return str(config_path / filename)


def read_rsshub_env() -> dict[str, str]:
    """Read current cookie values from rsshub.env."""
    env_path = get_rsshub_env_path()
    result = {}
    if not env_path.exists():
        return result

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            result[key.strip()] = value.strip()
    return result

def write_rsshub_env(cookies: dict[str, str]):
    """Write cookie values to rsshub.env."""
    env_path = get_rsshub_env_path()
    env_path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "# RSSHub Cookie Configuration",
        "# Managed by AI Newsroom backend — do not edit manually.",
        "# Use the web UI (视频监控 → 配置 Cookie) to manage cookies.",
        "",
    ]

    for platform in COOKIE_PLATFORMS:
        env_var = platform["env_var"]
        value = cookies.get(env_var, "")
        if value:
            lines.append(f"{env_var}={value}")
        else:
            lines.append(f"# {env_var}=")

    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    logger.info(f"[RSSHubManager] Updated rsshub.env at {env_path}")


def get_rsshub_server_config_payload() -> dict:
    env_path = get_rsshub_env_path()
    compose_dir = get_docker_compose_dir()
    compose_file = get_docker_compose_file_path()
    env_values = read_rsshub_env()
    docker_path = which("docker")

    return {
        "service_name": "rsshub",
        "docker_compose_dir": get_settings().docker_compose_dir.strip() or "docker",
        "compose_file_path": _build_display_path("docker-compose.yml"),
        "compose_file_exists": compose_file.exists(),
        "env_file_path": _build_display_path("rsshub.env"),
        "env_file_exists": env_path.exists(),
        "docker_command": docker_path or "",
        "restart_required": True,
        "platforms": [
            {
                "key": platform["key"],
                "label": platform["label"],
                "env_var": platform["env_var"],
                "hint": platform["hint"],
                "value_masked": _mask_value(env_values.get(platform["env_var"], "")),
                "is_configured": bool(env_values.get(platform["env_var"], "").strip()),
            }
            for platform in COOKIE_PLATFORMS
        ],
    }


def update_rsshub_server_config(cookies: dict[str, str], restart_after_save: bool = False) -> dict:
    env_values = read_rsshub_env()
    platform_specs = {platform["key"]: platform for platform in COOKIE_PLATFORMS}

    updated = False
    for platform_key, raw_cookie in cookies.items():
        platform = platform_specs.get(platform_key)
        if platform is None:
            raise HTTPException(status_code=400, detail=f"不支持的平台配置项：{platform_key}")

        normalized_cookie = normalize_cookie_header(raw_cookie)
        if not normalized_cookie:
            continue
        validate_cookie_syntax(normalized_cookie)
        env_values[platform["env_var"]] = normalized_cookie
        updated = True

    if updated:
        write_rsshub_env(env_values)

    restart_message = ""
    restarted = False
    if restart_after_save:
        restart_result = restart_rsshub()
        restart_message = restart_result["message"]
        restarted = restart_result["ok"]
        if not restart_result["ok"]:
            raise HTTPException(status_code=500, detail=restart_result["message"])

    if restart_after_save:
        message = "RSSHub 配置已保存并重启。"
    elif updated:
        message = "RSSHub 配置已保存。由于使用 env_file，需重启 RSSHub 容器后生效。"
    else:
        message = "没有检测到新的配置变更。"

    return {
        "ok": True,
        "message": message,
        "restart_required": not restart_after_save,
        "restarted": restarted,
        "restart_message": restart_message,
    }


def restart_rsshub() -> dict[str, object]:
    """Restart the RSSHub container to apply env file changes."""
    docker_dir = get_docker_compose_dir()
    compose_file = get_docker_compose_file_path()
    docker_bin = which("docker")

    if not docker_bin:
        return {"ok": False, "message": "未找到 docker 命令，无法自动重启 RSSHub。"}

    if not compose_file.exists():
        return {"ok": False, "message": f"未找到 docker-compose.yml：{compose_file}"}

    try:
        result = subprocess.run(
            [docker_bin, "compose", "up", "-d", "rsshub", "--force-recreate"],
            cwd=str(docker_dir),
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            logger.info("[RSSHubManager] RSSHub container restarted successfully")
            return {"ok": True, "message": "RSSHub 已重启，新的 env_file 配置已应用。"}
        stderr = (result.stderr or result.stdout or "").strip()
        logger.error(f"[RSSHubManager] RSSHub restart failed: {stderr}")
        return {"ok": False, "message": f"RSSHub 重启失败：{stderr or 'docker compose 返回非 0'}"}
    except Exception as e:
        logger.error(f"[RSSHubManager] Failed to restart RSSHub: {e}")
        return {"ok": False, "message": f"RSSHub 重启失败：{e}"}
