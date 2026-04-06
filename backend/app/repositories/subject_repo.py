"""Repository for Subject data access operations."""

from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subject import Subject
from app.repositories.base import BaseRepository


class SubjectRepository(BaseRepository[Subject]):
    """Repository for Subject model with custom query methods."""

    model = Subject

    async def get_by_name(self, name: str) -> Subject | None:
        """Get a Subject by name (exact match)."""
        result = await self.db.execute(
            select(Subject).where(Subject.name == name)
        )
        return result.scalar_one_or_none()

    async def get_by_hierarchy(
        self,
        study_level_id: UUID,
        board_id: UUID,
        unit_value: int,
        faculty_id: UUID | None = None,
    ) -> Subject | None:
        """
        Get a Subject by its complete 4-level hierarchy.

        Args:
            study_level_id: Level 1
            board_id: Level 2
            unit_value: Level 4
            faculty_id: Level 3 (optional)

        Returns:
            Subject if found, None otherwise
        """
        query = select(Subject).where(
            Subject.study_level_id == study_level_id,
            Subject.board_id == board_id,
            Subject.unit_value == unit_value,
            Subject.faculty_id == faculty_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_study_level(self, study_level_id: UUID, limit: int = 100, offset: int = 0) -> list[Subject]:
        """Get all Subjects for a StudyLevel."""
        result = await self.db.execute(
            select(Subject)
            .where(Subject.study_level_id == study_level_id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_by_board(self, board_id: UUID, limit: int = 100, offset: int = 0) -> list[Subject]:
        """Get all Subjects for a Board."""
        result = await self.db.execute(
            select(Subject)
            .where(Subject.board_id == board_id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_by_faculty(self, faculty_id: UUID, limit: int = 100, offset: int = 0) -> list[Subject]:
        """Get all Subjects for a Faculty."""
        result = await self.db.execute(
            select(Subject)
            .where(Subject.faculty_id == faculty_id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_all(self, limit: int = 100, offset: int = 0) -> list[Subject]:
        """Get all Subjects (hard delete only, no soft-delete filtering)."""
        result = await self.db.execute(
            select(Subject)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
