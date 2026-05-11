from sqlalchemy import Column, Date, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class QuotaUsageCounter(Base):
    __tablename__ = "quota_usage_counters"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "quota_key", "usage_date", name="uq_quota_usage_owner_key_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=False, index=True)
    quota_key = Column(String(100), nullable=False, index=True)
    usage_date = Column(Date, nullable=False, index=True)
    used = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
