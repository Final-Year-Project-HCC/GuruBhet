from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query
from sqlalchemy import select

from app.core.dependencies import CurrentUser, DbSession
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
from app.schemas.session import SessionDetailedReadForStudent
from app.services.session_service import fetch_sessions_for_user
from app.schemas.user import StudentProfileRead, StudentProfileUpdate
from app.services.booking_service import fetch_bookings_for_user

router = APIRouter()

# ── Own profile ───────────────────────────────────────────────────────────────


@router.get("/me/profile", response_model=StudentProfileRead)
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


@router.patch("/me/profile", response_model=StudentProfileRead)
async def update_my_profile(
    body: StudentProfileUpdate,
    current_user: CurrentUser,
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

    await db.commit()
    await db.refresh(profile)
    return profile


# ── Own bookings ──────────────────────────────────────────────────────────────


@router.get("/me/sessions/in-progress", response_model=list[SessionDetailedReadForStudent])
async def get_my_sessions(current_user: CurrentUser, db: DbSession):
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
    sessions = await fetch_sessions_for_user(db, current_user.id, UserRole.STUDENT, in_progress=True)
    return sessions


@router.get("/me/bookings", response_model=list[BookingDetailedReadForStudent])
async def get_my_bookings(current_user: CurrentUser, db: DbSession):
    """Return all bookings for the logged-in student with teacher and subject details."""
    if current_user.role != UserRole.STUDENT:
        raise PermissionDeniedError(detail="Only students can access this")
    bookings = await fetch_bookings_for_user(db, current_user.id, UserRole.STUDENT)
    return bookings


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
