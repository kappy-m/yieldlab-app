"""
競合ホテル評価データ API

GET /properties/{property_id}/competitor-ratings
  → 最新の評価データ一覧を返す

POST /properties/{property_id}/competitor-ratings/refresh
  → 楽天 HotelDetailSearch から再取得（バックグラウンド実行）
"""

import asyncio
import datetime
import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.comp_set import CompSet
from ..models.competitor_rating import CompetitorRating
from ..services.rakuten_rating_fetcher import fetch_ratings_for_property

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/properties/{property_id}/competitor-ratings",
    tags=["competitor-ratings"],
)


class RatingCategoryOut(BaseModel):
    service: float | None
    location: float | None
    room: float | None
    equipment: float | None
    bath: float | None
    meal: float | None


class CompetitorRatingOut(BaseModel):
    id: int
    hotel_name: str
    rakuten_no: str | None
    source: str
    overall: float | None
    review_count: int | None
    categories: RatingCategoryOut
    user_review: str | None
    review_url: str | None
    fetched_at: datetime.datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[CompetitorRatingOut])
async def list_competitor_ratings(
    property_id: int,
    db: AsyncSession = Depends(get_db),
):
    """最新の競合評価データ一覧。ソースごとにレコードが存在する。"""
    result = await db.execute(
        select(CompetitorRating)
        .where(CompetitorRating.property_id == property_id)
        .order_by(CompetitorRating.source, CompetitorRating.hotel_name)
    )
    rows = result.scalars().all()
    return [
        CompetitorRatingOut(
            id=r.id,
            hotel_name=r.hotel_name,
            rakuten_no=r.rakuten_no,
            source=r.source,
            overall=r.overall,
            review_count=r.review_count,
            categories=RatingCategoryOut(
                service=r.service_score,
                location=r.location_score,
                room=r.room_score,
                equipment=r.equipment_score,
                bath=r.bath_score,
                meal=r.meal_score,
            ),
            user_review=r.user_review,
            review_url=r.review_url,
            fetched_at=r.fetched_at,
        )
        for r in rows
    ]


@router.post("/refresh")
async def refresh_ratings(
    property_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """評価データをバックグラウンドで再取得する。"""
    # CompSet から rakuten_hotel_no を取得
    result = await db.execute(
        select(CompSet).where(
            CompSet.property_id == property_id,
            CompSet.is_active == True,
            CompSet.rakuten_hotel_no != None,
        )
    )
    comp_sets = result.scalars().all()
    comp_list = [{"name": c.name, "rakuten_hotel_no": c.rakuten_hotel_no} for c in comp_sets]

    background_tasks.add_task(_run_rating_fetch, property_id, comp_list)
    return {"status": "started", "targets": len(comp_list)}


async def _run_rating_fetch(property_id: int, comp_list: list[dict]):
    """楽天から評価を取得してDBをupsertする。"""
    from ..database import AsyncSessionLocal

    logger.info("Rating fetch start: property_id=%d, count=%d", property_id, len(comp_list))
    results = await fetch_ratings_for_property(comp_list)

    # 名前をrakuten_noで逆引き
    no_to_name = {c["rakuten_hotel_no"]: c["name"] for c in comp_list if c.get("rakuten_hotel_no")}

    async with AsyncSessionLocal() as db:
        for r in results:
            hotel_name = no_to_name.get(r.rakuten_no, r.rakuten_no)
            existing = await db.execute(
                select(CompetitorRating).where(
                    CompetitorRating.property_id == property_id,
                    CompetitorRating.hotel_name == hotel_name,
                    CompetitorRating.source == "rakuten",
                )
            )
            row = existing.scalars().first()
            if row:
                row.overall = r.overall
                row.review_count = r.review_count
                row.service_score = r.service
                row.location_score = r.location
                row.room_score = r.room
                row.equipment_score = r.equipment
                row.bath_score = r.bath
                row.meal_score = r.meal
                row.user_review = r.user_review
                row.review_url = r.review_url
                row.fetched_at = datetime.datetime.utcnow()
            else:
                db.add(CompetitorRating(
                    property_id=property_id,
                    hotel_name=hotel_name,
                    rakuten_no=r.rakuten_no,
                    source="rakuten",
                    overall=r.overall,
                    review_count=r.review_count,
                    service_score=r.service,
                    location_score=r.location,
                    room_score=r.room,
                    equipment_score=r.equipment,
                    bath_score=r.bath,
                    meal_score=r.meal,
                    user_review=r.user_review,
                    review_url=r.review_url,
                ))
        await db.commit()
    logger.info("Rating fetch done: property_id=%d, saved=%d", property_id, len(results))
