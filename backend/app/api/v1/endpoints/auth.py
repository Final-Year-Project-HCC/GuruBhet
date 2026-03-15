from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import DbSession, CurrentUser
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.enums import UserRole
from app.models.user import User
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.repositories.user_repo import UserRepository
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.schemas.user import UserRead

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DbSession):
    repo = UserRepository(db)
    if await repo.email_exists(body.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        first_name=body.first_name,
        middle_name=body.middle_name,
        last_name=body.last_name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=UserRole(body.role),
    )
    db.add(user)
    await db.flush()

    if user.role == UserRole.STUDENT:
        db.add(StudentProfile(user_id=user.id))
    elif user.role == UserRole.TEACHER:
        db.add(TeacherProfile(user_id=user.id))

    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DbSession):
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active or user.is_banned:
        raise HTTPException(status_code=403, detail="Account inactive or banned")

    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: DbSession):
    try:
        payload = decode_token(body.refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    repo = UserRepository(db)
    user = await repo.get_by_id(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me", response_model=UserRead)
async def me(current_user: CurrentUser):
    return current_user