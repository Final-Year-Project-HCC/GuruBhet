from uuid import UUID
from datetime import datetime
from pydantic import field_validator

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


class RatingRead(SharedConfig):

    id: UUID
    booking_id: UUID
    teacher_id: UUID
    subject_id: UUID
    score: int
    comment: str | None
    created_at: datetime