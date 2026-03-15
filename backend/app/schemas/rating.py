from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class RatingCreate(BaseModel):
    session_id: UUID
    score: int
    comment: str | None = None
    is_anonymous: bool = False

    @field_validator("score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("Score must be between 1 and 5")
        return v


class RatingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    teacher_id: UUID
    subject_id: UUID
    score: int
    comment: str | None
    is_anonymous: bool
    created_at: datetime