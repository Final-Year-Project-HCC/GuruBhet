from typing import Annotated
from uuid import UUID
import hashlib
from datetime import datetime, UTC
from sqlalchemy import select

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.dependencies import CurrentUser, DbSession
from app.core.enums import UserRole
from app.core.exceptions import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidTokenError,
    MissingTokenError,
    PermissionDeniedError,
    PhoneAlreadyRegisteredError,
    UserDisabledError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.redis import blacklist_jti, cache_get, cache_set, is_jti_blacklisted
from app.models.invitation import StaffInvitation
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshResponse,
    RegisterRequest,
    UserMeResponse,
)
from app.schemas.user import UserRead

router = APIRouter()


# ── Subdomain Role Validation Helper ──────────────────────────────────────────

from urllib.parse import urlparse
import secrets

def get_subdomain(request: Request) -> str | None:
    """
    Extracts subdomain from Origin header (browser) or Host header (fallback).
    """
    # 1. Try Origin first (this is where the frontend lives)
    raw_origin = request.headers.get("origin")

    if raw_origin:
        # urlparse handles 'https://teacher.gurubhet.tech' -> 'teacher.gurubhet.tech'
        host = urlparse(raw_origin).netloc
    else:
        # Fallback to Host (e.g., api.gurubhet.tech)
        host = request.headers.get("host", "")

    # Remove port if present
    host = host.split(":")[0]

    # Development bypass
    if not host or host in ("localhost", "127.0.0.1"):
        return None

    # Logic to identify the 'api' subdomain specifically from the Host
    # if Origin wasn't provided, but we don't want to block internal API calls
    if host.startswith("api."):
        return "api"

    parts = host.split(".")
    # gurubhet.tech (2 parts) -> ""
    # teacher.gurubhet.tech (3 parts) -> "teacher"
    if len(parts) >= 3:
        return parts[0]

    return ""


def validate_subdomain_matches_role(
    request: Request, user_role: Annotated[UserRole, Query(..., alias="userRole")]
) -> None:
    subdomain = get_subdomain(request)

    # Localhost / Dev bypass
    if subdomain is None:
        return

    # IMPORTANT: We allow the 'api' bypass for Swagger UI and server-to-server calls.
    # If a generic browser is used on a real frontend, Origin will be 'teacher.gurubhet.tech' etc.
    if subdomain == "api":
        return

    # Normalized role string (e.g., 'teacher', 'student', 'staff')
    role_str = user_role.value.lower()

    # 1. Student Logic (Root domain "" or "student" subdomain)
    if role_str == "student":
        if subdomain in ("", "student"):
            return

    # 2. Teacher/Staff Logic (Strict subdomain match)
    elif role_str == subdomain:
        return

    # 3. Mismatch Fallback
    # If student is on 'teacher.gurubhet.tech' or teacher is on 'staff.gurubhet.tech'
    correct_sub = "www" if role_str == "student" else role_str
    correct_url = f"https://{correct_sub}.{settings.DOMAIN_NAME}"

    raise PermissionDeniedError(
        detail=f"Wrong website for {user_role.value}s. Go to {correct_url} instead",
        context={
            "expected": role_str,
            "actual": subdomain or "root",
            "correct_url": correct_url,
        },
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DbSession):
    if body.role == UserRole.STAFF:
        raise PermissionDeniedError(detail="Staff accounts can only be created via invitations.")

    repo = UserRepository(db)
    if await repo.email_exists(body.email):
        raise EmailAlreadyRegisteredError(email=body.email)

    if body.phone and await repo.phone_exists(body.phone):
        raise PhoneAlreadyRegisteredError(phone=body.phone)

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

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise EmailAlreadyRegisteredError(email=body.email)

    if user.role == UserRole.STUDENT:
        db.add(StudentProfile(user_id=user.id))
    elif user.role == UserRole.TEACHER:
        db.add(TeacherProfile(user_id=user.id))

    await db.flush()
    await db.refresh(user)

    # Trigger email verification token generation & celery task
    token = secrets.token_urlsafe(32)
    await cache_set(f"verify_email:{token}", str(user.id), expire=86400)
    
    from app.tasks.notification_tasks import send_verification_email
    send_verification_email.delay(email_to=user.email, token=token)

    return user


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: DbSession, response: Response, request: Request):
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise InvalidCredentialsError()
    if not user.is_active or user.is_banned:
        raise UserDisabledError(detail="Account inactive or banned")

    # Validate subdomain matches user role
    validate_subdomain_matches_role(request, user.role)

    perms = []
    if user.role == UserRole.STAFF:
        from app.models.staff import StaffProfile
        from sqlalchemy import select
        result = await db.execute(select(StaffProfile.permissions).where(StaffProfile.user_id == user.id))
        perms = result.scalar_one_or_none() or []

    access = create_access_token(
        user_id=str(user.id),
        role=user.role.value,
        permissions=perms,
        is_superuser=user.is_superuser,
    )
    refresh = create_refresh_token(str(user.id))


    sameSitePolicy = (
        "lax"
        if (settings.ENVIRONMENT == "production" or settings.ENVIRONMENT == "development2")
        else "none"
    )
    securePolicy = False if settings.ENVIRONMENT == "development2" else True
    # Set tokens as HttpOnly cookies with SameSite=Lax
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        samesite=sameSitePolicy,
        secure=securePolicy,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        samesite=sameSitePolicy,
        secure=securePolicy,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )
    return {"message": "Logged in succesfully", "user": user}


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    db: DbSession,
    response: Response,
    request: Request,
    x_refresh_token: str = Header(None, alias="x-refresh-token"),
):
    if not x_refresh_token:
        raise MissingTokenError()
    try:
        payload = decode_token(x_refresh_token)
    except ValueError:
        raise InvalidTokenError()

    if payload.get("type") != "refresh":
        raise InvalidTokenError(detail="Invalid token: not a refresh token")

    # check if presented refresh token is blacklisted (logout or rotation)
    jti = payload.get("jti")
    if not jti:
        raise InvalidTokenError(detail="Invalid token: missing jti")
    if await is_jti_blacklisted(jti):
        raise InvalidTokenError(detail="Refresh token has been revoked")

    repo = UserRepository(db)
    user = await repo.get_by_id(payload["sub"])
    if not user or not user.is_active:
        raise UserDisabledError()

    # Validate subdomain matches user role
    validate_subdomain_matches_role(request, user.role)

    # Rotation: blacklist current refresh token jti until its expiry
    exp = payload.get("exp")
    if exp:
        await blacklist_jti(jti, int(exp))

    perms = []
    if user.role == UserRole.STAFF:
        from app.models.staff import StaffProfile
        from sqlalchemy import select
        result = await db.execute(select(StaffProfile.permissions).where(StaffProfile.user_id == user.id))
        perms = result.scalar_one_or_none() or []

    # Issue new pair
    access = create_access_token(
        user_id=str(user.id),
        role=user.role.value,
        permissions=perms,
        is_superuser=user.is_superuser,
    )
    refresh = create_refresh_token(str(user.id))

    sameSitePolicy = (
        "lax"
        if (settings.ENVIRONMENT == "production" or settings.ENVIRONMENT == "development2")
        else "none"
    )
    securePolicy = False if settings.ENVIRONMENT == "development2" else True
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        samesite=sameSitePolicy,
        secure=securePolicy,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        samesite=sameSitePolicy,
        secure=securePolicy,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )
    return {"message": "tokens rotated", "user": user}


@router.post("/logout")
async def logout(
    db: DbSession, response: Response, x_refresh_token: str = Header(None, alias="x-refresh-token")
):
    """Blacklist presented refresh token (if any) and clear cookies."""
    if not x_refresh_token:
        # still clear cookies client-side
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/api/v1/auth")
        return {"message": "logged out"}

    try:
        payload = decode_token(x_refresh_token)
    except ValueError:
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/api/v1/auth")
        return {"message": "logged out"}

    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        await blacklist_jti(jti, int(exp))

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return {"message": "logged out"}


@router.get("/me", response_model=UserMeResponse)
async def me(current_user: CurrentUser, db: DbSession):
    if current_user.role == UserRole.STAFF:
        from app.models.staff import StaffProfile
        result = await db.execute(
            select(StaffProfile.permissions).where(StaffProfile.user_id == current_user.id)
        )
        perms = result.scalar_one_or_none() or []
        
        # Pydantic v2 dynamic model instantiation
        user_data = UserRead.model_validate(current_user).model_dump()
        user_data["permissions"] = perms
        return UserMeResponse(**user_data)

    return UserMeResponse.model_validate(current_user)

@router.get("/verify/{token}")
async def verify_email(token: str, db: DbSession):
    # Retrieve user_id from Redis
    user_id_str = await cache_get(f"verify_email:{token}")
    
    if user_id_str:
        repo = UserRepository(db)
        user = await repo.get_by_id(UUID(user_id_str) if isinstance(user_id_str, str) else user_id_str)
        if user and user.role in (UserRole.STUDENT, UserRole.TEACHER):
            user.is_email_verified = True
            await db.flush()
            return {"message": "Email verified successfully."}
        raise HTTPException(status_code=400, detail="Invalid token or user not found")
        
    # If not found in Redis, check if it's a pending StaffInvitation
    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    stmt = select(StaffInvitation).where(
        StaffInvitation.token_hash == hashed_token,
        StaffInvitation.is_used == False,
        StaffInvitation.expires_at > datetime.now(UTC)
    )
    result = await db.execute(stmt)
    invitation = result.scalars().first()
    
    if invitation:
        return RedirectResponse(url=f"https://staff.{settings.DOMAIN_NAME}/set-password?token={token}")
        
    raise HTTPException(status_code=400, detail="Invalid or expired token.")

