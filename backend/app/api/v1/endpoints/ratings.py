from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import CurrentUser, DbSession
from app.core.enums import BookingStatus
from app.core.exceptions import (
    BookingNotFoundError,
    ConflictError,
    InvalidRequestError,
    PermissionDeniedError,
)
from app.models.booking import Booking
from app.models.rating import TeacherRating
from app.repositories.teacher_subject_repo import TeacherSubjectRepository
from app.schemas.rating import RatingCreate, RatingRead

router = APIRouter()


@router.post("/", response_model=RatingRead, status_code=201)
async def submit_rating(body: RatingCreate, current_user: CurrentUser, db: DbSession):
    """
    Student submits a rating for a completed booking.
    - One rating per booking (enforced by DB UNIQUE on booking_id).
    - 7-day window after booking.completed_at.
    - Updates TeacherSubject.avg_rating/rating_count AND
      TeacherProfile.avg_rating/rating_count atomically.
    """
    result = await db.execute(select(Booking).where(Booking.id == body.booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(str(body.booking_id))

    if booking.student_id != current_user.id:
        raise PermissionDeniedError("Only the booking's student can submit a rating")

    _RATABLE_STATUSES = {
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED_BY_STUDENT,
        BookingStatus.CANCELLED_BY_TEACHER,
    }
    if booking.status not in _RATABLE_STATUSES:
        raise InvalidRequestError("You can only rate a booking that has ended")

    if booking.completed_sessions == 0 and booking.status != BookingStatus.CANCELLED_BY_TEACHER:
        raise InvalidRequestError("Cannot rate a booking with no completed sessions")

    # For naturally completed bookings completed_at is always set.
    # For cancelled bookings (completed_sessions > 0) completed_at is also set,
    # but as a safety net fall back to cancelled_at for pre-migration rows.
    window_start = booking.completed_at or booking.cancelled_at
    if window_start is None:
        raise InvalidRequestError("Booking has no completion timestamp")

    completed_at = (
        window_start.replace(tzinfo=timezone.utc)
        if window_start.tzinfo is None
        else window_start
    )
    if (datetime.now(tz=timezone.utc) - completed_at) > timedelta(days=7):
        raise InvalidRequestError("Rating window has closed (7 days after booking completion)")

    existing = await db.execute(
        select(TeacherRating).where(TeacherRating.booking_id == body.booking_id)
    )
    if existing.scalar_one_or_none():
        raise ConflictError("A rating for this booking already exists")

    rating = TeacherRating(
        booking_id=body.booking_id,
        teacher_id=booking.teacher_id,
        subject_id=booking.subject_id,
        student_id=current_user.id,
        score=body.score,
        comment=body.comment,
    )
    db.add(rating)
    try:
        await db.flush()  # populate rating.id; DB UNIQUE constraint fires here
    except IntegrityError:
        await db.rollback()
        raise ConflictError("A rating for this booking already exists")

    # Update TeacherSubject + TeacherProfile aggregates in the same transaction
    await TeacherSubjectRepository(db).update_rating_aggregate(
        teacher_id=booking.teacher_id,
        subject_id=booking.subject_id,
        new_score=body.score,
    )

    await db.commit()
    await db.refresh(rating)
    return rating


@router.get("/teacher/{teacher_id}", response_model=list[RatingRead])
async def get_teacher_ratings(
    teacher_id: Annotated[UUID, Path(..., alias="teacherId")],
    db: DbSession,
    subject_id: UUID | None = Query(default=None, alias="subjectId"),
):
    """Public: list a teacher's ratings, optionally filtered by subject."""
    filters = [TeacherRating.teacher_id == teacher_id]
    if subject_id:
        filters.append(TeacherRating.subject_id == subject_id)

    result = await db.execute(
        select(TeacherRating)
        .where(and_(*filters))
        .order_by(TeacherRating.created_at.desc())
    )
    return list(result.scalars().all())
