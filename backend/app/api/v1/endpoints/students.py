from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query
from sqlalchemy import select

from app.core.dependencies import CurrentUser, DbSession, RequireVerifiedEmail
from app.core.enums import SessionStatus, UserRole
from app.core.exceptions import (
    PermissionDeniedError,
    StudentNotFoundError,
)
from app.models.booking import Booking, Session
from app.models.student import StudentProfile
from app.models.subject import Subject
from app.models.user import User
from app.schemas.booking import BookingDetailedReadForStudent
from app.schemas.session import StudentSessionRead
from app.schemas.user import StudentProfileRead, StudentProfileUpdate

router = APIRouter()

# ── Own profile ───────────────────────────────────────────────────────────────


@router.get("/me", response_model=StudentProfileRead)
async def get_my_profile(current_user: CurrentUser, db: DbSession):
    """Return the logged-in student's profile."""
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can access this")

    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise StudentNotFoundError(student_id=str(current_user.id))
    return profile


@router.patch("/me", response_model=StudentProfileRead)
async def update_my_profile(
    body: StudentProfileUpdate,
    current_user: Annotated[User, RequireVerifiedEmail],
    db: DbSession,
):
    """Update the logged-in student's bio and avatar."""
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can access this")

    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise StudentNotFoundError(student_id=str(current_user.id))

    if body.bio is not None:
        profile.bio = body.bio
    if body.avatar_url is not None:
        profile.avatar_url = body.avatar_url

    await db.flush()
    await db.refresh(profile)
    return profile


# ── Own bookings ──────────────────────────────────────────────────────────────


@router.get("/me/sessions", response_model=list[StudentSessionRead])
async def get_my_sessions(
    current_user: Annotated[User, RequireVerifiedEmail],
    db: DbSession,
    in_progress: bool = Query(default=True, description="Filter for in-progress sessions"),
):
    """
    Return sessions for the logged-in student.
    By default, only returns sessions with status IN_PROGRESS.
    """
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can access this")

    # Verify student profile exists
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )
    if not profile_result.scalar_one_or_none():
        raise StudentNotFoundError(student_id=str(current_user.id))

    query = (
        select(
            Session.id,
            Session.booking_id,
            Session.status,
            User.first_name,
            User.last_name,
            Subject.name.label("subject_name"),
        )
        .join(Booking, Session.booking_id == Booking.id)
        .join(User, Booking.teacher_id == User.id)
        .join(Subject, Booking.subject_id == Subject.id)
        .where(Booking.student_id == current_user.id)
    )

    if in_progress:
        query = query.where(Session.status == SessionStatus.IN_PROGRESS)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": row.id,
            "booking_id": row.booking_id,
            "status": row.status,
            "teacher_name": f"{row.first_name} {row.last_name}",
            "subject_name": row.subject_name,
        }
        for row in rows
    ]


@router.get("/me/bookings", response_model=list[BookingDetailedReadForStudent])
async def get_my_bookings(current_user: Annotated[User, RequireVerifiedEmail], db: DbSession):
    """Return all bookings for the logged-in student with teacher and subject details."""
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can access this")

    from sqlalchemy.orm import selectinload

    from app.models.teacher import TeacherProfile

    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.sessions),
            selectinload(Booking.teacher).selectinload(TeacherProfile.user),
            selectinload(Booking.subject),
        )
        .where(Booking.student_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    return list(result.scalars().all())


# ── Public profile (viewable by teachers and staff) ────────────────────────────


@router.get("/{student_id}", response_model=StudentProfileRead)
async def get_student_profile(
    student_id: Annotated[UUID, Path(..., alias="studentId")],
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Fetch a student's public profile.
    Accessible by the student themselves, teachers they have bookings with, and staff.
    """
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == student_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise StudentNotFoundError(student_id=str(student_id))

    # Student can view their own profile
    if current_user.id == student_id:
        return profile

    # Staff can view any profile
    if current_user.role == UserRole.STAFF:
        return profile

    # Teacher can only view if they have a shared booking with this student
    if current_user.role == UserRole.TEACHER:
        booking_result = await db.execute(
            select(Booking)
            .where(
                Booking.student_id == student_id,
                Booking.teacher_id == current_user.id,
            )
            .limit(1)
        )
        if booking_result.scalar_one_or_none():
            return profile

    raise PermissionDeniedError(detail="Cannot view this student profile")
