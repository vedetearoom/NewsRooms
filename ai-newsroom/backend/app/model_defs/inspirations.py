from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.database import Base


class InspirationAsset(Base):
    __tablename__ = "inspiration_assets"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    title = Column(String(500), nullable=False)
    hook_text = Column(Text, nullable=True)
    hook_technique = Column(String(200), nullable=True)
    template_skeleton = Column(Text, nullable=True)
    source_url = Column(Text, nullable=True)
    platform = Column(String(50), nullable=True)
    author = Column(String(255), nullable=True)
    tags = Column(JSON, default=list)
    audio_url = Column(Text, nullable=True)
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
