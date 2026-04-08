from uuid import UUID

from app.core.enums import SessionStatus
from app.schemas.base import SharedConfig


class StudentSessionRead(SharedConfig):
    id: UUID
    booking_id: UUID
    status: SessionStatus
    teacher_name: str
    subject_name: str

class TeacherSessionRead(SharedConfig):
    id: UUID
    booking_id: UUID
    status: SessionStatus
    student_name: str
    subject_name: str
