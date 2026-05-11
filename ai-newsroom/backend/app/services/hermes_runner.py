from __future__ import annotations

import os
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


class HermesSandboxError(RuntimeError):
    pass


@dataclass(slots=True)
class HermesRunConfig:
    hermes_home: Path
    image: str
    model: str
    provider: str
    api_key: str
    workspace_dir: Path
    plugins_dir: Path
    run_dir: Path
    timeout_seconds: int = 600
    base_url: str | None = None


def prepare_hermes_home(config: HermesRunConfig) -> Path:
    config.hermes_home.mkdir(parents=True, exist_ok=True)
    config_path = config.hermes_home / "config.yaml"
    env_path = config.hermes_home / ".env"
    config_path.write_text(_build_config_yaml(config), encoding="utf-8")
    env_path.write_text(_build_env_file(config), encoding="utf-8")
    return config_path


def run_hermes_query(
    config: HermesRunConfig,
    prompt: str,
    *,
    on_output: callable | None = None,
) -> list[str]:
    prepare_hermes_home(config)
    hermes_bin = _resolve_hermes_bin()
    if not hermes_bin:
        raise HermesSandboxError("未找到 hermes 可执行文件，请先安装 hermes-agent 依赖。")

    env = os.environ.copy()
    env["HERMES_HOME"] = str(config.hermes_home)
    command = [
        hermes_bin,
        "chat",
        "-q",
        prompt,
        "-Q",
        "-t",
        "terminal",
        "--provider",
        config.provider,
        "--model",
        config.model,
    ]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=str(config.run_dir),
        env=env,
        text=True,
        bufsize=1,
    )

    lines: list[str] = []
    assert process.stdout is not None
    try:
        for raw_line in process.stdout:
            line = raw_line.rstrip()
            lines.append(line)
            if on_output:
                on_output(line)
        process.wait(timeout=config.timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        process.kill()
        raise HermesSandboxError("Hermes 沙箱执行超时。") from exc

    if process.returncode != 0:
        joined = "\n".join(lines[-20:])
        raise HermesSandboxError(f"Hermes 执行失败（exit={process.returncode}）\n{joined}")
    return lines


def _resolve_hermes_bin() -> str | None:
    hermes_bin = shutil.which("hermes")
    if hermes_bin:
        return hermes_bin

    candidate = Path(sys.executable).resolve().with_name("hermes")
    if candidate.is_file() and os.access(candidate, os.X_OK):
        return str(candidate)

    return None


def _build_config_yaml(config: HermesRunConfig) -> str:
    volumes = [
        f"{config.workspace_dir}:/workspace:rw",
        f"{config.plugins_dir}:/plugins:ro",
        f"{config.run_dir}:/run/newsroom:rw",
    ]
    volume_lines = "\n".join(f"    - {shlex.quote(item)}" for item in volumes)
    base_url_line = f'  base_url: "{config.base_url}"\n' if config.base_url else ""
    return (
        "model:\n"
        f'  default: "{config.model}"\n'
        f'  provider: "{config.provider}"\n'
        f"{base_url_line}"
        "terminal:\n"
        '  backend: "docker"\n'
        '  cwd: "/run/newsroom"\n'
        f"  timeout: {config.timeout_seconds}\n"
        "  lifetime_seconds: 900\n"
        f'  docker_image: "{config.image}"\n'
        "  docker_mount_cwd_to_workspace: false\n"
        "  docker_forward_env: []\n"
        "  docker_volumes:\n"
        f"{volume_lines}\n"
    )


def _build_env_file(config: HermesRunConfig) -> str:
    lines = []
    if config.provider == "gemini":
        lines.append(f"GEMINI_API_KEY={config.api_key}")
    else:
        lines.append(f"OPENAI_API_KEY={config.api_key}")
    return "\n".join(lines) + "\n"
