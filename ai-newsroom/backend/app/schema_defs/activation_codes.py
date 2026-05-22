from datetime import datetime

from pydantic import BaseModel, Field


class ActivationCodeCreate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    code: str | None = Field(default=None, min_length=4, max_length=64)
    max_uses: int | None = Field(default=1, ge=1)
    expires_at: datetime | None = None
    default_role_code: str = Field(default="user", min_length=2, max_length=64)
    note: str | None = None


class ActivationCodeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    max_uses: int | None = Field(default=None, ge=1)
    expires_at: datetime | None = None
    is_active: bool | None = None
    default_role_code: str | None = Field(default=None, min_length=2, max_length=64)
    note: str | None = None


class ActivationCodeOut(BaseModel):
    id: int
    name: str
    code_value: str | None = None
    code_hint: str
    plain_code: str | None = None
    max_uses: int | None
    used_count: int
    remaining_uses: int | None
    expires_at: datetime | None
    is_active: bool
    default_role_code: str
    note: str | None
    created_at: datetime
    updated_at: datetime


class ActivationCodeRedemptionOut(BaseModel):
    id: int
    activation_code_id: int
    activation_code_name: str | None = None
    email: str
    username: str
    reason: str | None
    status: str
    clerk_user_id: str | None
    failure_reason: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    updated_at: datetime


class ActivationCodeApprovalRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    username: str = Field(min_length=4, max_length=64)
    activation_code: str = Field(min_length=4, max_length=64)
    reason: str | None = Field(default=None, max_length=1000)


class ActivationCodeApprovalResponse(BaseModel):
    ok: bool
    redemption_id: int
    activation_code_id: int
    status: str
    email: str
    username: str
