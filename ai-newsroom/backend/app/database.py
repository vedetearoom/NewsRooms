from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import create_engine, inspect, select, text
from app.config import get_settings

settings = get_settings()


def _to_sync_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    return database_url


# Async engine (for FastAPI / uvicorn)
engine = create_async_engine(settings.database_url, echo=False, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
# Backward-compatible alias used by older debug scripts.
async_session_maker = async_session

# Sync engine (for Celery workers — they run outside asyncio)
sync_engine = create_engine(_to_sync_database_url(settings.database_url_sync), echo=False, pool_size=5, max_overflow=5)
SyncSession = sessionmaker(bind=sync_engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


OWNER_SCOPED_TABLES = [
    "agents",
    "agent_threads",
    "agent_messages",
    "agent_action_proposals",
    "sources",
    "raw_articles",
    "intelligence_cards",
    "tasks",
    "drafts",
    "critiques",
    "inspiration_assets",
    "monitor_targets",
    "manual_video_inbox_items",
    "custom_plugins",
    "agent_plugin_bindings",
    "agent_run_events",
    "model_providers",
]


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    import app.models  # noqa: F401 - ensure all model metadata is registered before create_all

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_owner_scoped_columns)
        await conn.run_sync(_ensure_monitor_target_columns)
        await conn.run_sync(_ensure_manual_video_inbox_columns)
        await conn.run_sync(_ensure_agent_plugin_columns)
        await conn.run_sync(_ensure_plugin_runtime_profiles)
        await conn.run_sync(_ensure_role_quota_columns)
        await conn.run_sync(_ensure_clerk_user_id_column)
        await conn.run_sync(_ensure_pinned_columns)
        await conn.run_sync(_drop_is_super_admin_column)
        await conn.run_sync(_ensure_model_providers_table)

    from app.models import User
    from app.services.agent_service import ensure_default_agents_for_user
    from app.services.auth_service import ensure_default_access_control_data

    async with async_session() as session:
        await ensure_default_access_control_data(session)
        admin_result = await session.execute(
            select(User).where(User.username == settings.default_admin_username)
        )
        admin_user = admin_result.scalars().first()
        admin_user_id = admin_user.id if admin_user else None

        if admin_user_id is not None:
            for table_name in OWNER_SCOPED_TABLES:
                await session.execute(
                    text(f"UPDATE {table_name} SET owner_user_id = :owner_user_id WHERE owner_user_id IS NULL"),
                    {"owner_user_id": admin_user_id},
                )

        users_result = await session.execute(select(User))
        for user in users_result.scalars().all():
            await ensure_default_agents_for_user(session, user.id)

        await session.commit()


def _ensure_owner_scoped_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    for table_name in OWNER_SCOPED_TABLES:
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        if "owner_user_id" not in columns:
            sync_conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN owner_user_id INTEGER"))
        sync_conn.execute(
            text(f"CREATE INDEX IF NOT EXISTS ix_{table_name}_owner_user_id ON {table_name} (owner_user_id)")
        )


def _ensure_monitor_target_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    columns = {column["name"] for column in inspector.get_columns("monitor_targets")}

    if "last_check_job_id" not in columns:
        sync_conn.execute(text("ALTER TABLE monitor_targets ADD COLUMN last_check_job_id VARCHAR(255)"))
    if "last_check_status" not in columns:
        sync_conn.execute(text("ALTER TABLE monitor_targets ADD COLUMN last_check_status VARCHAR(50)"))
    if "last_check_error" not in columns:
        sync_conn.execute(text("ALTER TABLE monitor_targets ADD COLUMN last_check_error TEXT"))
    if "discovery_mode" not in columns:
        sync_conn.execute(
            text("ALTER TABLE monitor_targets ADD COLUMN discovery_mode VARCHAR(20) DEFAULT 'rsshub'")
        )

    sync_conn.execute(
        text(
            "UPDATE monitor_targets SET discovery_mode = 'cookie' "
            "WHERE platform = 'xiaohongshu' AND (discovery_mode IS NULL OR discovery_mode = '')"
        )
    )
    sync_conn.execute(
        text(
            "UPDATE monitor_targets SET discovery_mode = 'rsshub' "
            "WHERE platform <> 'xiaohongshu' AND (discovery_mode IS NULL OR discovery_mode = '')"
        )
    )


def _ensure_manual_video_inbox_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    columns = {column["name"] for column in inspector.get_columns("manual_video_inbox_items")}

    if "source_kind" not in columns:
        sync_conn.execute(
            text("ALTER TABLE manual_video_inbox_items ADD COLUMN source_kind VARCHAR(20) DEFAULT 'url'")
        )
    if "original_filename" not in columns:
        sync_conn.execute(text("ALTER TABLE manual_video_inbox_items ADD COLUMN original_filename VARCHAR(500)"))
    if "storage_key" not in columns:
        sync_conn.execute(text("ALTER TABLE manual_video_inbox_items ADD COLUMN storage_key TEXT"))
    if "mime_type" not in columns:
        sync_conn.execute(text("ALTER TABLE manual_video_inbox_items ADD COLUMN mime_type VARCHAR(100)"))
    if "file_size_bytes" not in columns:
        sync_conn.execute(text("ALTER TABLE manual_video_inbox_items ADD COLUMN file_size_bytes INTEGER"))

    sync_conn.execute(
        text(
            "UPDATE manual_video_inbox_items SET source_kind = 'url' "
            "WHERE source_kind IS NULL OR source_kind = ''"
        )
    )


def _ensure_agent_plugin_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    columns = {column["name"] for column in inspector.get_columns("agents")}

    if "execution_mode" not in columns:
        sync_conn.execute(text("ALTER TABLE agents ADD COLUMN execution_mode VARCHAR(32) DEFAULT 'native'"))
    if "sandbox_enabled" not in columns:
        sync_conn.execute(text("ALTER TABLE agents ADD COLUMN sandbox_enabled BOOLEAN DEFAULT FALSE"))
    if "system_skills" not in columns:
        sync_conn.execute(text("ALTER TABLE agents ADD COLUMN system_skills JSON"))

    sync_conn.execute(
        text("UPDATE agents SET execution_mode = 'native' WHERE execution_mode IS NULL OR execution_mode = ''")
    )
    sync_conn.execute(
        text("UPDATE agents SET sandbox_enabled = FALSE WHERE sandbox_enabled IS NULL")
    )
    sync_conn.execute(
        text("UPDATE agents SET system_skills = '[]' WHERE system_skills IS NULL")
    )


def _ensure_plugin_runtime_profiles(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "custom_plugins" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("custom_plugins")}
    if "runtime_profile" not in columns:
        return

    sync_conn.execute(
        text("UPDATE custom_plugins SET runtime_profile = 'light' WHERE runtime_profile IS NULL OR runtime_profile <> 'light'")
    )


def _ensure_role_quota_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "roles" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("roles")}
    if "quota_limits" not in columns:
        sync_conn.execute(text("ALTER TABLE roles ADD COLUMN quota_limits JSON"))


def _ensure_clerk_user_id_column(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "clerk_user_id" not in columns:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN clerk_user_id VARCHAR(255)"))
    if "clerk_deleted_at" not in columns:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN clerk_deleted_at TIMESTAMP WITH TIME ZONE"))
    sync_conn.execute(
        text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_clerk_user_id ON users (clerk_user_id)")
    )
    sync_conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))


def _ensure_pinned_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "intelligence_cards" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("intelligence_cards")}
    if "is_pinned" not in columns:
        sync_conn.execute(text("ALTER TABLE intelligence_cards ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE"))
    if "pinned_by" not in columns:
        sync_conn.execute(text("ALTER TABLE intelligence_cards ADD COLUMN pinned_by INTEGER"))
    if "pinned_at" not in columns:
        sync_conn.execute(text("ALTER TABLE intelligence_cards ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE"))
    sync_conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_intelligence_cards_is_pinned ON intelligence_cards (is_pinned)")
    )


def _drop_is_super_admin_column(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_super_admin" in columns:
        sync_conn.execute(text("ALTER TABLE users DROP COLUMN is_super_admin"))


def _ensure_model_providers_table(sync_conn) -> None:
    inspector = inspect(sync_conn)

    # 1. Create model_providers table if not exists
    if "model_providers" not in inspector.get_table_names():
        sync_conn.execute(text("""
            CREATE TABLE model_providers (
                id SERIAL PRIMARY KEY,
                owner_user_id INTEGER,
                name VARCHAR(100) NOT NULL,
                provider VARCHAR(20) NOT NULL,
                api_key VARCHAR(255) NOT NULL,
                category VARCHAR(20) NOT NULL DEFAULT 'text',
                default_model VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )
        """))
        sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_model_providers_owner_user_id ON model_providers (owner_user_id)"))

    # Add category column to model_providers if missing
    if "model_providers" in inspector.get_table_names():
        mp_columns = {column["name"] for column in inspector.get_columns("model_providers")}
        if "category" not in mp_columns:
            sync_conn.execute(text("ALTER TABLE model_providers ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'text'"))
        else:
            sync_conn.execute(text("ALTER TABLE model_providers ALTER COLUMN category SET DEFAULT 'text'"))
            sync_conn.execute(text("UPDATE model_providers SET category = 'text' WHERE category IS NULL OR category = ''"))
            sync_conn.execute(text("ALTER TABLE model_providers ALTER COLUMN category SET NOT NULL"))

    # 2. Add provider_id to agents if missing
    if "agents" in inspector.get_table_names():
        agent_columns = {column["name"] for column in inspector.get_columns("agents")}
        if "provider_id" not in agent_columns:
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN provider_id INTEGER"))
            sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_agents_provider_id ON agents (provider_id)"))

        # 3. Data migration: create ModelProvider rows from existing agent api_keys
        rows = sync_conn.execute(text(
            "SELECT id, owner_user_id, api_key, model_ref FROM agents "
            "WHERE api_key IS NOT NULL AND api_key != ''"
        )).fetchall()

        for agent_id, owner_user_id, api_key, model_ref in rows:
            model_ref = model_ref or ""
            provider = "alibaba" if "qwen" in model_ref.lower() else "google"

            # Check if a provider already exists for this user+provider combo
            existing = sync_conn.execute(text(
                "SELECT id FROM model_providers WHERE owner_user_id = :owner AND provider = :provider"
            ), {"owner": owner_user_id, "provider": provider}).fetchone()

            if existing:
                provider_id = existing[0]
            else:
                result = sync_conn.execute(text(
                    "INSERT INTO model_providers (owner_user_id, name, provider, api_key, category, default_model) "
                    "VALUES (:owner, :name, :provider, :api_key, 'text', :model) RETURNING id"
                ), {
                    "owner": owner_user_id,
                    "name": f"{provider.title()} Key",
                    "provider": provider,
                    "api_key": api_key,
                    "model": model_ref,
                })
                provider_id = result.fetchone()[0]

            sync_conn.execute(text(
                "UPDATE agents SET provider_id = :pid WHERE id = :aid AND (provider_id IS NULL)"
            ), {"pid": provider_id, "aid": agent_id})
