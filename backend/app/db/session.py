import logging
from contextlib import asynccontextmanager
from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from typing import AsyncGenerator
from app.core.config import settings

logger = logging.getLogger(__name__)


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

        # Enforce SSL for external Supabase pooled connections to prevent handshake connection drops
        if "pooler.supabase.com" in db_url and "ssl" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url = f"{db_url}{separator}ssl=require"

        self._engine = create_async_engine(
            db_url,
            pool_recycle=300,
            pool_pre_ping=True,
            # Supavisor transaction mode: disable server-side statement cache
            connect_args={
                "statement_cache_size": 0,
                "server_settings": {
                    "jit": "off"
                }
            },
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
                if session.in_transaction():
                    await session.commit()
            except Exception as e:
                if session.in_transaction():
                    logger.error(f"Database session error: {e}")
                    await session.rollback()
                raise


sessionmanager = DatabaseSessionManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in sessionmanager.session():
        yield session


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database sessions.
    Ideal for use in Celery tasks or standalone scripts.
    """
    async for session in sessionmanager.session():
        yield session