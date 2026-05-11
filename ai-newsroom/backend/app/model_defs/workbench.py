from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.database import Base


class AgentThread(Base):
    __tablename__ = "agent_threads"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New Conversation")
    linked_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    thread_id = Column(Integer, ForeignKey("agent_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False)
    content_md = Column(Text, nullable=False, default="")
    tool_name = Column(String(128), nullable=True)
    tool_payload_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AgentActionProposal(Base):
    __tablename__ = "agent_action_proposals"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    thread_id = Column(Integer, ForeignKey("agent_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id = Column(Integer, ForeignKey("agent_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(64), nullable=False)
    payload_json = Column(JSON, default=dict)
    status = Column(String(32), nullable=False, default="pending")
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
