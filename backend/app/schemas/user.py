from uuid import UUID
from datetime import datetime
from pydantic import EmailStr, field_validator

from app.core.enums import UserRole, VerificationStatus
import re
from .base import SharedConfig


class UserBase(SharedConfig):

    first_name: str
    middle_name: str | None = None
    last_name: str
    email: EmailStr
    phone: str | None = None


class PasswordChangeRequest(SharedConfig):

    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v


class UserRead(UserBase):

    id: UUID
    role: UserRole
    is_email_verified: bool
    is_active: bool
    is_banned: bool
    created_at: datetime


class StudentProfileRead(SharedConfig):

    user_id: UUID
    bio: str | None
    avatar_url: str | None


class StudentProfileUpdate(SharedConfig):

    bio: str | None = None
    avatar_url: str | None = None


class TeacherProfileRead(SharedConfig):

    user_id: UUID
    bio: str | None
    avatar_url: str | None
    headline: str | None
    verification_status: VerificationStatus


class TeacherProfileUpdate(SharedConfig):

    bio: str | None = None
    avatar_url: str | None = None
    headline: str | None = None
