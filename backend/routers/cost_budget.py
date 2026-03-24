"""
コスト・予算管理 API
GET/POST/PATCH/DELETE /properties/{id}/costs
GET/POST/PATCH        /properties/{id}/budget
GET                   /properties/{id}/cost-summary  (GOPPAR 算出)
"""
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models import CostSetting, BudgetTarget, DailyPerformance, RoomType
from ..models.cost_setting import COST_CATEGORIES
from ..models.property import Property
from ..dependencies import get_authed_property

router = APIRouter(prefix="/properties/{property_id}", tags=["cost-budget"])


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class CostSettingOut(BaseModel):
    id: int
    property_id: int
    cost_category: str
    amount_per_room_night: int
    fixed_monthly: int
    model_config = {"from_attributes": True}


class CostSettingCreate(BaseModel):
    cost_category: str
    amount_per_room_night: int = 0
    fixed_monthly: int = 0


class CostSettingUpdate(BaseModel):
    amount_per_room_night: Optional[int] = None
    fixed_monthly: Optional[int] = None


class BudgetTargetOut(BaseModel):
    id: int
    property_id: int
    year: int
    month: int
    target_occupancy: Optional[float]
    target_adr: Optional[int]
    target_revpar: Optional[int]
    target_revenue: Optional[int]
    model_config = {"from_attributes": True}


class BudgetTargetUpsert(BaseModel):
    year: int
    month: int
    target_occupancy: Optional[float] = None
    target_adr: Optional[int] = None
    target_revpar: Optional[int] = None
    target_revenue: Optional[int] = None


class CostSummaryOut(BaseModel):
    year: int
    month: int
    total_revenue: int
    total_rooms_sold: int
    avg_occupancy: float
    avg_adr: int
    # コスト計算
    variable_cost_total: int    # 変動費合計 (per_room_night × rooms_sold)
    fixed_cost_total: int       # 固定費合計
    total_cost: int
    goppar: int                 # GOPPAR = (revenue - 総コスト) / 総室数
    total_rooms: int            # 物件の総室数
    # 予算比較
    budget: Optional[BudgetTargetOut]
    budget_occupancy_rate: Optional[float]   # 予算達成率 (%)
    budget_revenue_rate: Optional[float]


# ─── コスト設定 CRUD ──────────────────────────────────────────────────────────

@router.get("/costs", response_model=list[CostSettingOut])
async def get_costs(
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CostSetting).where(CostSetting.property_id == prop.id)
    )
    return result.scalars().all()


@router.post("/costs", response_model=CostSettingOut)
async def create_cost(
    body: CostSettingCreate,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    if body.cost_category not in COST_CATEGORIES:
        raise HTTPException(400, f"カテゴリは {COST_CATEGORIES} のいずれかを指定してください")

    existing = await db.execute(
        select(CostSetting).where(
            CostSetting.property_id == prop.id,
            CostSetting.cost_category == body.cost_category,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "このカテゴリは既に登録されています")

    cost = CostSetting(
        property_id=prop.id,
        cost_category=body.cost_category,
        amount_per_room_night=body.amount_per_room_night,
        fixed_monthly=body.fixed_monthly,
    )
    db.add(cost)
    await db.commit()
    await db.refresh(cost)
    return cost


@router.patch("/costs/{cost_id}", response_model=CostSettingOut)
async def update_cost(
    cost_id: int,
    body: CostSettingUpdate,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    cost = await db.get(CostSetting, cost_id)
    if not cost or cost.property_id != prop.id:
        raise HTTPException(404, "コスト設定が見つかりません")

    if body.amount_per_room_night is not None:
        cost.amount_per_room_night = body.amount_per_room_night
    if body.fixed_monthly is not None:
        cost.fixed_monthly = body.fixed_monthly

    await db.commit()
    await db.refresh(cost)
    return cost


@router.delete("/costs/{cost_id}")
async def delete_cost(
    cost_id: int,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    cost = await db.get(CostSetting, cost_id)
    if not cost or cost.property_id != prop.id:
        raise HTTPException(404, "コスト設定が見つかりません")
    await db.delete(cost)
    await db.commit()
    return {"status": "deleted"}


# ─── 予算設定 CRUD ────────────────────────────────────────────────────────────

@router.get("/budget", response_model=list[BudgetTargetOut])
async def get_budget(
    year: Optional[int] = None,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    query = select(BudgetTarget).where(BudgetTarget.property_id == prop.id)
    if year:
        query = query.where(BudgetTarget.year == year)
    query = query.order_by(BudgetTarget.year, BudgetTarget.month)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/budget", response_model=BudgetTargetOut)
async def upsert_budget(
    body: BudgetTargetUpsert,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """月次予算を設定（既存レコードがあれば更新、なければ作成）"""
    existing = await db.execute(
        select(BudgetTarget).where(
            BudgetTarget.property_id == prop.id,
            BudgetTarget.year == body.year,
            BudgetTarget.month == body.month,
        )
    )
    budget = existing.scalar_one_or_none()

    if budget:
        if body.target_occupancy is not None:
            budget.target_occupancy = body.target_occupancy
        if body.target_adr is not None:
            budget.target_adr = body.target_adr
        if body.target_revpar is not None:
            budget.target_revpar = body.target_revpar
        if body.target_revenue is not None:
            budget.target_revenue = body.target_revenue
    else:
        budget = BudgetTarget(
            property_id=prop.id,
            year=body.year,
            month=body.month,
            target_occupancy=body.target_occupancy,
            target_adr=body.target_adr,
            target_revpar=body.target_revpar,
            target_revenue=body.target_revenue,
        )
        db.add(budget)

    await db.commit()
    await db.refresh(budget)
    return budget


# ─── コストサマリー（GOPPAR 算出）────────────────────────────────────────────

@router.get("/cost-summary", response_model=list[CostSummaryOut])
async def get_cost_summary(
    months: int = 3,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """
    直近 N ヶ月のコスト・収益サマリーを返す。
    GOPPAR = (総売上 - 変動費 - 固定費) / 総室数 / 日数
    """
    today = date.today()

    costs_result = await db.execute(
        select(CostSetting).where(CostSetting.property_id == prop.id)
    )
    costs = costs_result.scalars().all()
    fixed_monthly_total = sum(c.fixed_monthly for c in costs)
    variable_per_room = sum(c.amount_per_room_night for c in costs)

    rooms_result = await db.execute(
        select(func.sum(RoomType.total_rooms)).where(RoomType.property_id == prop.id)
    )
    total_rooms = int(rooms_result.scalar() or 134)

    summaries = []
    for i in range(months):
        # 直近 months ヶ月（今月〜過去）
        year = today.year + (today.month - 1 - i) // 12
        month = (today.month - 1 - i) % 12 + 1
        if month <= 0:
            month += 12
            year -= 1

        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)

        end_date = min(month_end, today - timedelta(days=1))

        perf_result = await db.execute(
            select(
                func.sum(DailyPerformance.revenue).label("revenue"),
                func.sum(DailyPerformance.rooms_sold).label("rooms_sold"),
                func.avg(DailyPerformance.occupancy_rate).label("avg_occ"),
                func.avg(DailyPerformance.adr).label("avg_adr"),
            ).where(
                and_(
                    DailyPerformance.property_id == prop.id,
                    DailyPerformance.date >= month_start,
                    DailyPerformance.date <= end_date,
                )
            )
        )
        perf = perf_result.one()

        total_revenue = int(perf.revenue or 0)
        rooms_sold = int(perf.rooms_sold or 0)
        avg_occ = round(float(perf.avg_occ or 0), 1)
        avg_adr = int(perf.avg_adr or 0)

        variable_total = rooms_sold * variable_per_room
        total_cost = variable_total + fixed_monthly_total
        days_in_month = (month_end - month_start).days + 1
        goppar = int((total_revenue - total_cost) / max(total_rooms * days_in_month, 1))

        # 予算
        budget_result = await db.execute(
            select(BudgetTarget).where(
                BudgetTarget.property_id == prop.id,
                BudgetTarget.year == year,
                BudgetTarget.month == month,
            )
        )
        budget = budget_result.scalar_one_or_none()

        budget_occ_rate = None
        budget_rev_rate = None
        if budget:
            if budget.target_occupancy:
                budget_occ_rate = round(avg_occ / budget.target_occupancy * 100, 1)
            if budget.target_revenue:
                budget_rev_rate = round(total_revenue / budget.target_revenue * 100, 1)

        summaries.append(CostSummaryOut(
            year=year,
            month=month,
            total_revenue=total_revenue,
            total_rooms_sold=rooms_sold,
            avg_occupancy=avg_occ,
            avg_adr=avg_adr,
            variable_cost_total=variable_total,
            fixed_cost_total=fixed_monthly_total,
            total_cost=total_cost,
            goppar=goppar,
            total_rooms=total_rooms,
            budget=BudgetTargetOut.model_validate(budget) if budget else None,
            budget_occupancy_rate=budget_occ_rate,
            budget_revenue_rate=budget_rev_rate,
        ))

    return summaries
