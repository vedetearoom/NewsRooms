from functools import lru_cache
import os
from pathlib import Path

from pydantic_settings import BaseSettings, DotEnvSettingsSource, PydanticBaseSettingsSource, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_REPO_ENV_FILE = BACKEND_DIR.parent / ".env"
DEFAULT_LOCAL_ENV_FILE = BACKEND_DIR / ".env"
DEFAULT_MOUNTED_ENV_FILE = Path("/run/config/backend.env")
SETTINGS_FILE_ENV_VAR = "AI_NEWSROOM_SETTINGS_FILE"


def _iter_settings_env_files() -> list[Path]:
    env_files: list[Path] = []
    seen: set[Path] = set()

    explicit_path = os.getenv(SETTINGS_FILE_ENV_VAR, "").strip()
    candidates = [
        Path(explicit_path).expanduser() if explicit_path else None,
        DEFAULT_MOUNTED_ENV_FILE,
        DEFAULT_REPO_ENV_FILE,
        DEFAULT_LOCAL_ENV_FILE,
    ]

    for candidate in candidates:
        if candidate is None or not candidate.is_file():
            continue

        resolved = candidate.resolve()
        if resolved in seen:
            continue

        seen.add(resolved)
        env_files.append(candidate)

    return env_files


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:metalm2024@localhost:23012/metalm"
    database_url_sync: str = "postgresql+psycopg://postgres:metalm2024@localhost:23012/metalm"
    redis_url: str = "redis://:metalm2024@localhost:23013/0"
    enable_scheduler: bool = True
    gemini_api_key: str = ""
    cors_origins: str = "http://localhost:3000"
    scrape_cron: str = "0 */4 * * *"  # Pipeline job: scrape → process every 4 hours
    jina_api_key: str = ""  # Optional: enables Jina Reader for web URL extraction
    qwen_api_key: str = ""  # Optional: Qwen/DashScope API key for Alibaba models
    deepseek_api_key: str = ""  # Optional: DeepSeek API key for DeepSeek models
    github_token: str = ""  # Optional: fallback GitHub PAT when user has no personal token configured
    minio_endpoint: str = "http://127.0.0.1:23016"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "newsroom-images"
    rsshub_base_url: str = "http://localhost:23017"
    docker_compose_dir: str = "docker"  # Relative docker/ dir for deployment assets
    credential_encryption_secret: str = ""
    auth_secret_key: str = "ai-newsroom-dev-secret"
    auth_token_expire_hours: int = 24 * 7
    default_admin_username: str = "admin"
    default_admin_email: str = "admin@newsroom.local"
    default_admin_password: str = "admin123"
    default_admin_display_name: str = "Administrator"
    newsroom_tenant_root: str = "/var/lib/newsroom"
    hermes_sandbox_light_image: str = "ai-newsroom-hermes-sandbox-light:local"
    hermes_sandbox_network: str = "newsroom-sandbox"
    hermes_sandbox_timeout_seconds: int = 600
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    clerk_secret_key: str = ""
    clerk_webhook_secret: str = ""
    clerk_admin_emails: str = ""

    model_config = SettingsConfigDict(extra="ignore")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        dotenv_sources = tuple(
            DotEnvSettingsSource(
                settings_cls,
                env_file=env_file,
                env_file_encoding="utf-8",
            )
            for env_file in _iter_settings_env_files()
        )

        return (
            init_settings,
            env_settings,
            *dotenv_sources,
            file_secret_settings,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
