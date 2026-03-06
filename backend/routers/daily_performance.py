"""
日次実績データ API
GET  /properties/{property_id}/daily-performance          → 日付範囲で取得
GET  /properties/{property_id}/daily-performance/latest   → 直近N日分（デフォルト30日）
GET  /properties/{property_id}/daily-performance/summary  → 当日 + 前日比 + 週次トレンド
"""
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models import DailyPerformance

router = APIRouter(prefix="/properties/{property_id}/daily-performance", tags=["daily-performance"])


class DailyPerfOut(BaseModel):
    id: int
    property_id: int
    date: date
    occupancy_rate: float
    rooms_sold: int
    total_rooms: int
    adr: int
    revenue: int
    revpar: int
    new_bookings: int
    cancellations: int

    model_config = {"from_attributes": True}


class DailySummaryOut(BaseModel):
    """デイリータブ向け集計レスポンス"""
    # 最新日（前日実績）
    latest: Optional[DailyPerfOut]
    # 前日比（対2日前）
    occ_change: Optional[float]       # 稼働率の変化ポイント
    revenue_change_pct: Optional[float]  # 売上変化率 (%)
    new_bookings_change_pct: Optional[float]
    # 直近7日トレンド
    trend_7d: list[DailyPerfOut]


@router.get("/", response_model=list[DailyPerfOut])
async def get_daily_performances(
    property_id: int,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(90, le=365),
    db: AsyncSession = Depends(get_db),
):
    conditions = [DailyPerformance.property_id == property_id]
    if date_from:
        conditions.append(DailyPerformance.date >= date_from)
    if date_to:
        conditions.append(DailyPerformance.date <= date_to)

    stmt = (
        select(DailyPerformance)
        .where(and_(*conditions))
        .order_by(DailyPerformance.date.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.get("/summary", response_model=DailySummaryOut)
async def get_daily_summary(
    property_id: int,
    db: AsyncSession = Depends(get_db),
):
    """デイリーダッシュボード向け: 前日実績 + 前日比 + 直近7日トレンド"""
    today = date.today()
    # 直近10日分取得（計算に余裕を持たせる）
    cutoff = today - timedelta(days=10)
    stmt = (
        select(DailyPerformance)
        .where(
            DailyPerformance.property_id == property_id,
            DailyPerformance.date >= cutoff,
            DailyPerformance.date < today,  # 今日以前（前日まで）
        )
        .order_by(DailyPerformance.date.desc())
        .limit(10)
    )
    rows = (await db.execute(stmt)).scalars().all()
    rows_sorted = sorted(rows, key=lambda r: r.date, reverse=True)

    latest = rows_sorted[0] if rows_sorted else None
    prev = rows_sorted[1] if len(rows_sorted) > 1 else None

    occ_change = None
    revenue_change_pct = None
    new_bookings_change_pct = None

    if latest and prev:
        occ_change = round(latest.occupancy_rate - prev.occupancy_rate, 1)
        if prev.revenue > 0:
            revenue_change_pct = round((latest.revenue - prev.revenue) / prev.revenue * 100, 1)
        if prev.new_bookings > 0:
            new_bookings_change_pct = round((latest.new_bookings - prev.new_bookings) / prev.new_bookings * 100, 1)

    trend_7d = sorted(rows_sorted[:7], key=lambda r: r.date)

    return DailySummaryOut(
        latest=latest,
        occ_change=occ_change,
        revenue_change_pct=revenue_change_pct,
        new_bookings_change_pct=new_bookings_change_pct,
        trend_7d=trend_7d,
    )
