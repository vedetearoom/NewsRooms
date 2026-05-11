from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MonitorTargetCreate(BaseModel):
    url: str
    name: str = ""
    discovery_mode: Optional[str] = None


class MonitorTargetUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    discovery_mode: Optional[str] = None


class MonitorTargetOut(BaseModel):
    id: int
    name: str
    platform: str
    platform_id: str
    homepage_url: str
    rss_url: Optional[str] = None
    discovery_mode: str
    is_active: bool
    last_checked_at: Optional[datetime] = None
    cached_videos: list = []
    active_jobs: dict = {}
    last_check_job_id: Optional[str] = None
    last_check_status: Optional[str] = None
    last_check_error: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class DiscoveredVideo(BaseModel):
    title: str
    url: str
    published: str
    thumbnail: str = ""
    source_kind: str = "url"
    original_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    is_sticky: bool = False
    note_type: Optional[str] = None
    already_analyzed: bool = False
    analyzed_card_id: Optional[int] = None
    last_analyzed_at: Optional[datetime] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    favorite_count: Optional[int] = None
    duration_seconds: Optional[int] = None


class MonitorCredentialUpsertRequest(BaseModel):
    cookie: str


class MonitorCredentialPlatformOut(BaseModel):
    key: str
    label: str
    hint: str
    cookie_masked: str = ""
    is_configured: bool = False
    last_validated_at: Optional[datetime] = None
    last_validation_status: Optional[str] = None
    last_validation_error: Optional[str] = None


class MonitorCredentialListOut(BaseModel):
    platforms: list[MonitorCredentialPlatformOut]


class MonitorCheckQueuedResponse(BaseModel):
    ok: bool
    job_id: str
    status: str


class MonitorCheckStatusOut(BaseModel):
    job_id: Optional[str] = None
    status: str
    error: str = ""
    videos: list[DiscoveredVideo] = []
    last_checked_at: Optional[datetime] = None


class DispatchAnalysisRequest(BaseModel):
    urls: list[str]


class MonitorCachedVideoDeleteRequest(BaseModel):
    urls: list[str]


class VideoAnalyzeRequest(BaseModel):
    url: str


class ManualVideoImportRequest(BaseModel):
    urls: list[str]


class ManualVideoInboxDeleteRequest(BaseModel):
    item_ids: list[int]


class ManualVideoInboxItemOut(BaseModel):
    id: int
    source_kind: str = "url"
    original_url: str
    normalized_url: str
    platform: str
    author: Optional[str] = None
    title: str
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    published: Optional[str] = None
    thumbnail: str = ""
    duration_seconds: Optional[int] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    favorite_count: Optional[int] = None
    status: str
    active_job_id: Optional[str] = None
    linked_card_id: Optional[int] = None
    last_analyzed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    already_analyzed: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
