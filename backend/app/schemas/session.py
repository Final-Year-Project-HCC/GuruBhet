from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import model_validator

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


# Detailed session shapes expected by frontend
class UserBrief(SharedConfig):
    id: UUID
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    avatar_url: Optional[str] = None


class SubjectBrief(SharedConfig):
    id: UUID
    name: str


class BookingBriefForSession(SharedConfig):
    id: UUID
    total_sessions: int
    teacher: UserBrief
    subject: SubjectBrief

    @model_validator(mode='before')
    @classmethod
    def extract_from_booking(cls, data):
        """Allow passing a Booking ORM object directly to this schema.

        Extracts `id`, `total_sessions`, `teacher` (as `TeacherProfile.user`) and `subject`.
        """
        # If an ORM Booking is passed
        if hasattr(data, 'id') and hasattr(data, 'total_sessions'):
            teacher_user = None
            if getattr(data, 'teacher', None) is not None and getattr(data.teacher, 'user', None) is not None:
                teacher_user = data.teacher.user

            return {
                'id': data.id,
                'total_sessions': data.total_sessions,
                'teacher': teacher_user,
                'subject': getattr(data, 'subject', None),
            }
        return data


class SessionDetailedReadForStudent(SharedConfig):
    session_number: int
    status: SessionStatus
    actual_start_at: Optional[datetime] = None
    booking: BookingBriefForSession


class BookingBriefForSessionTeacher(SharedConfig):
    id: UUID
    total_sessions: int
    student: UserBrief
    subject: SubjectBrief

    @model_validator(mode='before')
    @classmethod
    def extract_from_booking(cls, data):
        """Allow passing a Booking ORM object directly to this schema.

        Extracts `id`, `total_sessions`, `student` (as `StudentProfile.user`) and `subject`.
        """
        if hasattr(data, 'id') and hasattr(data, 'total_sessions'):
            student_user = None
            if getattr(data, 'student', None) is not None and getattr(data.student, 'user', None) is not None:
                student_user = data.student.user

            return {
                'id': data.id,
                'total_sessions': data.total_sessions,
                'student': student_user,
                'subject': getattr(data, 'subject', None),
            }
        return data


class SessionDetailedReadForTeacher(SharedConfig):
    session_number: int
    status: SessionStatus
    actual_start_at: Optional[datetime] = None
    booking: BookingBriefForSessionTeacher
