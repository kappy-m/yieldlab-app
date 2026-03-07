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
from datetime import timezone as _tz

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.comp_set import CompSet
from ..models.competitor_rating import CompetitorRating
from ..models.property import Property
from ..services.rakuten_rating_fetcher import fetch_ratings_for_property, fetch_hotel_rating
from ..services.google_rating_fetcher import fetch_google_ratings_for_property
from ..services.tripadvisor_rating_fetcher import fetch_tripadvisor_ratings_for_property

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
    """全評価ソース（楽天・Google・TripAdvisor）をバックグラウンドで再取得する。"""
    result = await db.execute(
        select(CompSet).where(
            CompSet.property_id == property_id,
            CompSet.is_active == True,
        )
    )
    comp_sets = result.scalars().all()
    comp_list = [
        {
            "name": c.name,
            "rakuten_hotel_no": c.rakuten_hotel_no,
            "google_place_id": getattr(c, "google_place_id", None),
            "tripadvisor_location_id": getattr(c, "tripadvisor_location_id", None),
        }
        for c in comp_sets
    ]

    prop = await db.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    own_rakuten_no = getattr(prop, "own_rakuten_hotel_no", None)

    background_tasks.add_task(_run_rating_fetch, property_id, comp_list, own_rakuten_no, prop.name)
    rakuten_count = sum(1 for c in comp_list if c.get("rakuten_hotel_no"))
    return {
        "status": "started",
        "targets": {
            "rakuten": rakuten_count + (1 if own_rakuten_no else 0),
            "google": len(comp_list),
            "tripadvisor": len(comp_list),
        },
    }


async def _run_rating_fetch(
    property_id: int,
    comp_list: list[dict],
    own_rakuten_no: str | None = None,
    own_hotel_name: str = "自社",
):
    """楽天・Google・TripAdvisor から評価を取得してDBをupsertする。"""
    import os
    from ..database import AsyncSessionLocal
    import httpx

    logger.info("Rating fetch start: property_id=%d, count=%d, own=%s",
                property_id, len(comp_list), own_rakuten_no)

    # ── 楽天評価 ──────────────────────────────
    rakuten_comp_list = [c for c in comp_list if c.get("rakuten_hotel_no")]
    rakuten_results = await fetch_ratings_for_property(rakuten_comp_list)
    no_to_name = {c["rakuten_hotel_no"]: c["name"] for c in rakuten_comp_list}

    own_result = None
    if own_rakuten_no:
        app_id = os.environ.get("RAKUTEN_APP_ID", "")
        access_key = os.environ.get("RAKUTEN_ACCESS_KEY", "")
        async with httpx.AsyncClient() as client:
            own_result = await fetch_hotel_rating(own_rakuten_no, client, app_id, access_key)

    # ── Google評価 ────────────────────────────
    google_results = await fetch_google_ratings_for_property(comp_list)

    # ── TripAdvisor評価 ───────────────────────
    ta_results = await fetch_tripadvisor_ratings_for_property(comp_list)

    async with AsyncSessionLocal() as db:
        # 楽天 - 競合
        for r in rakuten_results:
            hotel_name = no_to_name.get(r.rakuten_no, r.rakuten_no)
            await _upsert_rating(db, property_id, hotel_name, r, source="rakuten", is_own=False)

        # 楽天 - 自社
        if own_result:
            await _upsert_rating(db, property_id, own_hotel_name, own_result, source="rakuten", is_own=True)

        # Google - 競合
        for hotel_name, r in google_results:
            await _upsert_google_rating(db, property_id, hotel_name, r, is_own=False)
            # 自動解決された place_id を CompSet に保存
            for c in comp_list:
                if c["name"] == hotel_name and c.get("_resolved_place_id"):
                    await _save_place_id(db, property_id, hotel_name, c["_resolved_place_id"])

        # TripAdvisor - 競合
        for hotel_name, r in ta_results:
            await _upsert_tripadvisor_rating(db, property_id, hotel_name, r, is_own=False)
            for c in comp_list:
                if c["name"] == hotel_name and c.get("_resolved_location_id"):
                    await _save_location_id(db, property_id, hotel_name, c["_resolved_location_id"])

        await db.commit()

    logger.info("Rating fetch done: property_id=%d, rakuten=%d, google=%d, ta=%d",
                property_id, len(rakuten_results), len(google_results), len(ta_results))


async def _upsert_rating(db, property_id: int, hotel_name: str, r, source: str = "rakuten", is_own: bool = False):
    """楽天評価データをupsertするヘルパー"""
    existing = await db.execute(
        select(CompetitorRating).where(
            CompetitorRating.property_id == property_id,
            CompetitorRating.hotel_name == hotel_name,
            CompetitorRating.source == source,
        )
    )
    row = existing.scalars().first()
    if row:
        row.overall = r.overall
        row.review_count = r.review_count
        row.service_score = getattr(r, "service", None)
        row.location_score = getattr(r, "location", None)
        row.room_score = getattr(r, "room", None)
        row.equipment_score = getattr(r, "equipment", None)
        row.bath_score = getattr(r, "bath", None)
        row.meal_score = getattr(r, "meal", None)
        row.user_review = r.user_review
        row.review_url = r.review_url
        row.review_date = getattr(r, "review_date", None)
        row.is_own_property = is_own
        row.fetched_at = datetime.datetime.now(_tz.utc)
    else:
        db.add(CompetitorRating(
            property_id=property_id,
            hotel_name=hotel_name,
            rakuten_no=getattr(r, "rakuten_no", None),
            source=source,
            overall=r.overall,
            review_count=r.review_count,
            service_score=getattr(r, "service", None),
            location_score=getattr(r, "location", None),
            room_score=getattr(r, "room", None),
            equipment_score=getattr(r, "equipment", None),
            bath_score=getattr(r, "bath", None),
            meal_score=getattr(r, "meal", None),
            user_review=r.user_review,
            review_url=r.review_url,
            review_date=getattr(r, "review_date", None),
            is_own_property=is_own,
        ))


async def _upsert_google_rating(db, property_id: int, hotel_name: str, r, is_own: bool = False):
    """Google評価データをupsertするヘルパー"""
    from ..services.google_rating_fetcher import GoogleRatingData
    existing = await db.execute(
        select(CompetitorRating).where(
            CompetitorRating.property_id == property_id,
            CompetitorRating.hotel_name == hotel_name,
            CompetitorRating.source == "google",
        )
    )
    row = existing.scalars().first()
    if row:
        row.overall = r.overall
        row.review_count = r.review_count
        row.user_review = r.user_review
        row.review_url = r.review_url
        row.review_date = r.review_date
        row.is_own_property = is_own
        row.fetched_at = datetime.datetime.now(_tz.utc)
    else:
        db.add(CompetitorRating(
            property_id=property_id,
            hotel_name=hotel_name,
            source="google",
            overall=r.overall,
            review_count=r.review_count,
            user_review=r.user_review,
            review_url=r.review_url,
            review_date=r.review_date,
            is_own_property=is_own,
        ))


async def _upsert_tripadvisor_rating(db, property_id: int, hotel_name: str, r, is_own: bool = False):
    """TripAdvisor評価データをupsertするヘルパー"""
    existing = await db.execute(
        select(CompetitorRating).where(
            CompetitorRating.property_id == property_id,
            CompetitorRating.hotel_name == hotel_name,
            CompetitorRating.source == "tripadvisor",
        )
    )
    row = existing.scalars().first()
    if row:
        row.overall = r.overall
        row.review_count = r.review_count
        row.user_review = r.user_review
        row.review_url = r.review_url
        row.review_date = r.review_date
        row.is_own_property = is_own
        row.fetched_at = datetime.datetime.now(_tz.utc)
    else:
        db.add(CompetitorRating(
            property_id=property_id,
            hotel_name=hotel_name,
            source="tripadvisor",
            overall=r.overall,
            review_count=r.review_count,
            user_review=r.user_review,
            review_url=r.review_url,
            review_date=r.review_date,
            is_own_property=is_own,
        ))


async def _save_place_id(db, property_id: int, hotel_name: str, place_id: str):
    """自動解決したGoogle Place IDをCompSetに保存"""
    from sqlalchemy import update
    await db.execute(
        update(CompSet)
        .where(CompSet.property_id == property_id, CompSet.name == hotel_name)
        .values(google_place_id=place_id)
    )


async def _save_location_id(db, property_id: int, hotel_name: str, location_id: str):
    """自動解決したTripAdvisor Location IDをCompSetに保存"""
    from sqlalchemy import update
    await db.execute(
        update(CompSet)
        .where(CompSet.property_id == property_id, CompSet.name == hotel_name)
        .values(tripadvisor_location_id=location_id)
    )
