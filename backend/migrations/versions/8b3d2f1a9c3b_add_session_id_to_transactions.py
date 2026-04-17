"""Add session_id column to transactions and unique constraint

Revision ID: 8b3d2f1a9c3b
Revises: 20260415_remove_ready
Create Date: 2026-04-16 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '8b3d2f1a9c3b'
down_revision = '20260415_remove_ready'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add session_id column
    op.add_column(
        'transactions',
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Create index on session_id for queries
    op.create_index('ix_transaction_session_id', 'transactions', ['session_id'])

    # Add foreign key constraint referencing sessions.id with ON DELETE SET NULL
    op.create_foreign_key(
        'fk_transactions_session_id_sessions',
        'transactions',
        'sessions',
        ['session_id'],
        ['id'],
        ondelete='SET NULL',
    )

    # Add unique constraint to ensure one credit per session+reason
    op.create_unique_constraint('uq_one_credit_per_session', 'transactions', ['session_id', 'reason'])


def downgrade() -> None:
    # Drop unique constraint
    op.drop_constraint('uq_one_credit_per_session', 'transactions', type_='unique')

    # Drop foreign key
    op.drop_constraint('fk_transactions_session_id_sessions', 'transactions', type_='foreignkey')

    # Drop index
    op.drop_index('ix_transaction_session_id', table_name='transactions')

    # Drop column
    op.drop_column('transactions', 'session_id')
