"""remove per-document status column; document_status on teacher_profiles is the single source

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("teacher_documents", "status")


def downgrade() -> None:
    op.add_column(
        "teacher_documents",
        sa.Column(
            "status",
            sa.Enum(
                "PENDING", "APPROVED", "REJECTED",
                name="verificationstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="PENDING",
        ),
    )
