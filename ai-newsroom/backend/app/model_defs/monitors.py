from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class MonitorTarget(Base):
    __tablename__ = "monitor_targets"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    platform = Column(String(50), nullable=False)
    platform_id = Column(String(255), nullable=False)
    homepage_url = Column(Text, nullable=False)
    rss_url = Column(Text, nullable=True)
    discovery_mode = Column(String(20), nullable=False, default="rsshub")
    is_active = Column(Boolean, default=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    cached_videos = Column(JSON, default=list)
    active_jobs = Column(JSON, default=dict)
    last_check_job_id = Column(String(255), nullable=True)
    last_check_status = Column(String(50), nullable=True)
    last_check_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ManualVideoInboxItem(Base):
    __tablename__ = "manual_video_inbox_items"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    source_kind = Column(String(20), nullable=False, default="url")
    original_url = Column(Text, nullable=False)
    normalized_url = Column(Text, nullable=False, unique=True, index=True)
    platform = Column(String(50), nullable=False, default="other")
    author = Column(String(255), nullable=True)
    title = Column(String(500), nullable=False, default="")
    original_filename = Column(String(500), nullable=True)
    storage_key = Column(Text, nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    published = Column(String(100), nullable=True)
    thumbnail = Column(Text, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    view_count = Column(Integer, nullable=True)
    like_count = Column(Integer, nullable=True)
    favorite_count = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    active_job_id = Column(String(255), nullable=True)
    linked_card_id = Column(Integer, nullable=True)
    last_analyzed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserPlatformCredential(Base):
    __tablename__ = "user_platform_credentials"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_user_platform_credentials_user_platform"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(50), nullable=False, index=True)
    cookie_ciphertext = Column(Text, nullable=False)
    cookie_masked = Column(String(255), nullable=False, default="")
    last_validated_at = Column(DateTime(timezone=True), nullable=True)
    last_validation_status = Column(String(50), nullable=True)
    last_validation_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
