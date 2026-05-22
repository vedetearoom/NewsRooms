from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Table, Text
from sqlalchemy.sql import func

from app.database import Base


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    display_name = Column(String(255), nullable=False)
    password_hash = Column(String(512), nullable=True)
    clerk_user_id = Column(String(255), nullable=True, unique=True, index=True)
    clerk_deleted_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    github_token = Column(String(255), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False, unique=True)
    code = Column(String(64), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    quota_limits = Column(JSON, nullable=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(128), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    permission_group = Column(String(128), nullable=False, default="general")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ActivationCode(Base):
    __tablename__ = "activation_codes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    code_hash = Column(String(128), nullable=False, unique=True, index=True)
    code_value = Column(String(64), nullable=True)
    code_hint = Column(String(32), nullable=False)
    max_uses = Column(Integer, nullable=True)
    used_count = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    default_role_code = Column(String(64), nullable=False, default="user")
    note = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ActivationCodeRedemption(Base):
    __tablename__ = "activation_code_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    activation_code_id = Column(Integer, ForeignKey("activation_codes.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    username = Column(String(64), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="approved", index=True)
    clerk_user_id = Column(String(255), nullable=True, index=True)
    failure_reason = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
