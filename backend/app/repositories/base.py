from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, id: UUID) -> ModelT | None:
        result = await self.db.execute(select(self.model).where(self.model.id == id))  # type: ignore[attr-defined]
        return result.scalar_one_or_none()

    async def get_all(self, limit: int = 100, offset: int = 0) -> list[ModelT]:
        result = await self.db.execute(select(self.model).limit(limit).offset(offset))
        return list(result.scalars().all())

    async def create(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete_by_id(self, id: UUID) -> bool:
        result = await self.db.execute(
            delete(self.model).where(self.model.id == id)  # type: ignore[attr-defined]
        )
        return result.rowcount > 0