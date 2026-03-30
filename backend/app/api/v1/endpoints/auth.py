from fastapi import APIRouter, HTTPException, status
from fastapi import Response, Header

from app.core.dependencies import DbSession, CurrentUser
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.enums import UserRole
from app.core.config import settings
from app.models.user import User
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.repositories.user_repo import UserRepository
from app.db.redis import blacklist_jti, is_jti_blacklisted
from datetime import datetime, timezone
from jose import JWTError
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest
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


@router.post("/login")
async def login(body: LoginRequest, db: DbSession, response: Response):
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active or user.is_banned:
        raise HTTPException(status_code=403, detail="Account inactive or banned")

    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id))

    # Set tokens as HttpOnly cookies with SameSite=Lax
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "production"),
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "production"),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )
    return {"message":"Logged in succesfully"}


@router.post("/refresh")
async def refresh(db: DbSession, response: Response, x_refresh_token: str = Header(None, alias="x-refresh-token")):
    if not x_refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    try:
        payload = decode_token(x_refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    # check if presented refresh token is blacklisted (logout or rotation)
    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=401, detail="Invalid token (no jti)")
    if await is_jti_blacklisted(jti):
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    repo = UserRepository(db)
    user = await repo.get_by_id(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    # Rotation: blacklist current refresh token jti until its expiry
    exp = payload.get("exp")
    if exp:
        await blacklist_jti(jti, int(exp))

    # Issue new pair
    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id))

    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "production"),
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "production"),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )
    return {"message": "tokens rotated"}


@router.post("/logout")
async def logout(db: DbSession, response: Response, x_refresh_token: str = Header(None, alias="x-refresh-token")):
    """Blacklist presented refresh token (if any) and clear cookies."""
    if not x_refresh_token:
        # still clear cookies client-side
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/auth")
        return {"message": "logged out"}

    try:
        payload = decode_token(x_refresh_token)
    except ValueError:
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/auth/refresh")
        return {"message": "logged out"}

    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        await blacklist_jti(jti, int(exp))

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return {"message": "logged out"}


@router.get("/me", response_model=UserRead)
async def me(current_user: CurrentUser):
    return current_user