import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import init_db, engine
from .config import settings
from .routers import properties, pricing, recommendations, competitor, comp_set, market
from .routers import daily_performance, competitor_ratings, auth, booking_curve, cost_budget, users
from .services.scheduler import create_scheduler

_scheduler = create_scheduler()


async def _auto_seed_if_empty():
    """DBが空の場合、初期データを投入する（本番起動時の自動セットアップ）"""
    from sqlalchemy import text
    from .database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM properties"))
        count = result.scalar()
        if count == 0:
            import logging
            logger = logging.getLogger(__name__)
            logger.info("Empty database detected — running initial seed...")
            from .seed_runner import run_seed
            await run_seed()
            logger.info("Seed completed.")


async def _auto_seed_daily_perf_if_empty():
    """
    起動時に daily_performances が空なら、サンプルデータを自動投入する。
    Railway の ephemeral SQLite では再デプロイのたびにデータが消えるため、
    _auto_seed_if_empty() だけでは daily_performances が入らないケースをカバー。
    """
    import logging
    from sqlalchemy import text
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        props_count = (await db.execute(text("SELECT COUNT(*) FROM properties"))).scalar()
        perf_count  = (await db.execute(text("SELECT COUNT(*) FROM daily_performances"))).scalar()

    # properties はあるが daily_performances がない場合（バージョンアップ後など）
    if props_count > 0 and perf_count == 0:
        logger.info("[AutoSeed] daily_performances is empty — seeding sample data...")
        from datetime import date, timedelta
        from .database import AsyncSessionLocal
        from .models import Property
        from sqlalchemy import select
        from .seed_runner import (
            _generate_daily_perf,
            RPH_BASE_OCC, RPH_BASE_ADR, RPH_ROOMS,
            CANVAS_BASE_OCC, CANVAS_BASE_ADR, CANVAS_ROOMS,
        )

        async with AsyncSessionLocal() as db:
            props = (await db.execute(select(Property))).scalars().all()
            today = date.today()
            for prop in props:
                # 物件に合わせたパラメータを選択
                if "銀座" in prop.name or "Canvas" in prop.name.lower():
                    base_occ = CANVAS_BASE_OCC
                    base_adr = CANVAS_BASE_ADR
                    total    = CANVAS_ROOMS
                    premium  = 1.30
                else:
                    base_occ = RPH_BASE_OCC
                    base_adr = RPH_BASE_ADR
                    total    = RPH_ROOMS
                    premium  = 1.18

                for day_offset in range(-120, 0):
                    d = today + timedelta(days=day_offset)
                    db.add(_generate_daily_perf(
                        property_id=prop.id,
                        d=d,
                        total_rooms=total,
                        base_occ_by_dow=base_occ,
                        base_adr=base_adr,
                        adr_weekend_premium=premium,
                    ))
            await db.commit()
        logger.info("[AutoSeed] daily_performances seeded.")


async def _migrate_competitor_ratings_columns():
    """
    既存テーブルへのカラム追加マイグレーション（SQLite / PostgreSQL 両対応）。
    各 ALTER TABLE を独立したトランザクションで実行し、
    「カラム既存」エラーはサイレントに無視する（べき等）。
    """
    import logging
    from sqlalchemy import text
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    ALL_MIGRATIONS = [
        # competitor_ratings
        "ALTER TABLE competitor_ratings ADD COLUMN user_review TEXT",
        "ALTER TABLE competitor_ratings ADD COLUMN review_url TEXT",
        "ALTER TABLE competitor_ratings ADD COLUMN is_own_property INTEGER DEFAULT 0",
        "ALTER TABLE competitor_ratings ADD COLUMN review_date TEXT",
        # properties
        "ALTER TABLE properties ADD COLUMN own_rakuten_hotel_no TEXT",
        "ALTER TABLE properties ADD COLUMN event_area TEXT DEFAULT 'nihonbashi'",
        "ALTER TABLE properties ADD COLUMN brand TEXT",
        "ALTER TABLE properties ADD COLUMN address TEXT",
        "ALTER TABLE properties ADD COLUMN star_rating REAL",
        "ALTER TABLE properties ADD COLUMN total_rooms INTEGER",
        "ALTER TABLE properties ADD COLUMN checkin_time TEXT",
        "ALTER TABLE properties ADD COLUMN checkout_time TEXT",
        "ALTER TABLE properties ADD COLUMN website_url TEXT",
        # comp_sets
        "ALTER TABLE comp_sets ADD COLUMN google_place_id TEXT",
        "ALTER TABLE comp_sets ADD COLUMN tripadvisor_location_id TEXT",
        "ALTER TABLE comp_sets ADD COLUMN rakuten_hotel_no TEXT",
        # user_product_roles（マルチプロダクト権限テーブル）
        """CREATE TABLE IF NOT EXISTS user_product_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_code VARCHAR(30) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'viewer',
            UNIQUE(user_id, product_code)
        )""",
    ]

    applied = 0
    for sql in ALL_MIGRATIONS:
        # 各 ALTER を独立セッション/トランザクションで実行（PG は自動ロールバック対応）
        async with AsyncSessionLocal() as db:
            try:
                await db.execute(text(sql))
                await db.commit()
                logger.info("[Migration] Applied: %s", sql[:80])
                applied += 1
            except Exception as e:
                await db.rollback()
                err = str(e).lower()
                # 「カラム既存」は正常（SQLite: duplicate column name / PG: already exists）
                if "already exists" in err or "duplicate column" in err:
                    pass
                else:
                    logger.warning("[Migration] Skipped (non-fatal): %s | %s", sql[:60], e)

    logger.info("[Migration] Done. %d column(s) added.", applied)


async def _auto_seed_booking_snapshots_if_empty():
    """
    booking_snapshots が空なら、daily_performances と pricing_grids から
    過去90日分のスナップショットを逆算して生成する（PoC 用シードデータ）。
    """
    import logging
    from sqlalchemy import text, select, func
    from datetime import date, timedelta
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        snap_count = (await db.execute(text("SELECT COUNT(*) FROM booking_snapshots"))).scalar()
        props_count = (await db.execute(text("SELECT COUNT(*) FROM properties"))).scalar()

    if snap_count > 0 or props_count == 0:
        logger.info(f"[AutoSnapshot] {snap_count} snapshots found — skip seed.")
        return

    logger.info("[AutoSnapshot] booking_snapshots is empty — seeding from pricing_grids...")

    from .models import Property, PricingGrid, RoomType, BookingSnapshot
    from sqlalchemy import select, and_

    async with AsyncSessionLocal() as db:
        today = date.today()
        props = (await db.execute(select(Property))).scalars().all()

        for prop in props:
            rts = (await db.execute(
                select(RoomType).where(RoomType.property_id == prop.id)
            )).scalars().all()
            total_rooms = sum(rt.total_rooms for rt in rts)
            if total_rooms == 0:
                continue

            # 過去90日分のスナップショットをシミュレート
            # capture_date を target_date の90日前〜当日として疑似生成
            for target_offset in range(-30, 91):  # target_date は今日-30〜今日+90
                target = today + timedelta(days=target_offset)

                # pricing_grids から平均単価・在庫取得
                grid_result = await db.execute(
                    select(
                        func.sum(PricingGrid.available_rooms).label("avail"),
                        func.avg(PricingGrid.price).label("avg_price"),
                    ).where(
                        and_(
                            PricingGrid.property_id == prop.id,
                            PricingGrid.target_date == target,
                        )
                    )
                )
                grid = grid_result.one()
                avail_now = int(grid.avail or 0)
                avg_price = float(grid.avg_price or 15000)
                booked_now = max(0, total_rooms - avail_now)

                # 過去のスナップショットポイントをシミュレート
                # target_date が近くなるほど予約が増えるパターンで生成
                for days_before in [90, 60, 45, 30, 21, 14, 7, 3, 1, 0]:
                    capture_date = target - timedelta(days=days_before)
                    if capture_date > today:
                        continue

                    # 近くなるほど予約が増える（S字カーブ的に近似）
                    fill_ratio = 1.0 - (days_before / 95.0) ** 0.7
                    booked_at_time = int(booked_now * fill_ratio)

                    db.add(BookingSnapshot(
                        property_id=prop.id,
                        capture_date=capture_date,
                        target_date=target,
                        booked_rooms=booked_at_time,
                        booked_revenue=int(booked_at_time * avg_price),
                    ))

            await db.commit()
            logger.info(f"[AutoSnapshot] Seeded snapshots for property {prop.id}")

    logger.info("[AutoSnapshot] Booking snapshot seed completed.")


async def _auto_seed_users_if_empty():
    """デモ用ユーザーが未登録なら投入する。既存ユーザーのproduct_rolesも補完する。"""
    import logging
    from sqlalchemy import text
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        user_count = (await db.execute(text("SELECT COUNT(*) FROM users"))).scalar()
        org_count = (await db.execute(text("SELECT COUNT(*) FROM organizations"))).scalar()
        role_count = (await db.execute(text("SELECT COUNT(*) FROM user_product_roles"))).scalar()

    from .models.user import User
    from .models.user_product_role import UserProductRole
    from .models.organization import Organization
    from sqlalchemy import select

    # ユーザーが既存でもproduct_rolesが空なら補完する
    if user_count > 0 and role_count == 0 and org_count > 0:
        async with AsyncSessionLocal() as db:
            users = (await db.execute(select(User).order_by(User.id))).scalars().all()
            all_products = ["yield", "manage", "review", "reservation"]

            for user in users:
                if user.role == "admin":
                    for product_code in all_products:
                        db.add(UserProductRole(user_id=user.id, product_code=product_code, role="admin"))
                elif user.role == "revenue_manager":
                    db.add(UserProductRole(user_id=user.id, product_code="yield",  role="editor"))
                    db.add(UserProductRole(user_id=user.id, product_code="review", role="viewer"))
                else:
                    db.add(UserProductRole(user_id=user.id, product_code="yield", role="viewer"))

            await db.commit()
            logger.info("[AutoSeed] Product roles backfilled for existing users.")
        return

    if user_count > 0 or org_count == 0:
        return

    try:
        import bcrypt as _bc
        salt = _bc.gensalt()
        pwd_hash = _bc.hashpw(b"admin123", salt).decode()
    except Exception:
        pwd_hash = "admin123"

    async with AsyncSessionLocal() as db:
        org = (await db.execute(select(Organization).limit(1))).scalar_one_or_none()
        if not org:
            return

        # デモ用ユーザー3名を作成
        demo_users = [
            User(org_id=org.id, email="admin@example.com",    password_hash=pwd_hash, name="管理者",              role="admin"),
            User(org_id=org.id, email="revenue@example.com",  password_hash=pwd_hash, name="レベニューマネージャー", role="revenue_manager"),
            User(org_id=org.id, email="viewer@example.com",   password_hash=pwd_hash, name="閲覧ユーザー",          role="viewer"),
        ]
        for u in demo_users:
            db.add(u)
        await db.flush()

        # 管理者: 全プロダクトに admin 権限
        all_products = ["yield", "manage", "review", "reservation"]
        for product_code in all_products:
            db.add(UserProductRole(user_id=demo_users[0].id, product_code=product_code, role="admin"))

        # レベニューマネージャー: yield (editor) + review (viewer)
        db.add(UserProductRole(user_id=demo_users[1].id, product_code="yield",  role="editor"))
        db.add(UserProductRole(user_id=demo_users[1].id, product_code="review", role="viewer"))

        # 閲覧ユーザー: yield のみ viewer
        db.add(UserProductRole(user_id=demo_users[2].id, product_code="yield", role="viewer"))

        await db.commit()
        logger.info("[AutoSeed] Demo users + product roles created.")


async def _auto_seed_canvas_event_area():
    """銀座Canvas の event_area が 'nihonbashi' のままなら 'ginza' に更新する。"""
    import logging
    from sqlalchemy import text
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        # 銀座Canvas の物件を特定して event_area を設定
        result = await db.execute(
            text("UPDATE properties SET event_area = 'ginza' WHERE (name LIKE '%銀座%' OR name LIKE '%Canvas%' OR name LIKE '%CANVAS%') AND (event_area IS NULL OR event_area = 'nihonbashi')")
        )
        await db.commit()
        if result.rowcount > 0:
            logger.info(f"[AutoMigrate] Updated {result.rowcount} properties to event_area='ginza'")


async def _auto_fetch_ratings_if_empty():
    """
    起動時に competitor_ratings が空なら楽天 HotelDetailSearch で全物件の評価を取得する。
    """
    import logging
    from sqlalchemy import text, select
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        props_count   = (await db.execute(text("SELECT COUNT(*) FROM properties"))).scalar()
        rating_count  = (await db.execute(text("SELECT COUNT(*) FROM competitor_ratings"))).scalar()

    if props_count > 0 and rating_count == 0:
        logger.info("[AutoRating] competitor_ratings is empty — starting initial fetch (direct await)...")
        from .models.comp_set import CompSet
        from .routers.competitor_ratings import _run_rating_fetch
        async with AsyncSessionLocal() as db:
            props = (await db.execute(text("SELECT id FROM properties"))).all()
        for (pid,) in props:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(CompSet).where(
                        CompSet.property_id == pid,
                        CompSet.is_active == True,
                        CompSet.rakuten_hotel_no != None,
                    )
                )
                comp_sets = result.scalars().all()
            comp_list = [{"name": c.name, "rakuten_hotel_no": c.rakuten_hotel_no} for c in comp_sets]
            # asyncio.create_task ではなく直接 await（Railway lifespan で task が破棄されるリスク回避）
            await _run_rating_fetch(pid, comp_list)
        logger.info("[AutoRating] Rating fetch done for %d properties.", len(props))
    else:
        logger.info("[AutoRating] %d rating records found — skip auto-fetch.", rating_count)


async def _auto_pipeline_if_prices_empty():
    """
    起動時に競合価格データが空ならパイプラインを自動実行する。

    SQLiteはデプロイごとにリセットされるため、再デプロイ後に
    競合価格データが空になる問題を自動で解消する。
    Postgresに移行後は不要になるが、SQLite環境でも安全に動作する。
    """
    import logging
    from sqlalchemy import text
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM competitor_prices"))
        price_count = result.scalar()

    if price_count == 0:
        logger.info("[AutoPipeline] competitor_prices is empty — scheduling pipeline for all properties...")
        import asyncio
        from .services.scheduler import run_daily_pipeline
        # 起動完了後にバックグラウンドで実行（起動をブロックしない）
        asyncio.create_task(run_daily_pipeline())
        logger.info("[AutoPipeline] Pipeline task created.")
    else:
        import logging as _l
        _l.getLogger(__name__).info(f"[AutoPipeline] {price_count} price records found — skip auto-pipeline.")


import logging
_logger = logging.getLogger(__name__)

_db_ready = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_ready
    try:
        await init_db()
        await _migrate_competitor_ratings_columns()   # スキーマ確定をシード・パイプラインより前に実行
        await _auto_seed_if_empty()
        await _auto_seed_daily_perf_if_empty()
        await _auto_seed_users_if_empty()
        await _auto_seed_canvas_event_area()
        await _auto_pipeline_if_prices_empty()
        await _auto_fetch_ratings_if_empty()
        _db_ready = True
        _logger.info("Database initialized and seeded.")
    except Exception as e:
        _logger.warning(f"DB init failed on startup (will retry on first request): {e}")
    _scheduler.start()
    # 起動時に booking_snapshots が空なら過去90日分のシードを投入
    await _auto_seed_booking_snapshots_if_empty()
    yield
    _scheduler.shutdown(wait=False)


app = FastAPI(
    title="YieldLab API",
    version="0.1.0",
    description="Hotel dynamic pricing SaaS backend",
    lifespan=lifespan,
    redirect_slashes=False,  # trailing slash の有無を自動吸収
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(pricing.router)
app.include_router(recommendations.router)
app.include_router(competitor.router)
app.include_router(comp_set.router)
app.include_router(market.router)
app.include_router(daily_performance.router)
app.include_router(competitor_ratings.router)
app.include_router(booking_curve.router)
app.include_router(cost_budget.router)
app.include_router(users.router)


# ─── 管理エンドポイント認証 ────────────────────────────────────────────────────
import secrets as _secrets
from fastapi import Header as _Header

_ADMIN_TOKEN = os.environ.get("ADMIN_SECRET_TOKEN", "")

async def _verify_admin(x_admin_token: str = _Header(default="")):
    """X-Admin-Token ヘッダーで管理エンドポイントを保護。
    ADMIN_SECRET_TOKEN 未設定時は localhost（Railway内部）からのみ許可する緩やかな保護。
    """
    if _ADMIN_TOKEN and not _secrets.compare_digest(x_admin_token, _ADMIN_TOKEN):
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin token")


@app.get("/health")
async def health():
    jobs = [{"id": j.id, "next_run": str(j.next_run_time)} for j in _scheduler.get_jobs()]
    db_stats: dict = {}
    try:
        from sqlalchemy import text
        from .database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            for table in ["properties", "competitor_prices", "daily_performances", "pricing_grids", "competitor_ratings", "users", "booking_snapshots"]:
                count = (await db.execute(text(f"SELECT COUNT(*) FROM {table}"))).scalar()
                db_stats[table] = count
    except Exception as e:
        db_stats["error"] = str(e)

    return {
        "status": "ok",
        "service": "yieldlab-api",
        "db_ready": _db_ready,
        "db_stats": db_stats,
        "scheduled_jobs": jobs,
    }


@app.post("/admin/run-pipeline/{property_id}")
async def trigger_pipeline(property_id: int, _: None = Depends(_verify_admin)):
    """手動でパイプラインを即時実行（テスト用）"""
    from .services.scheduler import run_daily_pipeline
    import asyncio
    asyncio.create_task(run_daily_pipeline(property_id))
    return {"status": "pipeline_started", "property_id": property_id}


@app.get("/admin/debug-env")
async def debug_env(_: None = Depends(_verify_admin)):
    """環境変数の設定状況を確認（機密値は非公開）"""
    db_url = os.environ.get("DATABASE_URL", "")
    db_type = (
        "postgresql" if "postgresql" in db_url or "postgres" in db_url
        else "sqlite" if "sqlite" in db_url
        else "sqlite(default)" if not db_url else "unknown"
    )
    return {
        "RAKUTEN_APP_ID_set":       bool(os.environ.get("RAKUTEN_APP_ID")),
        "RAKUTEN_ACCESS_KEY_set":   bool(os.environ.get("RAKUTEN_ACCESS_KEY")),
        "GOOGLE_PLACES_API_KEY_set": bool(os.environ.get("GOOGLE_PLACES_API_KEY")),
        "TRIPADVISOR_API_KEY_set":  bool(os.environ.get("TRIPADVISOR_API_KEY")),
        "ADMIN_SECRET_TOKEN_set":   bool(_ADMIN_TOKEN),
        "DATABASE_URL_set":         bool(db_url),
        "db_type":                  db_type,
        "note": "sqliteの場合はデプロイごとにデータがリセットされます。PostgreSQLへの移行を推奨。",
    }


@app.post("/admin/test-rating-fetch")
async def test_rating_fetch(_: None = Depends(_verify_admin)):
    """楽天 HotelDetailSearch の動作確認（パレスホテル東京 1件）"""
    import os, traceback
    from .services.rakuten_rating_fetcher import fetch_hotel_rating
    import httpx

    app_id     = os.environ.get("RAKUTEN_APP_ID", "")
    access_key = os.environ.get("RAKUTEN_ACCESS_KEY", "")

    async with httpx.AsyncClient() as client:
        try:
            r = await fetch_hotel_rating("184685", client, app_id, access_key)
            return {
                "status": "ok" if r else "null_returned",
                "hotel_no": "184685",
                "overall": r.overall if r else None,
                "review_count": r.review_count if r else None,
                "service": r.service if r else None,
                "location": r.location if r else None,
                "room": r.room if r else None,
            }
        except Exception as e:
            return {"status": "error", "error": f"{type(e).__name__}: {e}", "tb": traceback.format_exc()[-300:]}



@app.post("/admin/sync-ratings")
async def sync_ratings_sync(_: None = Depends(_verify_admin)):
    """評価データを同期的に取得してDBに保存（非async バックグラウンドなし）"""
    import traceback, logging
    from sqlalchemy import select
    from .database import AsyncSessionLocal
    from .models.comp_set import CompSet
    from .routers.competitor_ratings import _run_rating_fetch
    logger = logging.getLogger(__name__)
    saved_total = 0
    errors_by_prop = {}
    try:
        async with AsyncSessionLocal() as db:
            props_result = await db.execute(select(CompSet.property_id).distinct())
            property_ids = [r[0] for r in props_result.all()]

        for pid in property_ids:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(CompSet).where(
                        CompSet.property_id == pid,
                        CompSet.is_active.is_(True),
                    )
                )
                comp_sets = result.scalars().all()
                from .models.property import Property as _Prop
                prop_row = await db.get(_Prop, pid)
                own_rakuten_no = getattr(prop_row, "own_rakuten_hotel_no", None) if prop_row else None
                own_name = prop_row.name if prop_row else "自社"
            comp_list = [
                {
                    "name": c.name,
                    "rakuten_hotel_no": c.rakuten_hotel_no,
                    "google_place_id": getattr(c, "google_place_id", None),
                    "tripadvisor_location_id": getattr(c, "tripadvisor_location_id", None),
                }
                for c in comp_sets
            ]
            try:
                await _run_rating_fetch(pid, comp_list, own_rakuten_no, own_name)
                saved_total += len(comp_list)
            except Exception as e:
                errors_by_prop[str(pid)] = f"{type(e).__name__}: {e}\n{traceback.format_exc()[-500:]}"
                logger.exception("sync-ratings failed for property %d", pid)
    except Exception as e:
        return {"status": "error", "error": traceback.format_exc()[-500:]}

    return {
        "status": "done",
        "property_ids": property_ids,
        "attempted": saved_total,
        "errors": errors_by_prop,
    }


@app.post("/admin/test-rakuten")
async def test_rakuten(_: None = Depends(_verify_admin)):
    """
    楽天APIの疎通テスト（日本橋競合3ホテル・本日分）
    price + reserve_record_count (hotelReserveInfo.reserveRecordCount) の両方を確認する
    """
    from datetime import date
    from .services.rakuten_scraper import fetch_rakuten_prices_batch
    today = date.today().isoformat()
    try:
        result = await fetch_rakuten_prices_batch(["184685", "184598", "78151"], today)
        return {
            "status": "ok",
            "date": today,
            "hotels": result,
            "note": "reserve_record_count = hotelReserveInfo.reserveRecordCount（予約候補総件数・在庫代理指標）",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/admin/reset-seed")
async def reset_seed(_: None = Depends(_verify_admin)):
    """DB全削除 → 最新シードを再投入（comp-set変更時のリセット用）"""
    import traceback
    from sqlalchemy import text
    from .database import AsyncSessionLocal, init_db
    _logger.warning("[Admin] reset-seed called — dropping and re-seeding DB")
    try:
        async with engine.begin() as conn:
            from . import models  # noqa
            await conn.run_sync(models.Base.metadata.drop_all)
            await conn.run_sync(models.Base.metadata.create_all)
        from .seed_runner import run_seed
        await run_seed()
        _logger.info("[Admin] reset-seed completed")
        return {"status": "reset_complete"}
    except Exception as e:
        err = traceback.format_exc()
        _logger.error(f"[Admin] reset-seed FAILED: {err}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/patch-comp-set")
async def patch_comp_set(_: None = Depends(_verify_admin)):
    """既存のComp-Setエントリを最新のseed定義で更新する（DBリセット不要）"""
    from sqlalchemy import select
    from .database import AsyncSessionLocal
    from .models import CompSet, Property
    from .seed_runner import COMP_HOTELS, CANVAS_COMP_HOTELS
    _logger.info("[Admin] patch-comp-set called")
    updated = 0
    async with AsyncSessionLocal() as session:
        # 全プロパティ取得
        props = (await session.execute(select(Property))).scalars().all()
        prop_map = {p.cm_property_code: p.id for p in props}

        nihonbashi_id = prop_map.get("RPH_NIHONBASHI_001")
        canvas_id = prop_map.get("RPH_CANVAS_GINZA_001")

        updates = []
        if nihonbashi_id:
            updates += [(nihonbashi_id, h) for h in COMP_HOTELS]
        if canvas_id:
            updates += [(canvas_id, h) for h in CANVAS_COMP_HOTELS]

        for prop_id, hotel_def in updates:
            existing = (await session.execute(
                select(CompSet).where(
                    CompSet.property_id == prop_id,
                    CompSet.expedia_hotel_id == hotel_def["expedia_id"]
                )
            )).scalar_one_or_none()

            if existing:
                existing.name = hotel_def["name"]
                existing.rakuten_hotel_no = hotel_def.get("rakuten_no")
                existing.scrape_mode = hotel_def.get("scrape_mode", "mock")
                updated += 1
                _logger.info(f"  Updated: {hotel_def['name']} → rakuten={hotel_def.get('rakuten_no')} mode={hotel_def.get('scrape_mode')}")
            else:
                _logger.warning(f"  Not found: expedia_id={hotel_def['expedia_id']} for property {prop_id}")

        await session.commit()
    _logger.info(f"[Admin] patch-comp-set done. {updated} entries updated.")
    return {"status": "ok", "updated": updated}
