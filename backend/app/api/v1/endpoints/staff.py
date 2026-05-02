import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import DbSession, RequireStaffManage, RequireTeacherVerify
from app.core.enums import AuditActionType, UserRole, VerificationStatus
from app.core.exceptions import ConflictError, PermissionDeniedError, TeacherNotFoundError
from app.core.security import hash_password
from app.core.socketio import get_socketio_manager
from app.models.audit_log import AuditLog
from app.models.invitation import StaffInvitation
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.schemas.staff import (
    StaffAcceptInviteSchema,
    StaffInviteSchema,
    StaffRead,
    StaffUpdateSchema,
    TeacherPendingOverview,
    TeacherProfileForVerificationRead,
    TeacherVerificationDecision,
)
from app.tasks.notification_tasks import send_staff_invite_email

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Staff Management (Requires staff:manage) ───────────────────────────────


@router.post("/invite", status_code=201)
async def invite_staff(
    body: StaffInviteSchema, db: DbSession, current_staff: User = RequireStaffManage
):
    """
    [STAFF:MANAGE] Create an invite token for a new staff member.
    """
    # Hierarchy Rule #1: The Creation Paradox
    if "staff:manage" in body.permissions and not current_staff.is_superuser:
        raise PermissionDeniedError(
            detail="Only a Superuser can grant the 'staff:manage' permission."
        )

    # Check if user already exists
    existing_user = await db.scalar(select(User).where(User.email == body.email))
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    # Generate a secure 32-character token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    # Determine Superuser inheritance rule
    grant_superuser = current_staff.is_superuser and "superuser" in body.permissions
    cleaned_permissions = [p for p in body.permissions if p != "superuser"]

    # Store invitation
    invitation = StaffInvitation(
        email=body.email,
        token_hash=token_hash,
        permissions=cleaned_permissions,
        is_superuser=grant_superuser,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        invited_by_id=current_staff.id,
    )
    db.add(invitation)

    # Auditing
    audit_log = AuditLog(
        actor_id=current_staff.id,
        action_type=AuditActionType.CREATE,
        description=f"Generated staff invite for {body.email}",
    )
    db.add(audit_log)
    await db.commit()

    # Send `raw_token` via Email asynchronously
    send_staff_invite_email.delay(email_to=body.email, raw_token=raw_token)

    return {
        "message": "Invite generated successfully",
        "email": body.email,
        "invite_token": raw_token,
    }


@router.post("/accept-invite", status_code=status.HTTP_201_CREATED, response_model=StaffRead)
async def accept_staff_invite(body: StaffAcceptInviteSchema, db: DbSession):
    """
    Public endpoint for staff to accept their invitation using the single-use token.
    """
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()

    # Find active invitation
    invitation = await db.scalar(
        select(StaffInvitation).where(
            StaffInvitation.token_hash == token_hash,
            StaffInvitation.is_used == False,
            StaffInvitation.expires_at > datetime.now(UTC),
        )
    )

    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")

    # Check if email was taken in the meantime
    existing_user = await db.scalar(select(User).where(User.email == invitation.email))
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    # Create the Staff User
    new_staff = User(
        first_name=body.first_name,
        last_name=body.last_name,
        email=invitation.email,
        password_hash=hash_password(body.password),
        role=UserRole.STAFF,
        is_email_verified=True,  # Implies verified since it came via email invite
        is_superuser=invitation.is_superuser,
    )
    db.add(new_staff)
    await db.flush()

    from app.models.staff import StaffProfile
    staff_profile = StaffProfile(
        user_id=new_staff.id,
        permissions=invitation.permissions
    )
    db.add(staff_profile)

    # Mark token as used
    invitation.is_used = True

    await db.commit()
    await db.refresh(new_staff)

    # Pydantic compat for StaffRead
    new_staff.permissions = invitation.permissions

    return new_staff


@router.put("/management/{target_id}", response_model=StaffRead)
async def update_staff_permissions(
    target_id: Annotated[UUID, Path(..., alias="targetId")],
    body: StaffUpdateSchema,
    db: DbSession,
    current_staff: User = RequireStaffManage,
):
    """
    [STAFF:MANAGE] Update a staff member's permissions or active status.
    """
    target_user = await db.scalar(select(User).where(User.id == target_id))
    if not target_user or target_user.role != UserRole.STAFF:
        raise ResourceNotFoundError(detail="Staff user not found.")

    # Hierarchy Rule #2: Protection Axiom
    if target_user.is_superuser and current_staff.id != target_user.id:
        raise PermissionDeniedError(detail="You cannot modify a superuser profile.")

    # Hierarchy Rule #1 (Editing target): Superuser granting staff:manage
    if body.permissions and "staff:manage" in body.permissions and not current_staff.is_superuser:
        raise PermissionDeniedError(
            detail="Only a Superuser can grant the 'staff:manage' permission."
        )

    if body.permissions is not None:
        from app.models.staff import StaffProfile
        staff_profile = await db.scalar(select(StaffProfile).where(StaffProfile.user_id == target_user.id))
        if staff_profile:
            staff_profile.permissions = body.permissions
        target_user.permissions = body.permissions
    else:
        from app.models.staff import StaffProfile
        staff_profile = await db.scalar(select(StaffProfile).where(StaffProfile.user_id == target_user.id))
        target_user.permissions = staff_profile.permissions if staff_profile else []

    if body.is_active is not None:
        target_user.is_active = body.is_active

    # Auditing
    audit_log = AuditLog(
        actor_id=current_staff.id,
        action_type=AuditActionType.UPDATE,
        target_user_id=target_user.id,
        description=f"Updated permissions for staff email {target_user.email}",
    )
    db.add(audit_log)
    await db.commit()

    return target_user


# ── Teacher Approvals (Requires teacher:verify) ───────────────────────────


async def _emit_profile_verified(teacher_id: UUID, decision: TeacherVerificationDecision) -> None:
    """Background task: emit 'profile_verified' socket event to the teacher."""
    try:
        sio = get_socketio_manager()
        if not sio:
            logger.warning("SocketIO manager unavailable; skipping profile_verified emit")
            return
        await sio.emit_to_user(
            teacher_id,
            "profile_verified",
            {"action": decision.action.value, "remarks": decision.remarks},
        )
    except Exception as exc:
        logger.warning(f"profile_verified socket emit failed for teacher {teacher_id}: {exc}")


@router.get("/teachers/pending", response_model=list[TeacherPendingOverview])
async def list_pending_teachers(
    db: DbSession,
    current_staff: User = RequireTeacherVerify,
    page: int = Query(1, ge=1),
):
    """
    [TEACHER:VERIFY] Paginated overview list of pending teacher profiles,
    oldest first. Each page returns up to 10 items.
    """
    page_size = 10
    offset = (page - 1) * page_size
    result = await db.execute(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.user))
        .where(TeacherProfile.document_status == VerificationStatus.PENDING)
        .order_by(TeacherProfile.created_at.asc())
        .offset(offset)
        .limit(page_size)
    )
    profiles = result.scalars().all()
    return [
        TeacherPendingOverview(
            user_id=p.user_id,
            first_name=p.user.first_name,
            middle_name=p.user.middle_name,
            last_name=p.user.last_name,
            email=p.user.email,
            avatar_url=p.user.avatar_url,
            created_at=p.created_at,
        )
        for p in profiles
    ]


@router.get("/teachers/pending/{teacher_id}", response_model=TeacherProfileForVerificationRead)
async def get_pending_teacher_detail(
    teacher_id: Annotated[UUID, Path(..., alias="teacherId")],
    db: DbSession,
    current_staff: User = RequireTeacherVerify,
):
    """
    [TEACHER:VERIFY] Full profile detail for a single pending teacher,
    including all documents, bio, and tagline.
    """
    result = await db.execute(
        select(TeacherProfile)
        .options(
            selectinload(TeacherProfile.user),
            selectinload(TeacherProfile.documents),
        )
        .where(
            TeacherProfile.user_id == teacher_id,
            TeacherProfile.document_status == VerificationStatus.PENDING,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(teacher_id))
    return profile


@router.post("/teachers/{teacher_id}/verify", response_model=TeacherProfileForVerificationRead)
async def verify_teacher(
    teacher_id:UUID,
    body: TeacherVerificationDecision,
    background_tasks: BackgroundTasks,
    db: DbSession,
    current_staff: User = RequireTeacherVerify,
):
    """
    [TEACHER:VERIFY] Approve or reject a teacher's profile.

    Race-condition safe: SELECT ... FOR UPDATE locks the row so concurrent requests
    on the same teacher block until this transaction commits, then see
    document_status != PENDING and receive 409.
    """
    # Acquire a row-level write lock before reading state.
    result = await db.execute(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.documents))
        .where(TeacherProfile.user_id == teacher_id)
        .with_for_update()
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(teacher_id))

    if profile.document_status != VerificationStatus.PENDING:
        raise ConflictError(detail="This profile has already been reviewed.")

    now = datetime.now(UTC)
    profile.document_status = body.action
    profile.reviewed_by_id = current_staff.id
    profile.reviewed_at = now
    profile.remarks = body.remarks

    db.add(
        AuditLog(
            actor_id=current_staff.id,
            action_type=AuditActionType.VERIFY,
            target_user_id=teacher_id,
            description=f"Teacher profile {body.action.value} by staff {current_staff.email}",
        )
    )

    # Flush so the re-fetch below sees the updated state within this transaction.
    await db.flush()

    result = await db.execute(
        select(TeacherProfile)
        .options(
            selectinload(TeacherProfile.user),
            selectinload(TeacherProfile.documents),
        )
        .where(TeacherProfile.user_id == teacher_id)
    )
    updated_profile = result.scalar_one()

    # Registered here; executes only after DatabaseSessionManager commits and the
    # 2xx response is fully sent — never fires if the DB write fails.
    background_tasks.add_task(_emit_profile_verified, teacher_id, body)

    return updated_profile
