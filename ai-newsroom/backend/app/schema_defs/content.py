from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class SourceCreate(BaseModel):
    name: str
    url: str
    source_type: str = "rss"
    processor_agent_id: Optional[int] = None
    extractor_prompt: Optional[str] = None


class SourceOut(BaseModel):
    id: int
    name: str
    url: str
    source_type: str
    is_active: bool
    processor_agent_id: Optional[int] = None
    extractor_prompt: Optional[str] = None
    last_fetched_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class CardOut(BaseModel):
    id: int
    title: str
    summary: str
    key_points: Optional[list] = []
    source_urls: Optional[list] = []
    raw_article_ids: Optional[list] = []
    tags: Optional[list] = []
    category: Optional[str] = None
    importance_score: float = 0.5
    cover_image: Optional[str] = None
    is_read: bool = False
    is_archived: bool = False
    content_type: str = "article"
    extra_data: dict = {}
    audio_url: Optional[str] = None
    created_at: datetime
    published_date: date
    model_config = {"from_attributes": True}
