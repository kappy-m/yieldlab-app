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
from ..models.property import Property
from ..services.rakuten_rating_fetcher import fetch_ratings_for_property, fetch_hotel_rating

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
    review_date: str | None
    is_own_property: bool
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
            review_date=getattr(r, "review_date", None),
            is_own_property=bool(getattr(r, "is_own_property", False)),
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
    """評価データをバックグラウンドで再取得する（自社ホテルも含む）。"""
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

    # 自社ホテルの Rakuten 番号があれば含める
    prop = await db.get(Property, property_id)
    own_rakuten_no = getattr(prop, "own_rakuten_hotel_no", None) if prop else None

    background_tasks.add_task(_run_rating_fetch, property_id, comp_list, own_rakuten_no, prop.name if prop else "自社")
    return {"status": "started", "targets": len(comp_list) + (1 if own_rakuten_no else 0)}


async def _run_rating_fetch(
    property_id: int,
    comp_list: list[dict],
    own_rakuten_no: str | None = None,
    own_hotel_name: str = "自社",
):
    """楽天から評価を取得してDBをupsertする（自社ホテルも含む）。"""
    import os
    from ..database import AsyncSessionLocal
    import httpx

    logger.info("Rating fetch start: property_id=%d, count=%d, own=%s",
                property_id, len(comp_list), own_rakuten_no)

    results = await fetch_ratings_for_property(comp_list)
    no_to_name = {c["rakuten_hotel_no"]: c["name"] for c in comp_list if c.get("rakuten_hotel_no")}

    # 自社ホテルを個別フェッチ
    own_result = None
    if own_rakuten_no:
        app_id = os.environ.get("RAKUTEN_APP_ID", "")
        access_key = os.environ.get("RAKUTEN_ACCESS_KEY", "")
        async with httpx.AsyncClient() as client:
            own_result = await fetch_hotel_rating(own_rakuten_no, client, app_id, access_key)

    async with AsyncSessionLocal() as db:
        # 競合ホテル保存
        for r in results:
            hotel_name = no_to_name.get(r.rakuten_no, r.rakuten_no)
            await _upsert_rating(db, property_id, hotel_name, r, is_own=False)

        # 自社ホテル保存
        if own_result:
            await _upsert_rating(db, property_id, own_hotel_name, own_result, is_own=True)

        await db.commit()
    logger.info("Rating fetch done: property_id=%d, saved=%d + own=%s",
                property_id, len(results), bool(own_result))


async def _upsert_rating(db, property_id: int, hotel_name: str, r, is_own: bool):
    """単一ホテルの評価データをupsertするヘルパー"""
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
        row.review_date = getattr(r, "review_date", None)
        row.is_own_property = is_own
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
            review_date=getattr(r, "review_date", None),
            is_own_property=is_own,
        ))
