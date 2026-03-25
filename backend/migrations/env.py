import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# パスを通す（backend パッケージの親ディレクトリを追加）
backend_parent = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.abspath(backend_parent))

from backend.config import settings  # noqa: E402
from backend.database import Base    # noqa: E402
import backend.models                # noqa: E402, F401 — モデルを登録するために必要

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# autogenerate のためにメタデータをセット
target_metadata = Base.metadata

# alembic.ini の sqlalchemy.url を config から動的にオーバーライド
# asyncpg ドライバーは Alembic が直接使えないため psycopg2 互換形式に変換
def _get_sync_url() -> str:
    url = settings.DATABASE_URL
    # asyncpg → psycopg2 (Alembic の同期接続用)
    if "postgresql+asyncpg://" in url:
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    # aiosqlite → sqlite (Alembic の同期接続用)
    if "sqlite+aiosqlite://" in url:
        return url.replace("sqlite+aiosqlite://", "sqlite://")
    return url


def _get_async_url() -> str:
    return settings.DATABASE_URL


def run_migrations_offline() -> None:
    url = _get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    config.set_main_option("sqlalchemy.url", _get_async_url())
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
