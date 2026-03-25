import csv
import io
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, field_validator

from ..database import get_db
from ..models import PricingGrid, RoomType, Recommendation, DailyPerformance
from ..models.property import Property
from ..dependencies import get_authed_property

router = APIRouter(prefix="/properties/{property_id}/pricing", tags=["pricing"])


class PricingCellOut(BaseModel):
    id: int
    room_type_id: int
    room_type_name: str
    target_date: str
    bar_level: str
    price: int
    available_rooms: int
    updated_by: str

    model_config = {"from_attributes": True}


BAR_LEVELS = {"BAR1", "BAR2", "BAR3", "BAR4", "BAR5", "CLOSED"}


class PricingCellUpdate(BaseModel):
    bar_level: str
    price: int
    available_rooms: int

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: int) -> int:
        if v < 0:
            raise ValueError("price は 0 以上で入力してください")
        if v > 9_999_999:
            raise ValueError("price が上限を超えています (最大 9,999,999)")
        return v

    @field_validator("available_rooms")
    @classmethod
    def validate_available_rooms(cls, v: int) -> int:
        if v < 0:
            raise ValueError("available_rooms は 0 以上で入力してください")
        if v > 9999:
            raise ValueError("available_rooms の値が大きすぎます")
        return v

    @field_validator("bar_level")
    @classmethod
    def validate_bar_level(cls, v: str) -> str:
        if v not in BAR_LEVELS:
            raise ValueError(f"bar_level は {BAR_LEVELS} のいずれかを指定してください")
        return v


@router.get("/", response_model=list[PricingCellOut])
async def get_pricing_grid(
    date_from: date | None = None,
    date_to: date | None = None,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PricingGrid, RoomType.name.label("room_type_name"))
        .join(RoomType, PricingGrid.room_type_id == RoomType.id)
        .where(PricingGrid.property_id == prop.id)
    )
    if date_from:
        query = query.where(PricingGrid.target_date >= date_from)
    if date_to:
        query = query.where(PricingGrid.target_date <= date_to)
    query = query.order_by(RoomType.sort_order, PricingGrid.target_date)

    result = await db.execute(query)
    rows = result.all()

    return [
        PricingCellOut(
            id=row.PricingGrid.id,
            room_type_id=row.PricingGrid.room_type_id,
            room_type_name=row.room_type_name,
            target_date=str(row.PricingGrid.target_date),
            bar_level=row.PricingGrid.bar_level,
            price=row.PricingGrid.price,
            available_rooms=row.PricingGrid.available_rooms,
            updated_by=row.PricingGrid.updated_by,
        )
        for row in rows
    ]


@router.patch("/{room_type_id}/{target_date}", response_model=PricingCellOut)
async def update_pricing_cell(
    room_type_id: int,
    target_date: date,
    body: PricingCellUpdate,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PricingGrid).where(
            and_(
                PricingGrid.property_id == prop.id,
                PricingGrid.room_type_id == room_type_id,
                PricingGrid.target_date == target_date,
            )
        )
    )
    cell = result.scalar_one_or_none()

    if not cell:
        room = await db.get(RoomType, room_type_id)
        if not room:
            raise HTTPException(status_code=404, detail="RoomType not found")
        cell = PricingGrid(
            property_id=prop.id,
            room_type_id=room_type_id,
            target_date=target_date,
            bar_level=body.bar_level,
            price=body.price,
            available_rooms=body.available_rooms,
            updated_by="manual",
        )
        db.add(cell)
    else:
        cell.bar_level = body.bar_level
        cell.price = body.price
        cell.available_rooms = body.available_rooms
        cell.updated_by = "manual"

    await db.commit()
    await db.refresh(cell)

    room = await db.get(RoomType, room_type_id)
    return PricingCellOut(
        id=cell.id,
        room_type_id=cell.room_type_id,
        room_type_name=room.name if room else "",
        target_date=str(cell.target_date),
        bar_level=cell.bar_level,
        price=cell.price,
        available_rooms=cell.available_rooms,
        updated_by=cell.updated_by,
    )


# ─── CSVエクスポート ──────────────────────────────────────────────────────────

@router.get("/export")
async def export_pricing_csv(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """価格グリッドを CSV 形式でダウンロードする。"""
    if not date_from:
        date_from = date.today()
    if not date_to:
        date_to = date.today() + timedelta(days=30)

    query = (
        select(PricingGrid, RoomType.name.label("room_type_name"))
        .join(RoomType, PricingGrid.room_type_id == RoomType.id)
        .where(
            and_(
                PricingGrid.property_id == prop.id,
                PricingGrid.target_date >= date_from,
                PricingGrid.target_date <= date_to,
            )
        )
        .order_by(PricingGrid.target_date, RoomType.sort_order)
    )
    result = await db.execute(query)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["宿泊日", "部屋タイプ", "BARレベル", "価格(円)", "在庫数", "更新者"])
    for row in rows:
        writer.writerow([
            str(row.PricingGrid.target_date),
            row.room_type_name,
            row.PricingGrid.bar_level,
            row.PricingGrid.price,
            row.PricingGrid.available_rooms,
            row.PricingGrid.updated_by,
        ])

    output.seek(0)
    filename = f"pricing_{prop.id}_{date_from}_{date_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── AIサマリー（動的生成）────────────────────────────────────────────────────

class PricingAiSummaryOut(BaseModel):
    summary: str
    bullets: list[str]


@router.get("/ai-summary", response_model=PricingAiSummaryOut)
async def get_pricing_ai_summary(
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """
    プライシングタブ用の AI サマリーを実データから動的生成する。
    現在の推奨件数・在庫消化状況・週末/平日差を分析してインサイトを返す。
    """
    today = date.today()
    days_14 = today + timedelta(days=14)

    recs_result = await db.execute(
        select(func.count(Recommendation.id)).where(
            and_(
                Recommendation.property_id == prop.id,
                Recommendation.status == "pending",
            )
        )
    )
    pending_count = int(recs_result.scalar() or 0)

    grid_result = await db.execute(
        select(PricingGrid).where(
            and_(
                PricingGrid.property_id == prop.id,
                PricingGrid.target_date >= today,
                PricingGrid.target_date <= days_14,
            )
        )
    )
    grids = grid_result.scalars().all()

    if not grids:
        return PricingAiSummaryOut(
            summary="価格グリッドのデータがありません。AI推奨を生成してください。",
            bullets=[],
        )

    # 在庫消化率・BAR分布を計算
    total_cells = len(grids)
    avg_price = int(sum(g.price for g in grids) / max(total_cells, 1))
    bar_counts: dict[str, int] = {}
    for g in grids:
        bar_counts[g.bar_level] = bar_counts.get(g.bar_level, 0) + 1

    most_common_bar = max(bar_counts, key=bar_counts.get) if bar_counts else "C"
    bar_a_pct = round(bar_counts.get("A", 0) / max(total_cells, 1) * 100)

    # 週末と平日の価格差
    weekend_grids = [g for g in grids if g.target_date.weekday() in (4, 5)]  # 金土
    weekday_grids = [g for g in grids if g.target_date.weekday() not in (4, 5)]
    weekend_avg = int(sum(g.price for g in weekend_grids) / max(len(weekend_grids), 1)) if weekend_grids else 0
    weekday_avg = int(sum(g.price for g in weekday_grids) / max(len(weekday_grids), 1)) if weekday_grids else 0
    weekend_premium_pct = round((weekend_avg - weekday_avg) / max(weekday_avg, 1) * 100) if weekday_avg else 0

    # 直近7日の実績稼働率
    week_ago = today - timedelta(days=7)
    perf_result = await db.execute(
        select(func.avg(DailyPerformance.occupancy_rate)).where(
            and_(
                DailyPerformance.property_id == prop.id,
                DailyPerformance.date >= week_ago,
                DailyPerformance.date < today,
            )
        )
    )
    recent_occ = round(float(perf_result.scalar() or 0), 1)

    # サマリー文章生成
    if pending_count > 0:
        summary = f"AI推奨が{pending_count}件の価格調整を提案しています。直近7日の稼働率は{recent_occ}%で、今後14日の平均単価は¥{avg_price:,}（BARランク最頻値: {most_common_bar}）です。"
    else:
        summary = f"直近7日の稼働率は{recent_occ}%。今後14日の平均単価は¥{avg_price:,}（BARランク{most_common_bar}中心）で推移しています。"

    bullets: list[str] = []

    if bar_a_pct >= 20:
        bullets.append(f"BARランクA（最高価格帯）が全日程の{bar_a_pct}%を占め、需要の高まりを反映しています")
    elif bar_a_pct == 0 and most_common_bar in ("D", "E"):
        bullets.append(f"BARランクが{most_common_bar}中心。需要回復に合わせた段階的な価格引き上げを検討してください")

    if weekend_premium_pct > 10:
        bullets.append(f"週末価格が平日比+{weekend_premium_pct}%のプレミアム設定。引き続き需要に合わせた価格分散を推奨します")
    elif weekend_premium_pct <= 5 and weekend_grids:
        bullets.append(f"週末と平日の価格差が{weekend_premium_pct}%と小さい状況。週末需要を捉えるため価格差の拡大を検討してください")

    if recent_occ >= 85:
        bullets.append(f"稼働率{recent_occ}%は高水準。今後の残室が少ない日程はBARランクを1段階引き上げ、RevPAR最大化を狙えます")
    elif recent_occ < 70:
        bullets.append(f"稼働率{recent_occ}%はやや伸び悩み。近隣イベント需要を取り込むため、週末・祝前日の価格見直しを推奨します")

    if pending_count > 0:
        bullets.append(f"{pending_count}件の価格調整提案を承認することで、最適な価格水準へ自動反映できます")

    return PricingAiSummaryOut(summary=summary, bullets=bullets)
