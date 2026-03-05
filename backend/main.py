from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import init_db
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _auto_seed_if_empty()
    _scheduler.start()
    yield
    _scheduler.shutdown(wait=False)


app = FastAPI(
    title="YieldLab API",
    version="0.1.0",
    description="Hotel dynamic pricing SaaS backend",
    lifespan=lifespan,
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
    return {"status": "ok", "service": "yieldlab-api", "scheduled_jobs": jobs}


@app.post("/admin/run-pipeline/{property_id}")
async def trigger_pipeline(property_id: int):
    """手動でパイプラインを即時実行（テスト用）"""
    from .services.scheduler import run_daily_pipeline
    import asyncio
    asyncio.create_task(run_daily_pipeline(property_id))
    return {"status": "pipeline_started", "property_id": property_id}
