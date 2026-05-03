from uuid import UUID
from datetime import datetime
from pydantic import field_validator, model_validator

from .base import SharedConfig


class RatingCreate(SharedConfig):

    booking_id: UUID
    score: int
    comment: str | None = None

    @field_validator("score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("Score must be between 1 and 5")
        return v


class RatingStudentRead(SharedConfig):
    first_name: str
    middle_name: str | None
    last_name: str
    avatar_url: str | None

    @model_validator(mode="before")
    @classmethod
    def extract_from_student_profile(cls, data):
        """Unwrap StudentProfile ORM object → User fields for auto-serialization path."""
        if hasattr(data, "user") and data.user:
            return {
                "first_name": data.user.first_name,
                "middle_name": data.user.middle_name,
                "last_name": data.user.last_name,
                "avatar_url": data.user.avatar_url,
            }
        return data


class RatingSubjectRead(SharedConfig):
    name: str


class RatingRead(SharedConfig):

    id: UUID
    score: int
    comment: str | None
    created_at: datetime
    student: RatingStudentRead
    subject: RatingSubjectRead