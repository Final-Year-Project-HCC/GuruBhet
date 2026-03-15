from uuid import UUID
from fastapi import APIRouter
from app.core.dependencies import DbSession, RequireAdmin
from app.schemas.user import TeacherProfileRead
from app.core.enums import VerificationStatus

router = APIRouter()


@router.get("/teachers/pending", response_model=list[TeacherProfileRead])
async def list_pending_teachers(db: DbSession, _=RequireAdmin):
    """Admin: list teachers awaiting document verification."""
    ...


@router.post("/teachers/{teacher_id}/verify")
async def verify_teacher(
    teacher_id: UUID,
    status: VerificationStatus,
    remarks: str | None = None,
    db: DbSession = None,
    _=RequireAdmin,
):
    """Admin: approve or reject a teacher's verification."""
    ...


@router.get("/stats")
async def platform_stats(db: DbSession, _=RequireAdmin):
    """Admin dashboard: users, bookings, revenue, payouts summary."""
    ...