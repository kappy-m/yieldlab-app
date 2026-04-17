"""
ブッキングカーブ API
GET /properties/{property_id}/booking-curve  → 特定日の予約ペース時系列
GET /properties/{property_id}/booking-monthly → 月別オンハンドサマリー（BookingTab 用）
"""
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models import BookingSnapshot, PricingGrid, RoomType, DailyPerformance
from ..models.property import Property
from ..dependencies import get_authed_property

router = APIRouter(prefix="/properties/{property_id}/booking-curve", tags=["booking-curve"])


class CurvePointOut(BaseModel):
    days_before: int   # 宿泊日の何日前か
    booked_rooms: int
    occupancy_pct: float
    label: str         # 表示用ラベル (例: "90日前")


class BookingCurveOut(BaseModel):
    target_date: str
    total_rooms: int
    points: list[CurvePointOut]           # 今年
    points_prev_year: list[CurvePointOut]  # 前年同期（データがあれば）
    points_ideal: list[CurvePointOut]      # 理想ライン（全期間平均ブッキングペース）


class MonthlyOnhandOut(BaseModel):
    label: str          # "当月宿泊実績\n2026年3月（1日〜20日）" など
    year: int
    month: int
    revenue: int
    revenue_change_pct: Optional[float]
    rooms_sold: int
    rooms_change_pct: Optional[float]
    occupancy_pct: float
    is_actual: bool     # True = 確定実績、False = オンハンド（予測）


class BookingHeatmapOut(BaseModel):
    """BookingTab ヒートマップ用: 日付 × リードタイム の稼働率 matrix"""
    dates: list[str]            # 宿泊日ラベル (例: ["3/15土", ...])
    lead_times: list[str]       # リードタイムラベル (例: ["90日前", "60日前", ...])
    current_year: list[list[float]]   # [date_idx][lead_time_idx] = 稼働率%
    prev_year: list[list[float]]


# ─── 単一宿泊日のカーブ ─────────────────────────────────────────────────────────

@router.get("/", response_model=BookingCurveOut)
async def get_booking_curve(
    target_date: Optional[str] = Query(default=None, description="宿泊対象日 YYYY-MM-DD"),
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """
    指定した宿泊日に対し、何日前時点で何室予約が入っていたかの推移を返す。
    booking_snapshots テーブルからスナップショットを取得する。
    """
    if target_date:
        tgt = date.fromisoformat(target_date)
    else:
        tgt = date.today() + timedelta(days=30)

    total_rooms = prop.total_rooms or 100

    snap_result = await db.execute(
        select(BookingSnapshot).where(
            and_(
                BookingSnapshot.property_id == prop.id,
                BookingSnapshot.target_date == tgt,
            )
        ).order_by(BookingSnapshot.capture_date)
    )
    snaps = snap_result.scalars().all()

    prev_tgt = tgt.replace(year=tgt.year - 1)
    prev_snap_result = await db.execute(
        select(BookingSnapshot).where(
            and_(
                BookingSnapshot.property_id == prop.id,
                BookingSnapshot.target_date == prev_tgt,
            )
        ).order_by(BookingSnapshot.capture_date)
    )
    prev_snaps = prev_snap_result.scalars().all()

    all_snaps_result = await db.execute(
        select(BookingSnapshot).where(
            BookingSnapshot.property_id == prop.id
        )
    )
    all_snaps = all_snaps_result.scalars().all()

    from collections import defaultdict
    ideal_map: dict[int, list[int]] = defaultdict(list)
    for snap in all_snaps:
        db_days = (snap.target_date - snap.capture_date).days
        if 0 <= db_days <= 90:
            ideal_map[db_days].append(snap.booked_rooms)

    def _to_points(snaps_list, ref_date: date) -> list[CurvePointOut]:
        points = []
        for snap in snaps_list:
            days_before = (ref_date - snap.capture_date).days
            if days_before < 0:
                continue
            occ = min(100.0, snap.booked_rooms / max(total_rooms, 1) * 100)
            label = f"{days_before}日前" if days_before > 0 else "当日"
            points.append(CurvePointOut(
                days_before=days_before,
                booked_rooms=snap.booked_rooms,
                occupancy_pct=round(occ, 1),
                label=label,
            ))
        # 日数降順でソート（遠い日から近い日）
        points.sort(key=lambda p: -p.days_before)
        return points

    # 3件以上のデータポイントがある days_before のみ理想ラインに採用
    points_ideal: list[CurvePointOut] = []
    for db_days in sorted(ideal_map.keys(), reverse=True):
        booked_list = ideal_map[db_days]
        if len(booked_list) < 3:
            continue
        avg_booked = sum(booked_list) / len(booked_list)
        occ = min(100.0, avg_booked / max(total_rooms, 1) * 100)
        label = f"{db_days}日前" if db_days > 0 else "当日"
        points_ideal.append(CurvePointOut(
            days_before=db_days,
            booked_rooms=int(avg_booked),
            occupancy_pct=round(occ, 1),
            label=label,
        ))

    return BookingCurveOut(
        target_date=tgt.isoformat(),
        total_rooms=int(total_rooms),
        points=_to_points(snaps, tgt),
        points_prev_year=_to_points(prev_snaps, prev_tgt),
        points_ideal=points_ideal,
    )


# ─── 月別オンハンドサマリー ────────────────────────────────────────────────────

@router.get("/monthly", response_model=list[MonthlyOnhandOut])
async def get_monthly_onhand(
    months_ahead: int = Query(default=3, le=12),
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """
    当月実績 + 翌月以降のオンハンドを月単位でまとめて返す。
    BookingTab の月次サマリーカードに使用する。
    """
    today = date.today()
    results: list[MonthlyOnhandOut] = []

    # プロパティの総客室数を使う（RoomTypeの合計はpricing用の部分集合で実際の総客室数と異なる）
    total_rooms = prop.total_rooms or 100

    for i in range(months_ahead + 1):
        # i=0: 当月, i=1: 翌月, ...
        year = today.year + (today.month + i - 1) // 12
        month = (today.month + i - 1) % 12 + 1

        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)

        is_actual = month_start < today  # 当月は一部実績、過去月は全実績

        # daily_performances から月次集計（確定実績）
        perf_result = await db.execute(
            select(
                func.sum(DailyPerformance.revenue).label("revenue"),
                func.sum(DailyPerformance.rooms_sold).label("rooms_sold"),
                func.avg(DailyPerformance.occupancy_rate).label("avg_occ"),
            ).where(
                and_(
                    DailyPerformance.property_id == prop.id,
                    DailyPerformance.date >= month_start,
                    DailyPerformance.date <= min(month_end, today - timedelta(days=1)),
                )
            )
        )
        perf = perf_result.one()

        future_result = await db.execute(
            select(
                func.sum(RoomType.total_rooms - PricingGrid.available_rooms).label("booked"),
                func.avg(PricingGrid.price).label("avg_price"),
            ).join(RoomType, PricingGrid.room_type_id == RoomType.id)
            .where(
                and_(
                    PricingGrid.property_id == prop.id,
                    PricingGrid.target_date > today,
                    PricingGrid.target_date >= month_start,
                    PricingGrid.target_date <= month_end,
                )
            )
        )
        future = future_result.one()

        actual_revenue = int(perf.revenue or 0)
        actual_rooms = int(perf.rooms_sold or 0)
        future_booked = max(0, int(future.booked or 0))
        future_price = float(future.avg_price or 0)

        total_revenue = actual_revenue + int(future_booked * future_price)
        total_rooms_sold = actual_rooms + future_booked

        days_in_month = (month_end - month_start).days + 1
        capacity = total_rooms * days_in_month
        occ = round(total_rooms_sold / max(capacity, 1) * 100, 1)

        # 前年同月と比較
        prev_year = year - 1
        prev_result = await db.execute(
            select(
                func.sum(DailyPerformance.revenue).label("revenue"),
                func.sum(DailyPerformance.rooms_sold).label("rooms_sold"),
            ).where(
                and_(
                    DailyPerformance.property_id == prop.id,
                    DailyPerformance.date >= date(prev_year, month, 1),
                    DailyPerformance.date <= month_end.replace(year=prev_year),
                )
            )
        )
        prev = prev_result.one()
        prev_revenue = int(prev.revenue or 0)
        prev_rooms = int(prev.rooms_sold or 0)

        rev_change = round((total_revenue - prev_revenue) / max(prev_revenue, 1) * 100, 1) if prev_revenue else None
        rooms_change = round((total_rooms_sold - prev_rooms) / max(prev_rooms, 1) * 100, 1) if prev_rooms else None

        # ラベル生成
        if i == 0:
            cut_day = today.day - 1
            label = f"当月宿泊実績\n{year}年{month}月（1日〜{cut_day}日）"
        else:
            label = f"{'翌' * i}月オンハンド\n{year}年{month}月"

        results.append(MonthlyOnhandOut(
            label=label,
            year=year,
            month=month,
            revenue=total_revenue,
            revenue_change_pct=rev_change,
            rooms_sold=total_rooms_sold,
            rooms_change_pct=rooms_change,
            occupancy_pct=occ,
            is_actual=i == 0,
        ))

    return results


# ─── ヒートマップ ──────────────────────────────────────────────────────────────

@router.get("/heatmap", response_model=BookingHeatmapOut)
async def get_booking_heatmap(
    days: int = Query(default=10, le=30),
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """
    今後 N 日の宿泊日 × リードタイム の稼働率ヒートマップを返す。
    スナップショットデータから構築する。
    """
    today = date.today()
    lead_times = [90, 60, 45, 30, 21, 14, 7, 3, 0]

    total_rooms = prop.total_rooms or 100

    target_dates = [today + timedelta(days=i) for i in range(days)]
    date_labels = []
    for d in target_dates:
        dow = ["月", "火", "水", "木", "金", "土", "日"][d.weekday()]
        date_labels.append(f"{d.month}/{d.day}{dow}")

    # スナップショットを一括取得
    all_snaps_result = await db.execute(
        select(BookingSnapshot).where(
            and_(
                BookingSnapshot.property_id == prop.id,
                BookingSnapshot.target_date.in_(target_dates),
            )
        )
    )
    all_snaps = all_snaps_result.scalars().all()

    # (target_date, days_before) → booked_rooms のマップ
    snap_map: dict[tuple, int] = {}
    for snap in all_snaps:
        days_before = (snap.target_date - snap.capture_date).days
        snap_map[(snap.target_date, days_before)] = snap.booked_rooms

    def _build_matrix(year_offset: int) -> list[list[float]]:
        matrix = []
        for tgt in target_dates:
            row = []
            adj_tgt = tgt.replace(year=tgt.year + year_offset) if year_offset != 0 else tgt
            for lt in lead_times:
                booked = snap_map.get((adj_tgt, lt), None)
                if booked is None:
                    row.append(0.0)
                else:
                    occ = min(100.0, booked / max(total_rooms, 1) * 100)
                    row.append(round(occ, 1))
            matrix.append(row)
        return matrix

    lead_labels = [f"{lt}日前" if lt > 0 else "当日" for lt in lead_times]

    return BookingHeatmapOut(
        dates=date_labels,
        lead_times=lead_labels,
        current_year=_build_matrix(0),
        prev_year=_build_matrix(-1),
    )
