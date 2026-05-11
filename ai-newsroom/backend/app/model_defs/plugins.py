from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class CustomPlugin(Base):
    __tablename__ = "custom_plugins"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    source_url = Column(Text, nullable=False)
    github_owner = Column(String(255), nullable=False)
    github_repo = Column(String(255), nullable=False)
    git_ref = Column(String(255), nullable=False, default="main")
    commit_sha = Column(String(64), nullable=True)
    subdir = Column(Text, nullable=True)
    install_status = Column(String(32), nullable=False, default="queued")
    runtime_profile = Column(String(32), nullable=False, default="light")
    entry_hint = Column(Text, nullable=True)
    detected_files = Column(JSON, default=list)
    requires_sandbox = Column(Boolean, default=True)
    root_relpath = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AgentPluginBinding(Base):
    __tablename__ = "agent_plugin_bindings"
    __table_args__ = (
        UniqueConstraint("agent_id", "plugin_id", name="uq_agent_plugin_binding"),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    plugin_id = Column(Integer, ForeignKey("custom_plugins.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AgentRunEvent(Base):
    __tablename__ = "agent_run_events"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    job_id = Column(String(255), nullable=False, index=True)
    run_id = Column(String(255), nullable=False, index=True)
    phase = Column(String(64), nullable=False)
    event_type = Column(String(64), nullable=False)
    level = Column(String(16), nullable=False, default="info")
    message = Column(Text, nullable=False, default="")
    payload_json = Column(JSON, default=dict)
    seq = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
