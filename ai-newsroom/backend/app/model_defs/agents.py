from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    model_ref = Column(String(100), default="gemini-2.5-flash")
    provider_id = Column(Integer, nullable=True, index=True)
    api_key = Column(String(255), nullable=True)
    audio_model_ref = Column(String(100), nullable=True)
    audio_api_key = Column(String(255), nullable=True)
    system_prompt = Column(Text, nullable=False)
    context_text = Column(Text, nullable=True)
    system_skills = Column(JSON, default=list)
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=False)
    execution_mode = Column(String(32), nullable=False, default="native")
    sandbox_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
