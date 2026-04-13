from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.teacher_subject import TeacherSubject
from app.models.teacher import TeacherProfile
from app.models.subject import Subject
from app.repositories.base import BaseRepository


class TeacherSubjectRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def search(
        self,
        subject_id: UUID,
        min_rating: float = 0.0,
        min_rate: Decimal | None = None,
        max_rate: Decimal | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[TeacherSubject]:
        """
        Search active teacher-subject offerings.

        Ordered by a composite recommendation score:
          score = (avg_rating * 0.6) + (log(total_sessions_completed + 1) * 0.4)

        This rewards both quality (rating) and proven track record (experience).
        """
        filters = [
            TeacherSubject.subject_id == subject_id,
            TeacherSubject.is_active.is_(True),
            TeacherSubject.avg_rating >= min_rating,
        ]
        if min_rate is not None:
            filters.append(TeacherSubject.rate_per_session >= min_rate)
        if max_rate is not None:
            filters.append(TeacherSubject.rate_per_session <= max_rate)

        # Composite recommendation score
        score_expr = (
            TeacherSubject.avg_rating * 0.6
            + func.log(TeacherSubject.total_sessions_completed + 1) * 0.4
        )

        stmt = (
            select(TeacherSubject)
            .options(
                joinedload(TeacherSubject.teacher).joinedload(TeacherProfile.user),
                joinedload(TeacherSubject.subject),
            )
            .where(and_(*filters))
            .order_by(score_expr.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_teacher_and_subject(
        self, teacher_id: UUID, subject_id: UUID
    ) -> TeacherSubject | None:
        result = await self.db.execute(
            select(TeacherSubject).where(
                TeacherSubject.teacher_id == teacher_id,
                TeacherSubject.subject_id == subject_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_rating_aggregate(
        self, teacher_id: UUID, subject_id: UUID, new_score: int
    ) -> None:
        """
        Incrementally update avg_rating and rating_count after a new rating.
        Uses a running average formula: new_avg = (old_avg * n + score) / (n + 1)
        """
        ts = await self.get_by_teacher_and_subject(teacher_id, subject_id)
        if not ts:
            return
        n = ts.rating_count
        new_avg = (ts.avg_rating * n + Decimal(new_score)) / Decimal(n + 1)
        ts.avg_rating = new_avg.quantize(Decimal("0.01"))
        ts.rating_count = n + 1
        await self.db.flush()

    async def increment_completed_sessions(self, teacher_id: UUID, subject_id: UUID) -> None:
        ts = await self.get_by_teacher_and_subject(teacher_id, subject_id)
        if ts:
            ts.total_sessions_completed += 1
            await self.db.flush()

    async def list_by_teacher(self, teacher_id: UUID) -> list[TeacherSubject]:
        result = await self.db.execute(
            select(TeacherSubject)
            .options(
                joinedload(TeacherSubject.subject),
            )
            .where(TeacherSubject.teacher_id == teacher_id)
            .order_by(TeacherSubject.is_active.desc())
        )
        return list(result.scalars().unique().all())