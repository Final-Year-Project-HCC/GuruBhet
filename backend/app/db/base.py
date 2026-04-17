import uuid
from datetime import datetime, UTC
from sqlalchemy import DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class TimestampMixin:
    """
    Automatically managed created_at / updated_at columns.
    
    Generates timestamps on the Python side so they are available 
    to FastAPI immediately after object creation without 
    requiring a database flush or refresh.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        # Use a lambda to ensure the time is captured at the moment of creation
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        # 'onupdate' ensures Python updates this field during every session.commit()
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    """
    UUID primary key via PostgreSQL native UUID type.
    
    Generated in Python via uuid.uuid4, making the ID available
    immediately for external logic (like LiveKit room names).
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )