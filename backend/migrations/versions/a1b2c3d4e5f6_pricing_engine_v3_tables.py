"""pricing_engine_v3_tables

PricingEngine v3 で追加される新テーブル:
  - price_freeze_logs  : Rating Circuit Breaker の凍結状態管理
  - google_trends_cache: Google Trends 週次キャッシュ

Revision ID: a1b2c3d4e5f6
Revises: 140b816d43dd
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '966d3d0bff2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'price_freeze_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('baseline_overall', sa.Float(), nullable=False),
        sa.Column('trigger_overall', sa.Float(), nullable=False),
        sa.Column('trigger_reason', sa.String(length=300), nullable=False),
        sa.Column('frozen_from', sa.DateTime(timezone=True), nullable=False),
        sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('manual_release', sa.Boolean(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_price_freeze_logs_property_id'),
        'price_freeze_logs',
        ['property_id'],
        unique=False,
    )

    op.create_table(
        'google_trends_cache',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('area_code', sa.String(length=50), nullable=False),
        sa.Column('query', sa.String(length=100), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('trend_index', sa.Float(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'area_code', 'query', 'period_start',
            name='uq_trends_area_query_period',
        ),
    )
    op.create_index(
        op.f('ix_google_trends_cache_area_code'),
        'google_trends_cache',
        ['area_code'],
        unique=False,
    )
    op.create_index(
        op.f('ix_google_trends_cache_period_start'),
        'google_trends_cache',
        ['period_start'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_google_trends_cache_period_start'), table_name='google_trends_cache')
    op.drop_index(op.f('ix_google_trends_cache_area_code'), table_name='google_trends_cache')
    op.drop_table('google_trends_cache')

    op.drop_index(op.f('ix_price_freeze_logs_property_id'), table_name='price_freeze_logs')
    op.drop_table('price_freeze_logs')
