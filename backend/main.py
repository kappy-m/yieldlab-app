from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import init_db, engine
from .config import settings
from .routers import properties, pricing, recommendations, competitor, comp_set
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


@app.get("/health")
async def health():
    jobs = [{"id": j.id, "next_run": str(j.next_run_time)} for j in _scheduler.get_jobs()]
    return {
        "status": "ok",
        "service": "yieldlab-api",
        "db_ready": _db_ready,
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
    """環境変数の設定状況を確認（値は非公開）"""
    import os
    return {
        "RAKUTEN_APP_ID_set":     bool(os.environ.get("RAKUTEN_APP_ID")),
        "RAKUTEN_ACCESS_KEY_set": bool(os.environ.get("RAKUTEN_ACCESS_KEY")),
        "RAKUTEN_APP_ID_prefix":  (os.environ.get("RAKUTEN_APP_ID") or "")[:8] + "...",
    }


@app.post("/admin/test-rakuten")
async def test_rakuten():
    """楽天APIの疎通テスト（本日の3ホテル価格取得）"""
    from datetime import date
    from .services.rakuten_scraper import fetch_rakuten_prices_batch
    today = date.today().isoformat()
    try:
        prices = await fetch_rakuten_prices_batch(["184685", "184598", "78151"], today)
        return {"status": "ok", "date": today, "prices": prices}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/admin/reset-seed")
async def reset_seed():
    """DB全削除 → 最新シードを再投入（comp-set変更時のリセット用）"""
    from sqlalchemy import text
    from .database import AsyncSessionLocal, init_db
    _logger.warning("[Admin] reset-seed called — dropping and re-seeding DB")
    async with engine.begin() as conn:
        from . import models  # noqa
        await conn.run_sync(models.Base.metadata.drop_all)
        await conn.run_sync(models.Base.metadata.create_all)
    from .seed_runner import run_seed
    await run_seed()
    _logger.info("[Admin] reset-seed completed")
    return {"status": "reset_complete"}
