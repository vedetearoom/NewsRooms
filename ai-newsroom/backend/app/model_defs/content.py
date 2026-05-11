from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, JSON, String, Text, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    source_type = Column(String(50), default="rss")
    is_active = Column(Boolean, default=True)
    processor_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    extractor_prompt = Column(Text, nullable=True)
    last_fetched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RawArticle(Base):
    __tablename__ = "raw_articles"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=True)
    title = Column(Text)
    content = Column(Text)
    url = Column(Text)
    author = Column(String(255), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    is_processed = Column(Boolean, default=False)


class IntelligenceCard(Base):
    __tablename__ = "intelligence_cards"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    title = Column(String(500), nullable=False)
    summary = Column(Text, nullable=False)
    key_points = Column(JSON, default=list)
    source_urls = Column(JSON, default=list)
    raw_article_ids = Column(JSON, default=list)
    tags = Column(JSON, default=list)
    category = Column(String(100), nullable=True)
    importance_score = Column(Float, default=0.5)
    cover_image = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    content_type = Column(String(20), default="article")
    extra_data = Column(JSON, default=dict)
    audio_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    published_date = Column(Date, server_default=func.current_date())
