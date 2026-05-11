from datetime import datetime

from pydantic import BaseModel


class AgentSkillParameterOut(BaseModel):
    name: str
    label: str
    type: str
    required: bool = False
    description: str | None = None


class AgentSkillCatalogItemOut(BaseModel):
    key: str
    label: str
    description: str
    roles: list[str] = []
    requires_confirmation: bool = False
    parameters: list[AgentSkillParameterOut] = []


class AgentThreadCreate(BaseModel):
    title: str | None = None


class AgentThreadChatRequest(BaseModel):
    prompt: str


class AgentActionProposalOut(BaseModel):
    id: int
    thread_id: int
    message_id: int
    action_type: str
    payload_json: dict = {}
    status: str
    result_json: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentMessageOut(BaseModel):
    id: int
    thread_id: int
    role: str
    content_md: str
    tool_name: str | None = None
    tool_payload_json: dict = {}
    created_at: datetime
    action_proposals: list[AgentActionProposalOut] = []

    model_config = {"from_attributes": True}


class AgentThreadOut(BaseModel):
    id: int
    agent_id: int
    title: str
    linked_task_id: int | None = None
    last_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
