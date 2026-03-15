from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re


class RegisterRequest(BaseModel):
    first_name: str
    middle_name: str | None = None
    last_name: str
    email: EmailStr
    phone: str | None = None
    password: str
    role: str  # "STUDENT" | "TEACHER"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("STUDENT", "TEACHER"):
            raise ValueError("Role must be STUDENT or TEACHER")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str