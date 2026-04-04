import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import all models so Alembic can detect changes
from app.models import Base  # noqa: F401
from app.core.config import settings

config = context.config

# Use the SESSION MODE URL for Alembic — not the transaction mode URL.
# Supavisor session mode (port 5432) supports DDL statements that Alembic
# needs (CREATE TABLE, ALTER TABLE, etc.) which transaction mode cannot handle.
# Convert asyncpg URL to psycopg2 for synchronous operations
alembic_url = str(settings.DATABASE_URL_ALEMBIC)
if "+" not in alembic_url.split("://")[0]:
    # URL doesn't have a driver specified, add psycopg2
    alembic_url = alembic_url.replace("postgresql://", "postgresql+psycopg2://")
elif "asyncpg" in alembic_url:
    # Replace asyncpg with psycopg2
    alembic_url = alembic_url.replace("postgresql+asyncpg", "postgresql+psycopg2")
config.set_main_option("sqlalchemy.url", alembic_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Compare server defaults so Alembic detects column default changes
        compare_server_defaults=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations using synchronous connection.
    
    Alembic autogenerate requires a synchronous connection to introspect
    the database schema. We use psycopg2 for this.
    """
    connectable = create_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        do_run_migrations(connection)
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()