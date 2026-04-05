from fastapi import APIRouter, status, Request
from fastapi import Response, Header
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import DbSession, CurrentUser
from app.core.exceptions import (
    EmailAlreadyRegisteredError,
    PhoneAlreadyRegisteredError,
    InvalidCredentialsError,
    PermissionDeniedError,
    MissingTokenError,
    InvalidTokenError,
    UserDisabledError,
)
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


# ── Subdomain Role Validation Helper ──────────────────────────────────────────

def get_subdomain_from_host(host: str | None) -> str | None:
    """
    Extract subdomain from Host header.
    
    Examples:
      'student.gurubhet.tech' → 'student'
      'localhost:3000' → None
      '127.0.0.1:3000' → None
      'teacher.gurubhet.tech:8000' → 'teacher'
    """
    if not host:
        return None
    
    # Remove port if present
    host_without_port = host.split(':')[0]
    
    # Localhost and 127.0.0.1 bypass subdomain check
    if host_without_port in ('localhost', '127.0.0.1'):
        return None
    
    # Extract subdomain from domain
    parts = host_without_port.split('.')
    if len(parts) >= 3:  # Has subdomain
        return parts[0]
    
    return None


def validate_subdomain_matches_role(host: str | None, user_role: UserRole) -> None:
    """
    Validate that the request origin subdomain matches the user's role.
    
    Rules:
    - STUDENT ↔ student.<DOMAIN_NAME> or api.<DOMAIN_NAME> (all apps call API)
    - TEACHER ↔ teacher.<DOMAIN_NAME> or api.<DOMAIN_NAME>
    - STAFF ↔ staff.<DOMAIN_NAME> or api.<DOMAIN_NAME>
    - Localhost/127.0.0.1: Always allowed (development)
    - api.<DOMAIN_NAME>: Always allowed (all apps call the API from here)
    
    Raises PermissionDeniedError if mismatch.
    """
    subdomain = get_subdomain_from_host(host)
    
    # Localhost is always allowed (development)
    if subdomain is None:
        return
    
    # API subdomain is always allowed (all apps call the API from api.gurubhet.tech)
    if subdomain == 'api':
        return
    
    # Map role to expected subdomain
    role_to_subdomain = {
        UserRole.STUDENT: 'student',
        UserRole.TEACHER: 'teacher',
        UserRole.STAFF: 'staff',
    }
    
    expected_subdomain = role_to_subdomain.get(user_role)
    if not expected_subdomain:
        raise PermissionDeniedError(
            detail=f"Invalid user role: {user_role.value}"
        )
    
    if subdomain != expected_subdomain:
        correct_url = f"https://{expected_subdomain}.{settings.DOMAIN_NAME}"
        raise PermissionDeniedError(
            detail=f"Wrong website for {user_role.value}s. Go to {correct_url} instead",
            context={
                "expected_subdomain": expected_subdomain,
                "requested_from": subdomain,
                "user_role": user_role.value,
                "correct_url": correct_url,
            }
        )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DbSession):
    repo = UserRepository(db)
    if await repo.email_exists(body.email):
        raise EmailAlreadyRegisteredError(email=body.email)
    
    if await repo.phone_exists(body.phone):
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
    return user


@router.post("/login")
async def login(body: LoginRequest, db: DbSession, response: Response, request: Request):
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise InvalidCredentialsError()
    if not user.is_active or user.is_banned:
        raise UserDisabledError(detail="Account inactive or banned")

    # Validate subdomain matches user role
    host = request.headers.get("host")
    validate_subdomain_matches_role(host, user.role)

    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id))


    sameSitePolicy = "lax" if (settings.ENVIRONMENT=="production" or settings.ENVIRONMENT == "development2") else "none"
    securePolicy = False if settings.ENVIRONMENT == "development2" else True
    # Set tokens as HttpOnly cookies with SameSite=Lax
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        samesite=sameSitePolicy,
        secure= securePolicy,
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
    return {"message":"Logged in succesfully"}


@router.post("/refresh")
async def refresh(db: DbSession, response: Response, request: Request, x_refresh_token: str = Header(None, alias="x-refresh-token")):
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
    host = request.headers.get("host")
    validate_subdomain_matches_role(host, user.role)

    # Rotation: blacklist current refresh token jti until its expiry
    exp = payload.get("exp")
    if exp:
        await blacklist_jti(jti, int(exp))

    # Issue new pair
    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id))

    sameSitePolicy = "lax" if (settings.ENVIRONMENT=="production" or settings.ENVIRONMENT == "development2") else "none"
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
    return {"message": "tokens rotated"}


@router.post("/logout")
async def logout(db: DbSession, response: Response, x_refresh_token: str = Header(None, alias="x-refresh-token")):
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


@router.get("/me", response_model=UserRead)
async def me(current_user: CurrentUser):
    return current_user