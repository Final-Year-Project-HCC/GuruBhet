# Import all models here so SQLAlchemy's mapper registry is fully populated
# before Alembic generates migrations.

from app.db.base import Base  # noqa: F401 — re-exported for Alembic env.py

from app.models.user import User  # noqa: F401
from app.models.student import StudentProfile  # noqa: F401
from app.models.teacher import TeacherProfile  # noqa: F401
from app.models.teacher_document import TeacherDocument  # noqa: F401
from app.models.payment_account import PaymentAccount  # noqa: F401
from app.models.subject import Subject  # noqa: F401
from app.models.teacher_subject import TeacherSubject  # noqa: F401
from app.models.booking import Booking, Session  # noqa: F401
from app.models.rating import TeacherRating  # noqa: F401
from app.models.payment import Transaction, Payout  # noqa: F401
from app.models.moderation import Report, UserBan  # noqa: F401
from app.models.invitation import StaffInvitation  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401

__all__ = [
    "Base",
    "User",
    "StudentProfile",
    "TeacherProfile",
    "TeacherDocument",
    "PaymentAccount",
    "Subject",
    "TeacherSubject",
    "Booking",
    "Session",
    "TeacherRating",
    "Transaction",
    "Payout",
    "Report",
    "UserBan",
    "StaffInvitation",
]