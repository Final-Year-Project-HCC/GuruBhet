from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import UserRole
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.moderation import UserBan
    from app.models.payment_account import PaymentAccount
    from app.models.student import StudentProfile
    from app.models.teacher import TeacherProfile


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)

    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    student_profile: Mapped["StudentProfile"] = relationship(  # noqa: F821
        back_populates="user", uselist=False, lazy="noload"
    )
    teacher_profile: Mapped["TeacherProfile"] = relationship(  # noqa: F821
        back_populates="user",
        uselist=False,
        lazy="noload",
        foreign_keys="TeacherProfile.user_id",
    )
    payment_account: Mapped["PaymentAccount"] = relationship(  # noqa: F821
        back_populates="user",
        uselist=False,
        lazy="noload",
        foreign_keys="PaymentAccount.user_id",
    )
    bans: Mapped[list["UserBan"]] = relationship(  # noqa: F821
        back_populates="user", lazy="noload", foreign_keys="UserBan.user_id"
    )