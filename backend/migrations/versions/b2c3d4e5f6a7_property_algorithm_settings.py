"""property_algorithm_settings

Property テーブルにプライシングエンジン設定カラムを追加:
  - cold_start_mode : "full" | "market_only" (デフォルト: full)
  - use_v2_engine   : v2 ML エンジンを使用するか (デフォルト: true)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    dialect = conn.dialect.name
    if dialect == "sqlite":
        result = conn.execute(sa.text(f"PRAGMA table_info({table})"))
        return any(row[1] == column for row in result)
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c)"
        ),
        {"t": table, "c": column},
    )
    return bool(result.scalar())


def upgrade() -> None:
    conn = op.get_bind()

    if not _column_exists(conn, 'properties', 'cold_start_mode'):
        op.add_column(
            'properties',
            sa.Column('cold_start_mode', sa.String(length=20), server_default='full', nullable=False),
        )
    if not _column_exists(conn, 'properties', 'use_v2_engine'):
        op.add_column(
            'properties',
            sa.Column('use_v2_engine', sa.Boolean(), server_default='1', nullable=False),
        )


def downgrade() -> None:
    op.drop_column('properties', 'use_v2_engine')
    op.drop_column('properties', 'cold_start_mode')
