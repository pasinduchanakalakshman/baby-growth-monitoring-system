"""Add baby_nutrition_preferences table

Revision ID: 002_add_nutrition_preferences
Revises: 001_add_auth_fields
Create Date: 2026-10-20 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_nutrition_preferences'
down_revision = '001_add_auth_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'baby_nutrition_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('baby_id', sa.Integer(), nullable=False),
        sa.Column('complementary_feeding_start_date', sa.Date(), nullable=True),
        sa.Column('milk_feeding_method', sa.String(), nullable=True),
        sa.Column('foods_introduced', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('restricted_foods', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('available_ingredients', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('dietary_preferences', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('recent_meal_history', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('only_available_ingredients', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['baby_id'], ['babies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('baby_id', name='uq_baby_nutrition_preferences_baby_id')
    )
    op.create_index(op.f('ix_baby_nutrition_preferences_id'), 'baby_nutrition_preferences', ['id'], unique=False)
    op.create_index(op.f('ix_baby_nutrition_preferences_baby_id'), 'baby_nutrition_preferences', ['baby_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_baby_nutrition_preferences_baby_id'), table_name='baby_nutrition_preferences')
    op.drop_index(op.f('ix_baby_nutrition_preferences_id'), table_name='baby_nutrition_preferences')
    op.drop_table('baby_nutrition_preferences')
