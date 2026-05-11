from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Float, String, Text
from sqlalchemy.sql import func

from app.database import Base
from app.task_status import TaskStatus


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    task_type = Column(String(100), nullable=False)
    title = Column(String(500), nullable=True)
    card_ids = Column(JSON, default=list)
    inspiration_ids = Column(JSON, default=list)
    source_task_ids = Column(JSON, default=list)
    status = Column(String(50), default=TaskStatus.PENDING.value)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    content = Column(Text, default="")
    revised_content = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    agent = Column(String(50), default="writer")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Critique(Base):
    __tablename__ = "critiques"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    draft_id = Column(Integer, ForeignKey("drafts.id"), nullable=False)
    critiques = Column(JSON, default=list)
    overall_score = Column(Float, nullable=True)
    overall_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
