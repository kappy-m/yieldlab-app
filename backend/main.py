from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import init_db, engine
from .config import settings
from .routers import properties, pricing, recommendations, competitor, comp_set, market
from .routers import daily_performance, competitor_ratings
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
    competitor_ratings テーブルに user_review / review_url カラムを追加するマイグレーション。
    既存のSQLiteDBにカラムが存在しない場合のみ追加する（べき等）。
    SQLAlchemyのcreate_allは既存テーブルのカラム追加を行わないため、明示的にALTERが必要。
    """
    import logging
    from sqlalchemy import text
    from .database import AsyncSessionLocal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        # SQLiteではPRAGMA table_info でカラム一覧を取得
        result = await db.execute(text("PRAGMA table_info(competitor_ratings)"))
        columns = {row[1] for row in result.all()}  # row[1] = column name

        migrations = []
        if "user_review" not in columns:
            migrations.append("ALTER TABLE competitor_ratings ADD COLUMN user_review TEXT")
        if "review_url" not in columns:
            migrations.append("ALTER TABLE competitor_ratings ADD COLUMN review_url TEXT")

        if migrations:
            for sql in migrations:
                await db.execute(text(sql))
                logger.info("[Migration] %s", sql)
            await db.commit()
            logger.info("[Migration] competitor_ratings columns added.")
        else:
            logger.info("[Migration] competitor_ratings columns already exist. Skip.")


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
    # DB接続失敗でもアプリを起動させる（ヘルスチェック通過のため）
    try:
        await init_db()
        await _auto_seed_if_empty()
        await _auto_seed_daily_perf_if_empty()
        await _auto_pipeline_if_prices_empty()
        await _migrate_competitor_ratings_columns()   # カラム追加マイグレーション（べき等）
        await _auto_fetch_ratings_if_empty()
        _db_ready = True
        _logger.info("Database initialized and seeded.")
    except Exception as e:
        _logger.warning(f"DB init failed on startup (will retry on first request): {e}")
    _scheduler.start()
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

app.include_router(properties.router)
app.include_router(pricing.router)
app.include_router(recommendations.router)
app.include_router(competitor.router)
app.include_router(comp_set.router)
app.include_router(market.router)
app.include_router(daily_performance.router)
app.include_router(competitor_ratings.router)


@app.get("/health")
async def health():
    jobs = [{"id": j.id, "next_run": str(j.next_run_time)} for j in _scheduler.get_jobs()]
    db_stats: dict = {}
    try:
        from sqlalchemy import text
        from .database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            for table in ["properties", "competitor_prices", "daily_performances", "pricing_grids", "competitor_ratings"]:
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
async def trigger_pipeline(property_id: int):
    """手動でパイプラインを即時実行（テスト用）"""
    from .services.scheduler import run_daily_pipeline
    import asyncio
    asyncio.create_task(run_daily_pipeline(property_id))
    return {"status": "pipeline_started", "property_id": property_id}


@app.get("/admin/debug-env")
async def debug_env():
    """環境変数の設定状況を確認（機密値は非公開・プレフィックスのみ）"""
    import os
    db_url = os.environ.get("DATABASE_URL", "")
    db_type = (
        "postgresql" if "postgresql" in db_url or "postgres" in db_url
        else "sqlite" if "sqlite" in db_url
        else "sqlite(default)" if not db_url else "unknown"
    )
    return {
        "RAKUTEN_APP_ID_set":     bool(os.environ.get("RAKUTEN_APP_ID")),
        "RAKUTEN_ACCESS_KEY_set": bool(os.environ.get("RAKUTEN_ACCESS_KEY")),
        "RAKUTEN_APP_ID_prefix":  (os.environ.get("RAKUTEN_APP_ID") or "")[:8] + "...",
        "DATABASE_URL_set":       bool(db_url),
        "db_type":                db_type,
        "note": "sqliteの場合はデプロイごとにデータがリセットされます。PostgreSQLへの移行を推奨。",
    }


@app.post("/admin/test-rating-fetch")
async def test_rating_fetch():
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


@app.get("/admin/hotel-search")
async def hotel_search(keyword: str):
    """楽天 SimpleHotelSearch でホテルNoを調べる（設定用）"""
    import os, httpx
    app_id     = os.environ.get("RAKUTEN_APP_ID", "")
    access_key = os.environ.get("RAKUTEN_ACCESS_KEY", "")
    import urllib.parse
    url = (
        "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20170426"
        f"?applicationId={app_id}&accessKey={access_key}"
        f"&keyword={urllib.parse.quote(keyword)}&formatVersion=2&format=json"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
    data = resp.json()
    hotels = data.get("hotels", [])
    return [
        {
            "hotelNo": h[0]["hotelBasicInfo"]["hotelNo"] if isinstance(h, list) else h.get("hotel", [{}])[0].get("hotelBasicInfo", {}).get("hotelNo"),
            "hotelName": h[0]["hotelBasicInfo"]["hotelName"] if isinstance(h, list) else "",
            "address": (h[0]["hotelBasicInfo"].get("address1","") + h[0]["hotelBasicInfo"].get("address2","")) if isinstance(h, list) else "",
        }
        for h in hotels[:10]
    ]


@app.post("/admin/sync-ratings")
async def sync_ratings_sync():
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
                        CompSet.is_active == True,
                        CompSet.rakuten_hotel_no != None,
                    )
                )
                comp_sets = result.scalars().all()
            comp_list = [{"name": c.name, "rakuten_hotel_no": c.rakuten_hotel_no} for c in comp_sets]
            try:
                await _run_rating_fetch(pid, comp_list)
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
async def test_rakuten():
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
async def reset_seed():
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
async def patch_comp_set():
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
