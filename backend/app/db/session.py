from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator
from app.core.config import settings


class DatabaseSessionManager:
    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._sessionmaker: async_sessionmaker[AsyncSession] | None = None

    async def init(self) -> None:
        self._engine = create_async_engine(
            str(settings.DATABASE_URL),
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_pre_ping=True,
            echo=settings.ENVIRONMENT == "development",
        )
        self._sessionmaker = async_sessionmaker(
            bind=self._engine,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )

    async def close(self) -> None:
        if self._engine:
            await self._engine.dispose()

    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        if not self._sessionmaker:
            raise RuntimeError("DatabaseSessionManager not initialised")
        async with self._sessionmaker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise


sessionmanager = DatabaseSessionManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in sessionmanager.session():
        yield session