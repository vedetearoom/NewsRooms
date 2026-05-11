import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app.config as config_module
from app.config import Settings, get_settings


class SettingsEnvFileTests(unittest.TestCase):
    def tearDown(self):
        get_settings.cache_clear()

    def test_mounted_settings_file_is_loaded(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            config_path = Path(tmp_dir) / "backend.env"
            config_path.write_text(
                "\n".join(
                    [
                        "DATABASE_URL=postgresql+asyncpg://postgres:test@db:5432/newsroom",
                        "ENABLE_SCHEDULER=false",
                        "GEMINI_API_KEY=mounted-key",
                    ]
                ),
                encoding="utf-8",
            )

            with patch.dict(
                os.environ,
                {"AI_NEWSROOM_SETTINGS_FILE": str(config_path)},
                clear=False,
            ):
                settings = Settings()

        self.assertEqual(
            settings.database_url,
            "postgresql+asyncpg://postgres:test@db:5432/newsroom",
        )
        self.assertFalse(settings.enable_scheduler)
        self.assertEqual(settings.gemini_api_key, "mounted-key")

    def test_environment_variables_override_mounted_settings_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            config_path = Path(tmp_dir) / "backend.env"
            config_path.write_text(
                "GEMINI_API_KEY=file-key\nAUTH_SECRET_KEY=file-secret\n",
                encoding="utf-8",
            )

            with patch.dict(
                os.environ,
                {
                    "AI_NEWSROOM_SETTINGS_FILE": str(config_path),
                    "GEMINI_API_KEY": "env-key",
                },
                clear=False,
            ):
                settings = Settings()

        self.assertEqual(settings.gemini_api_key, "env-key")
        self.assertEqual(settings.auth_secret_key, "file-secret")

    def test_repo_root_env_file_is_loaded_for_local_development(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            repo_env_path = Path(tmp_dir) / ".env"
            backend_env_path = Path(tmp_dir) / "backend.env"
            repo_env_path.write_text(
                "DATABASE_URL=postgresql+asyncpg://postgres:repo@localhost:5432/repo_db\n",
                encoding="utf-8",
            )
            backend_env_path.write_text("", encoding="utf-8")

            with (
                patch.object(config_module, "DEFAULT_REPO_ENV_FILE", repo_env_path),
                patch.object(config_module, "DEFAULT_LOCAL_ENV_FILE", backend_env_path),
                patch.dict(os.environ, {}, clear=False),
            ):
                os.environ.pop("AI_NEWSROOM_SETTINGS_FILE", None)
                settings = Settings()

        self.assertEqual(
            settings.database_url,
            "postgresql+asyncpg://postgres:repo@localhost:5432/repo_db",
        )
