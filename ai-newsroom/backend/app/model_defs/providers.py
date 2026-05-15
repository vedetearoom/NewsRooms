from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class ModelProvider(Base):
    __tablename__ = "model_providers"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    name = Column(String(100), nullable=False)
    provider = Column(String(20), nullable=False)  # google|alibaba|deepseek
    api_key = Column(String(255), nullable=False)
    category = Column(String(20), nullable=False, default="text")  # text|image
    default_model = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
