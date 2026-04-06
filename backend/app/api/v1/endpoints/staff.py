from uuid import UUID
from fastapi import APIRouter, status
from sqlalchemy import select

from app.core.dependencies import DbSession, RequireStaffManage, RequireTeacherVerify
from app.core.exceptions import PermissionDeniedError, ResourceNotFoundError
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.enums import AuditActionType, UserRole
from app.schemas.user import TeacherProfileRead
from app.core.enums import VerificationStatus
from app.schemas.staff import StaffInviteSchema, StaffUpdateSchema, StaffRead

router = APIRouter()

# ── Staff Management (Requires staff:manage) ───────────────────────────────

@router.post("/invite", status_code=201)
async def invite_staff(
    body: StaffInviteSchema,
    db: DbSession,
    current_staff: User = RequireStaffManage
):
    """
    [STAFF:MANAGE] Create an invite token for a new staff member.
    """
    # Hierarchy Rule #1: The Creation Paradox
    if "staff:manage" in body.permissions and not current_staff.is_superuser:
        raise PermissionDeniedError(detail="Only a Superuser can grant the 'staff:manage' permission.")

    # TODO: Logic to generate secure unique JWT/Token, save to db, and email the user goes here.
    return {"message": "Staff invitation feature is under constructon.", "email": body.email}

@router.put("/management/{target_id}", response_model=StaffRead)
async def update_staff_permissions(
    target_id: UUID,
    body: StaffUpdateSchema,
    db: DbSession,
    current_staff: User = RequireStaffManage
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
        raise PermissionDeniedError(detail="Only a Superuser can grant the 'staff:manage' permission.")

    if body.permissions is not None:
        target_user.permissions = body.permissions
    if body.is_active is not None:
        target_user.is_active = body.is_active

    # Auditing
    audit_log = AuditLog(
        actor_id=current_staff.id,
        action_type=AuditActionType.UPDATE,
        target_user_id=target_user.id,
        description=f"Updated permissions for staff email {target_user.email}"
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
    teacher_id: UUID,
    status: VerificationStatus,
    db: DbSession,
    remarks: str | None = None,
    current_staff: User = RequireTeacherVerify,
):
    """[TEACHER:VERIFY] approve or reject a teacher's verification."""
    pass
