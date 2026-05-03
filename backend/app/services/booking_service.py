from typing import List

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.booking import Booking
from app.models.rating import TeacherRating
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.core.enums import UserRole
from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_bookings_for_user(db: AsyncSession, user_id: int, role: UserRole) -> List[Booking]:
    """Return bookings for a user depending on their role (student or teacher).

    Loads common relationships used by both endpoints to keep queries consistent.
    The rating is always eagerly loaded; it will be None for bookings that have
    not yet been rated, letting the frontend show a prompt or the submitted score.
    """
    base_select = select(Booking).options(
        selectinload(Booking.sessions),
        selectinload(Booking.subject),
        selectinload(Booking.rating).options(
            selectinload(TeacherRating.student).selectinload(StudentProfile.user),
            selectinload(TeacherRating.subject),
        ),
    )

    if role == UserRole.STUDENT:
        stmt = base_select.options(selectinload(Booking.teacher).selectinload(TeacherProfile.user))
        stmt = stmt.where(Booking.student_id == user_id)
    elif role == UserRole.TEACHER:
        stmt = base_select.options(selectinload(Booking.student).selectinload(StudentProfile.user))
        stmt = stmt.where(Booking.teacher_id == user_id)
    else:
        return []

    stmt = stmt.order_by(Booking.created_at.desc())

    result = await db.execute(stmt)
    return result.scalars().all()
