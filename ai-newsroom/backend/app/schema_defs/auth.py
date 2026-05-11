from datetime import datetime

from pydantic import BaseModel, Field


class PermissionOut(BaseModel):
    id: int
    code: str
    name: str
    permission_group: str
    description: str | None = None

    model_config = {"from_attributes": True}


class RoleBase(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    code: str = Field(min_length=2, max_length=64)
    description: str | None = None


class RoleCreate(RoleBase):
    permission_codes: list[str] = []
    quota_limits: dict[str, int | None] | None = None


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    code: str | None = Field(default=None, min_length=2, max_length=64)
    description: str | None = None
    permission_codes: list[str] | None = None
    quota_limits: dict[str, int | None] | None = None


class RoleOut(RoleBase):
    id: int
    is_system: bool
    quota_limits: dict[str, int | None] | None = None
    permissions: list[PermissionOut] = []
    user_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=5, max_length=255)
    display_name: str = Field(min_length=2, max_length=255)


class RegisterRequest(UserBase):
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)
    role_codes: list[str] = []
    is_active: bool = True


class UserUpdate(BaseModel):
    email: str | None = Field(default=None, min_length=5, max_length=255)
    display_name: str | None = Field(default=None, min_length=2, max_length=255)
    role_codes: list[str] | None = None
    is_active: bool | None = None


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class UserOut(UserBase):
    id: int
    is_active: bool
    is_super_admin: bool
    roles: list[RoleOut] = []
    permissions: list[str] = []
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CurrentUserOut(UserOut):
    pass
