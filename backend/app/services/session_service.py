from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.booking import Session, Booking
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.core.enums import UserRole
from app.core.enums import SessionStatus
from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_sessions_for_user(
    db: AsyncSession, user_id: int, role: UserRole, in_progress: Optional[bool] = None
) -> List[dict]:
    """Return serialized session dicts for a user depending on their role.

    - Loads booking, booking.teacher/booking.student and booking.subject relationships.
    - If `in_progress` is True, filters sessions to SessionStatus.IN_PROGRESS.
    """
    base_select = select(Session).options(
        selectinload(Session.booking).selectinload(Booking.subject),
        selectinload(Session.booking).selectinload(Booking.sessions),
    )

    if role == UserRole.STUDENT:
        stmt = base_select.options(
            selectinload(Session.booking).selectinload(Booking.teacher).selectinload(TeacherProfile.user)
        )
        stmt = stmt.join(Booking, Session.booking_id == Booking.id).where(Booking.student_id == user_id)
    elif role == UserRole.TEACHER:
        stmt = base_select.options(
            selectinload(Session.booking).selectinload(Booking.student).selectinload(StudentProfile.user)
        )
        stmt = stmt.join(Booking, Session.booking_id == Booking.id).where(Booking.teacher_id == user_id)
    else:
        return []

    if in_progress:
        stmt = stmt.where(Session.status == SessionStatus.IN_PROGRESS)

    stmt = stmt.order_by(Session.created_at.desc())

    result = await db.execute(stmt)
    sessions = result.scalars().all()

    # Return ORM Session objects directly — session/booking nested mapping
    # is handled by Pydantic validators on the schemas (from_attributes=True)
    return sessions
