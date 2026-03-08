"""
日次実績データ API
GET  /properties/{property_id}/daily-performance          → 日付範囲で取得
GET  /properties/{property_id}/daily-performance/latest   → 直近N日分（デフォルト30日）
GET  /properties/{property_id}/daily-performance/summary  → 当日 + 前日比 + 週次トレンド
POST /properties/{property_id}/daily-performance/import   → CSVインポート（PMS等からの手動取り込み）
"""
import csv
import io
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
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


class ImportResultOut(BaseModel):
    imported: int
    updated: int
    skipped: int
    errors: list[str]


@router.post("/import", response_model=ImportResultOut)
async def import_daily_performance_csv(
    property_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    PMS等からエクスポートした CSV を取り込む。
    既存レコードは日付キーで UPSERT（上書き）する。

    CSVフォーマット（ヘッダー行必須）:
    date,occupancy_rate,rooms_sold,total_rooms,adr,revenue,revpar,new_bookings,cancellations
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "CSVファイルをアップロードしてください")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # BOM対応
    except UnicodeDecodeError:
        text = content.decode("shift_jis", errors="ignore")

    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):  # 行番号は2行目から
        try:
            row_date = date.fromisoformat(row["date"].strip())
        except (KeyError, ValueError) as e:
            errors.append(f"行{i}: 日付エラー ({e})")
            skipped += 1
            continue

        try:
            occ = float(row.get("occupancy_rate", 0) or 0)
            rooms_sold = int(float(row.get("rooms_sold", 0) or 0))
            total_rooms = int(float(row.get("total_rooms", 0) or 0))
            adr = int(float(row.get("adr", 0) or 0))
            revenue = int(float(row.get("revenue", 0) or 0))
            revpar = int(float(row.get("revpar", 0) or 0))
            new_bookings = int(float(row.get("new_bookings", 0) or 0))
            cancellations = int(float(row.get("cancellations", 0) or 0))
        except (ValueError, TypeError) as e:
            errors.append(f"行{i}: 数値変換エラー ({e})")
            skipped += 1
            continue

        # UPSERT: 既存レコードを更新、なければ作成
        existing = await db.execute(
            select(DailyPerformance).where(
                DailyPerformance.property_id == property_id,
                DailyPerformance.date == row_date,
            )
        )
        record = existing.scalar_one_or_none()

        if record:
            record.occupancy_rate = occ
            record.rooms_sold = rooms_sold
            if total_rooms:
                record.total_rooms = total_rooms
            record.adr = adr
            record.revenue = revenue
            record.revpar = revpar
            record.new_bookings = new_bookings
            record.cancellations = cancellations
            updated += 1
        else:
            db.add(DailyPerformance(
                property_id=property_id,
                date=row_date,
                occupancy_rate=occ,
                rooms_sold=rooms_sold,
                total_rooms=total_rooms or 134,
                adr=adr,
                revenue=revenue,
                revpar=revpar,
                new_bookings=new_bookings,
                cancellations=cancellations,
            ))
            imported += 1

    await db.commit()
    return ImportResultOut(imported=imported, updated=updated, skipped=skipped, errors=errors[:20])
