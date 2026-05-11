from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


RuntimeProfile = Literal["light"]


class PluginInstallRequest(BaseModel):
    source_url: str
    name: Optional[str] = None
    runtime_profile: RuntimeProfile = "light"


class PluginOut(BaseModel):
    id: int
    name: str
    source_url: str
    github_owner: str
    github_repo: str
    git_ref: str
    commit_sha: Optional[str] = None
    subdir: Optional[str] = None
    install_status: str
    runtime_profile: RuntimeProfile = "light"
    entry_hint: Optional[str] = None
    detected_files: list[str] = []
    requires_sandbox: bool = True
    root_relpath: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PluginInstallQueuedOut(BaseModel):
    plugin: PluginOut
    job_id: str


class AgentPluginSummaryOut(BaseModel):
    id: int
    name: str
    install_status: str
    runtime_profile: RuntimeProfile = "light"
    source_url: str
    github_owner: str
    github_repo: str
    git_ref: str
    commit_sha: Optional[str] = None
    entry_hint: Optional[str] = None
    detected_files: list[str] = []
    is_enabled: bool = True
    sort_order: int = 0


class AgentPluginBindRequest(BaseModel):
    sort_order: int = 0
    is_enabled: bool = True


class AgentRunEventOut(BaseModel):
    id: int
    task_id: Optional[int] = None
    job_id: str
    run_id: str
    phase: str
    event_type: str
    level: str
    message: str
    payload_json: dict = Field(default_factory=dict)
    seq: int
    created_at: datetime
    model_config = {"from_attributes": True}
