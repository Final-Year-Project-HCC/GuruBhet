"""add avg_rating + rating_count to teacher_profiles; completed_at to bookings; drop is_anonymous from teacher_ratings

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Profile-level rating aggregate (weighted across all subjects)
    op.add_column(
        "teacher_profiles",
        sa.Column(
            "avg_rating",
            sa.Numeric(precision=3, scale=2),
            nullable=False,
            server_default="0.00",
        ),
    )
    op.add_column(
        "teacher_profiles",
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
    )

    # Booking completion timestamp (used for 7-day rating window)
    op.add_column(
        "bookings",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Remove is_anonymous if it exists (column was removed from the model)
    with op.batch_alter_table("teacher_ratings") as batch_op:
        try:
            batch_op.drop_column("is_anonymous")
        except Exception:
            pass  # column may not exist if table was freshly created


def downgrade() -> None:
    op.drop_column("bookings", "completed_at")
    op.drop_column("teacher_profiles", "rating_count")
    op.drop_column("teacher_profiles", "avg_rating")
    op.add_column(
        "teacher_ratings",
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default="false"),
    )
