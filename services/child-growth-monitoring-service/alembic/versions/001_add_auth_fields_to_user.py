"""Add auth fields to User

Revision ID: 001_add_auth_fields
Revises: 
Create Date: 2026-10-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_add_auth_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add password_hash and is_active columns
    op.add_column('users', sa.Column('password_hash', sa.String(), nullable=True))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    
    # Update existing users if any to have a dummy password hash so we can make it non-nullable later if needed
    op.execute("UPDATE users SET password_hash = 'legacy' WHERE password_hash IS NULL")
    
    op.alter_column('users', 'password_hash', nullable=False)


def downgrade() -> None:
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'password_hash')
