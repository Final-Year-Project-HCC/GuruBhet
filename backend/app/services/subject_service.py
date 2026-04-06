import logging
from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidRequestError, ResourceNotFoundError
from app.models.subject import Subject, StudyLevel, Board, Faculty, board_study_levels
from app.schemas.subject import SubjectCreate, SubjectUpdate

logger = logging.getLogger(__name__)

class SubjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_study_level_to_board(self, board_id: UUID, study_level_id: UUID):
        board = await self.db.get(Board, board_id)
        if not board: raise ResourceNotFoundError("Board not found")
        study_level = await self.db.get(StudyLevel, study_level_id)
        if not study_level: raise ResourceNotFoundError("StudyLevel not found")
        
        exist = await self.db.execute(select(board_study_levels).where(
            and_(board_study_levels.c.board_id == board_id, board_study_levels.c.study_level_id == study_level_id)
        ))
        bsl = exist.first()
        if bsl:
            if not bsl.is_active:
                await self.db.execute(
                    board_study_levels.update().where(
                        and_(board_study_levels.c.board_id == board_id, board_study_levels.c.study_level_id == study_level_id)
                    ).values(is_active=True)
                )
                await self.db.flush()
            return bsl

        await self.db.execute(
            board_study_levels.insert().values(board_id=board_id, study_level_id=study_level_id, is_active=True)
        )
        await self.db.flush()
        return None

    async def remove_study_level_from_board(self, board_id: UUID, study_level_id: UUID) -> None:
        exist = await self.db.execute(select(board_study_levels).where(
            and_(board_study_levels.c.board_id == board_id, board_study_levels.c.study_level_id == study_level_id)
        ))
        bsl = exist.first()
        if not bsl: raise ResourceNotFoundError("BoardStudyLevel relationship not found")
        
        await self.db.execute(
            board_study_levels.update().where(
                and_(board_study_levels.c.board_id == board_id, board_study_levels.c.study_level_id == study_level_id)
            ).values(is_active=False)
        )
        await self.db.flush()

    async def create_subject(self, subject_create: SubjectCreate) -> Subject:
        faculty_stmt = select(Faculty).where(
            Faculty.id == subject_create.faculty_id,
            Faculty.board_id == subject_create.board_id,
            Faculty.study_level_id == subject_create.study_level_id
        )
        faculty_res = await self.db.execute(faculty_stmt)
        faculty = faculty_res.scalar_one_or_none()
        if not faculty:
            raise ResourceNotFoundError(f"Faculty {subject_create.faculty_id} not found or does not belong to the specified Board and Study Level")
        
        if not faculty.is_active:
            raise InvalidRequestError("Cannot create a subject under an inactive faculty")
            
        if subject_create.unit_value > faculty.total_units or subject_create.unit_value < 1:
            raise InvalidRequestError(f"unit_value must be 1 to {faculty.total_units}")

        subject = Subject(
            name=subject_create.name,
            study_level_id=subject_create.study_level_id,
            board_id=subject_create.board_id,
            faculty_id=subject_create.faculty_id,
            unit_value=subject_create.unit_value,
            is_active=True
        )
        self.db.add(subject)
        await self.db.flush()
        
        # Load relationships
        await self.db.refresh(subject, ["faculty"])
        if subject.faculty:
            await self.db.refresh(subject.faculty, ["study_level", "board"])
            
        return subject

    async def update_subject(self, subject_id: UUID, subject_update: SubjectUpdate) -> Subject:
        subject = await self.db.get(Subject, subject_id)
        if not subject: raise ResourceNotFoundError("Subject not found")

        if subject_update.name is not None:
            subject.name = subject_update.name
            
        if subject_update.is_active is not None:
            subject.is_active = subject_update.is_active

        new_faculty = None
        if subject_update.faculty_id is not None:
            new_faculty = await self.db.get(Faculty, subject_update.faculty_id)
            if not new_faculty: raise ResourceNotFoundError("Faculty not found")
            subject.faculty_id = subject_update.faculty_id
            subject.board_id = new_faculty.board_id
            subject.study_level_id = new_faculty.study_level_id
            subject.faculty = new_faculty

        if subject_update.unit_value is not None:
            fac = new_faculty if new_faculty else subject.faculty
            if fac and (subject_update.unit_value > fac.total_units or subject_update.unit_value < 1):
                raise InvalidRequestError(f"unit_value must be 1 to {fac.total_units}")
            subject.unit_value = subject_update.unit_value

        await self.db.flush()
        
        await self.db.refresh(subject, ["faculty"])
        if subject.faculty:
            await self.db.refresh(subject.faculty, ["study_level", "board"])
            
        return subject

    async def get_subject(self, subject_id: UUID) -> Subject | None:
        result = await self.db.execute(select(Subject).where(Subject.id == subject_id))
        subject = result.scalar_one_or_none()
        if subject and subject.faculty:
            await self.db.refresh(subject.faculty, ["study_level", "board"])
        return subject

    async def get_subjects_by_study_level(self, study_level_id: UUID) -> list[Subject]:
        result = await self.db.execute(
            select(Subject).join(Faculty).where(Faculty.study_level_id == study_level_id)
        )
        return list(result.scalars().all())

    async def get_subjects_by_board(self, board_id: UUID) -> list[Subject]:
        result = await self.db.execute(
            select(Subject).join(Faculty).where(Faculty.board_id == board_id)
        )
        return list(result.scalars().all())

    async def get_subjects_by_faculty(self, faculty_id: UUID) -> list[Subject]:
        result = await self.db.execute(select(Subject).where(Subject.faculty_id == faculty_id))
        return list(result.scalars().all())
