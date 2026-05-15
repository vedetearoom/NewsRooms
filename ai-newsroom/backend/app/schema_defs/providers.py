from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ModelProviderCreate(BaseModel):
    name: str
    provider: str  # google|alibaba
    category: str = "text"  # text|image
    api_key: str
    default_model: Optional[str] = None


class ModelProviderUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    category: Optional[str] = None
    api_key: Optional[str] = None
    default_model: Optional[str] = None


class ModelProviderOut(BaseModel):
    id: int
    name: str
    provider: str
    category: str
    api_key_masked: str
    default_model: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
