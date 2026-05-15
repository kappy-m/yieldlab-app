import os
import sys
from logging.config import fileConfig

from sqlalchemy import create_engine, pool, text

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


# create_all で管理されていた最後の既知 revision。
# この revision までのテーブルは Railway DB に create_all 経由で作成済み。
# これ以降の migration (a1b2c3d4e5f6, b2c3d4e5f6a7) は冪等チェック付きで実行する。
_LEGACY_HEAD = '966d3d0bff2c'


def _stamp_legacy_db(connection) -> None:
    """
    alembic を一度も完走させずに create_all で動かしていた Railway DB を
    _LEGACY_HEAD にスタンプして DuplicateTable エラーを防ぐ。

    スタンプ後: a1b2c3d4e5f6・b2c3d4e5f6a7 の冪等 migration が実行され、
    未追加のテーブル/カラムのみ追加される。
    """
    is_postgres = "postgresql" in _get_sync_url()
    if not is_postgres:
        return  # SQLite (ローカル) は create_all と alembic が共存できる

    # alembic_version に行があれば既に Alembic で管理されている
    has_alembic = connection.execute(
        text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'alembic_version')"
        )
    ).scalar()

    if has_alembic:
        count = connection.execute(text("SELECT COUNT(*) FROM alembic_version")).scalar()
        if count > 0:
            return  # Alembic 管理済み → 通常の upgrade を実行

    # アプリテーブルが存在するか確認（create_all 経由の既存 DB か）
    has_app_tables = connection.execute(
        text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'organizations')"
        )
    ).scalar()

    if not has_app_tables:
        return  # 新規 DB → 通常の migration で全テーブルを作成

    # create_all 済み既存 DB → _LEGACY_HEAD にスタンプ
    # (head ではなく _LEGACY_HEAD にスタンプすることで、
    #  新しい冪等 migration が必要なカラム/テーブルを実際に追加できる)
    if not has_alembic:
        connection.execute(
            text(
                "CREATE TABLE alembic_version "
                "(version_num VARCHAR(32) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            )
        )
    else:
        connection.execute(text("DELETE FROM alembic_version"))

    connection.execute(
        text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
        {"rev": _LEGACY_HEAD},
    )
    connection.commit()
    print(
        f"[alembic] Legacy DB detected. Stamped to {_LEGACY_HEAD}. "
        "Idempotent migrations will now apply remaining changes.",
        flush=True,
    )


def run_migrations_online() -> None:
    # asyncpg（非同期）ではなく psycopg2（同期）で接続する。
    # asyncpg を asyncio.run() で呼び出す旧実装は Railway の PostgreSQL 接続で
    # ハングし、Alembic が完了せず uvicorn が起動しないためヘルスチェックが失敗する。
    connectable = create_engine(_get_sync_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        _stamp_legacy_db(connection)
        do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
