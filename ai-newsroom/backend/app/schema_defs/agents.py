from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from app.schema_defs.plugins import AgentPluginSummaryOut


class AgentCreate(BaseModel):
    name: str
    role: str
    model_ref: Optional[str] = "gemini-2.5-flash"
    provider_id: Optional[int] = None
    api_key: Optional[str] = None
    audio_model_ref: Optional[str] = None
    audio_api_key: Optional[str] = None
    system_prompt: str
    context_text: Optional[str] = None
    system_skills: list[str] = []
    is_system: Optional[bool] = False
    execution_mode: Optional[str] = "native"
    sandbox_enabled: Optional[bool] = False


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    model_ref: Optional[str] = None
    provider_id: Optional[int] = None
    api_key: Optional[str] = None
    audio_model_ref: Optional[str] = None
    audio_api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    context_text: Optional[str] = None
    system_skills: Optional[list[str]] = None
    execution_mode: Optional[str] = None
    sandbox_enabled: Optional[bool] = None


class AgentRewriteRequest(BaseModel):
    text: str
    instruction: str


class AgentChatRequest(BaseModel):
    inspiration_ids: list[int]
    prompt: str
    agent_type: Optional[str] = "general_writing"


class AgentOut(BaseModel):
    id: int
    name: str
    role: str
    model_ref: str
    provider_id: Optional[int] = None
    provider_name: Optional[str] = None
    api_key: Optional[str] = None
    audio_model_ref: Optional[str] = None
    audio_api_key: Optional[str] = None
    system_prompt: str
    context_text: Optional[str] = None
    system_skills: list[str] = []
    is_system: bool
    is_active: bool
    execution_mode: str = "native"
    sandbox_enabled: bool = False
    attached_plugins: list[AgentPluginSummaryOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
