"""Add RBAC system and audit logging

Revision ID: add_rbac_audit_system
Revises: 
Create Date: 2026-03-30

This migration adds:
1. is_staff and admin_role columns to users table
2. New audit_logs table for tracking admin actions
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade():
    # ── Add admin fields to users table ───────────────────────────────
    op.add_column(
        'users',
        sa.Column('is_staff', sa.Boolean, nullable=False, server_default='false')
    )
    op.add_column(
        'users',
        sa.Column(
            'admin_role',
            sa.Enum(
                'SUPER_ADMIN', 'VERIFIER', 'FINANCE', 'SUPPORT',
                name='adminrole'
            ),
            nullable=True
        )
    )
    
    # ── Create audit_logs table ──────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            'action_type',
            sa.Enum(
                'ADMIN_CREATED', 'ADMIN_UPDATED', 'ADMIN_DEACTIVATED',
                'TEACHER_VERIFIED', 'TEACHER_REJECTED',
                'USER_BANNED', 'USER_UNBANNED',
                'ESCROW_RELEASED', 'ESCROW_REFUNDED',
                'SUBJECT_CREATED', 'SUBJECT_DEACTIVATED',
                'REPORT_RESOLVED', 'OTHER',
                name='auditactiontype'
            ),
            nullable=False
        ),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('target_resource_type', sa.String(100), nullable=True),
        sa.Column('target_resource_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('metadata', postgresql.JSON, nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
    )
    
    # ── Create indexes for performance ───────────────────────────────
    op.create_index('ix_audit_logs_action_type', 'audit_logs', ['action_type'])
    op.create_index('ix_audit_logs_actor_id', 'audit_logs', ['actor_id'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_target_user_id', 'audit_logs', ['target_user_id'])


def downgrade():
    # ── Drop audit_logs table ────────────────────────────────────────
    op.drop_index('ix_audit_logs_target_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_actor_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action_type', table_name='audit_logs')
    op.drop_table('audit_logs')
    
    # ── Drop admin fields from users ──────────────────────────────────
    op.drop_column('users', 'admin_role')
    op.drop_column('users', 'is_staff')
    
    # ── Drop enums ───────────────────────────────────────────────────
    op.execute('DROP TYPE IF EXISTS adminrole')
    op.execute('DROP TYPE IF EXISTS auditactiontype')
