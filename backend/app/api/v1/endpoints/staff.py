import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, status
from sqlalchemy import select

from app.core.dependencies import DbSession, RequireStaffManage, RequireTeacherVerify
from app.core.enums import AuditActionType, UserRole, VerificationStatus
from app.core.exceptions import PermissionDeniedError, ResourceNotFoundError
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.invitation import StaffInvitation
from app.models.user import User
from app.schemas.staff import (
    StaffAcceptInviteSchema,
    StaffInviteSchema,
    StaffRead,
    StaffUpdateSchema,
)
from app.schemas.user import TeacherProfileRead
from app.tasks.notification_tasks import send_staff_invite_email

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
    await db.flush()

    return target_user


# ── Teacher Approvals (Requires teacher:verify) ───────────────────────────


@router.get("/teachers/pending", response_model=list[TeacherProfileRead])
async def list_pending_teachers(db: DbSession, current_staff: User = RequireTeacherVerify):
    """[TEACHER:VERIFY] list teachers awaiting document verification."""
    return []


@router.post("/teachers/{teacher_id}/verify")
async def verify_teacher(
    teacher_id: Annotated[UUID, Path(..., alias="teacherId")],
    status: VerificationStatus,
    db: DbSession,
    remarks: str | None = None,
    current_staff: User = RequireTeacherVerify,
):
    """[TEACHER:VERIFY] approve or reject a teacher's verification."""
    pass


from pydantic import BaseModel

class VerifyTeacherRequest(BaseModel):
    document_status: VerificationStatus
    is_payment_verified: bool = False
    remarks: str | None = None

@router.patch("/verify-teacher/{teacher_id}")
async def verify_teacher_documents(
    teacher_id: UUID,
    body: VerifyTeacherRequest,
    db: DbSession,
    current_staff: User = RequireStaffManage,
):
    """[STAFF:MANAGE] approve or reject a teacher's verification documents and payment info."""
    from app.models.teacher import TeacherProfile
    from app.core.exceptions import TeacherNotFoundError
    from datetime import datetime, UTC
    
    result = await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == teacher_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(teacher_id))
        
    profile.document_status = body.document_status
    profile.is_payment_verified = body.is_payment_verified
    profile.reviewed_by_id = current_staff.id
    profile.reviewed_at = datetime.now(UTC)
    
    # Store remarks in audit or somewhere if needed, but not strictly asked for
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    
    return {"msg": f"Teacher verification updated to {body.document_status.value}"}

