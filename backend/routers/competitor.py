from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel
from datetime import date, timedelta
from ..database import get_db
from ..models import CompetitorPrice
from ..services.scraper import scrape_dates_range

router = APIRouter(prefix="/properties/{property_id}/competitor", tags=["competitor"])


class CompetitorPriceOut(BaseModel):
    id: int
    competitor_name: str
    target_date: str
    price: int
    available_rooms: int | None
    scraped_at: str

    model_config = {"from_attributes": True}


class CompetitorAvgOut(BaseModel):
    target_date: str
    avg_price: float
    min_price: int
    max_price: int
    count: int


class ScrapeRequest(BaseModel):
    comp_hotels: list[dict]  # [{"name": "ホテルA", "expedia_id": "12345678"}, ...]
    days_ahead: int = 30


@router.get("/prices", response_model=list[CompetitorPriceOut])
async def get_competitor_prices(
    property_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    competitor_name: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(CompetitorPrice).where(CompetitorPrice.property_id == property_id)
    if date_from:
        query = query.where(CompetitorPrice.target_date >= date_from)
    if date_to:
        query = query.where(CompetitorPrice.target_date <= date_to)
    if competitor_name:
        query = query.where(CompetitorPrice.competitor_name == competitor_name)
    query = query.order_by(CompetitorPrice.target_date, CompetitorPrice.competitor_name)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/averages", response_model=list[CompetitorAvgOut])
async def get_competitor_averages(
    property_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    """競合の日別平均・最安・最高価格を集計"""
    query = select(
        CompetitorPrice.target_date,
        func.avg(CompetitorPrice.price).label("avg_price"),
        func.min(CompetitorPrice.price).label("min_price"),
        func.max(CompetitorPrice.price).label("max_price"),
        func.count(CompetitorPrice.id).label("count"),
    ).where(CompetitorPrice.property_id == property_id)

    if date_from:
        query = query.where(CompetitorPrice.target_date >= date_from)
    if date_to:
        query = query.where(CompetitorPrice.target_date <= date_to)
    query = query.group_by(CompetitorPrice.target_date).order_by(CompetitorPrice.target_date)

    result = await db.execute(query)
    return [
        CompetitorAvgOut(
            target_date=str(row.target_date),
            avg_price=round(row.avg_price, 0),
            min_price=row.min_price,
            max_price=row.max_price,
            count=row.count,
        )
        for row in result.all()
    ]


@router.post("/scrape")
async def trigger_scrape(
    property_id: int,
    body: ScrapeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Expedia スクレイピングをバックグラウンドで実行"""
    async def run_scrape():
        from datetime import date as d
        prices = await scrape_dates_range(
            comp_hotels=body.comp_hotels,
            start_date=d.today(),
            days=body.days_ahead,
        )
        async with db as session:
            for p in prices:
                record = CompetitorPrice(
                    property_id=property_id,
                    target_date=p.target_date,
                    competitor_name=p.competitor_name,
                    price=p.price,
                    available_rooms=p.available_rooms,
                    source_url=p.source_url,
                )
                session.add(record)
            await session.commit()

    background_tasks.add_task(run_scrape)
    return {"status": "scraping_started", "hotels": len(body.comp_hotels), "days": body.days_ahead}
