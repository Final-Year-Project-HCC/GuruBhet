"""move remarks/verified_by/verified_at from teacher_documents to teacher_profiles

Revision ID: a1b2c3d4e5f6
Revises: 83c2a4fedb33
Create Date: 2026-05-02

"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "83c2a4fedb33"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add remarks to teacher_profiles
    op.add_column(
        "teacher_profiles",
        sa.Column("remarks", sa.Text(), nullable=True),
    )

    # Drop redundant columns from teacher_documents
    op.drop_constraint(
        "teacher_documents_verified_by_id_fkey",
        "teacher_documents",
        type_="foreignkey",
    )
    op.drop_column("teacher_documents", "verified_by_id")
    op.drop_column("teacher_documents", "verified_at")
    op.drop_column("teacher_documents", "remarks")


def downgrade() -> None:
    # Restore columns to teacher_documents
    op.add_column(
        "teacher_documents",
        sa.Column("remarks", sa.Text(), nullable=True),
    )
    op.add_column(
        "teacher_documents",
        sa.Column(
            "verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "teacher_documents",
        sa.Column(
            "verified_by_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "teacher_documents_verified_by_id_fkey",
        "teacher_documents",
        "users",
        ["verified_by_id"],
        ["id"],
    )

    # Remove remarks from teacher_profiles
    op.drop_column("teacher_profiles", "remarks")
