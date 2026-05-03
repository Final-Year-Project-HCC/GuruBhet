"""add experience_minutes to teacher_subjects and total_experience_minutes to teacher_profiles

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "teacher_subjects",
        sa.Column("experience_minutes", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "teacher_profiles",
        sa.Column("total_experience_minutes", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("teacher_profiles", "total_experience_minutes")
    op.drop_column("teacher_subjects", "experience_minutes")
