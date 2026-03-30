from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from typing import AsyncGenerator
from app.core.config import settings


class DatabaseSessionManager:
    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._sessionmaker: async_sessionmaker[AsyncSession] | None = None

    async def init(self) -> None:
        db_url = str(settings.DATABASE_URL)

        # Supavisor transaction mode does not support prepared statements.
        # asyncpg requires this query parameter to disable them.
        if "prepared_statement_cache_size" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url = f"{db_url}{separator}prepared_statement_cache_size=0"

        self._engine = create_async_engine(
            db_url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_pre_ping=True,
            # Supavisor transaction mode: disable server-side statement cache
            connect_args={"statement_cache_size": 0},
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


def get_db_session() -> AsyncSession:
    """
    Get a synchronous-style database session for Celery tasks.
    
    Note: Even though this returns an AsyncSession, it can be used in async contexts.
    For Celery tasks, use this to get a session for the current task.
    
    Returns:
        AsyncSession: A database session
    
    Example:
        session = get_db_session()
        # Use session in async context
    """
    if not sessionmanager._sessionmaker:
        raise RuntimeError("DatabaseSessionManager not initialised")
    return sessionmanager._sessionmaker()