from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.dependencies import DbSession, CurrentUser, RequireAdmin
from app.core.enums import UserRole
from app.models.student import StudentProfile
from app.models.booking import Booking
from app.schemas.user import StudentProfileRead, StudentProfileUpdate
from app.schemas.booking import BookingRead, BookingDetailedReadForStudent

router = APIRouter()


# ── Own profile ───────────────────────────────────────────────────────────────

@router.get("/me", response_model=StudentProfileRead)
async def get_my_profile(current_user: CurrentUser, db: DbSession):
    """Return the logged-in student's profile."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can access this")

    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile


@router.patch("/me", response_model=StudentProfileRead)
async def update_my_profile(
    body: StudentProfileUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update the logged-in student's bio and avatar."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can access this")

    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if body.bio is not None:
        profile.bio = body.bio
    if body.avatar_url is not None:
        profile.avatar_url = body.avatar_url

    await db.flush()
    await db.refresh(profile)
    return profile


# ── Own bookings ──────────────────────────────────────────────────────────────

@router.get("/me/bookings", response_model=list[BookingDetailedReadForStudent])
async def get_my_bookings(current_user: CurrentUser, db: DbSession):
    """Return all bookings for the logged-in student with teacher and subject details."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can access this")

    from sqlalchemy.orm import selectinload
    from app.models.teacher import TeacherProfile

    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.sessions),
            selectinload(Booking.teacher).selectinload(TeacherProfile.user),
            selectinload(Booking.subject)
        )
        .where(Booking.student_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    return list(result.scalars().all())


# ── Public profile (viewable by teachers and admins) ─────────────────────────

@router.get("/{student_id}", response_model=StudentProfileRead)
async def get_student_profile(
    student_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Fetch a student's public profile.
    Accessible by the student themselves, teachers they have bookings with, and admins.
    """
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == student_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Student not found")

    # Student can view their own profile
    if current_user.id == student_id:
        return profile

    # Admin can view any profile
    if current_user.role == UserRole.ADMIN:
        return profile

    # Teacher can only view if they have a shared booking with this student
    if current_user.role == UserRole.TEACHER:
        booking_result = await db.execute(
            select(Booking).where(
                Booking.student_id == student_id,
                Booking.teacher_id == current_user.id,
            ).limit(1)
        )
        if booking_result.scalar_one_or_none():
            return profile

    raise HTTPException(status_code=403, detail="Not authorised to view this profile")