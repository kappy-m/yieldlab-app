from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..routers.auth import require_auth
from ..models.daily_performance import DailyPerformance
from ..models.recommendation import Recommendation
from ..models.competitor_price import CompetitorPrice
from ..models.budget_target import BudgetTarget
from ..models.user import User

router = APIRouter(prefix="/properties/{property_id}", tags=["overview"])


class TodayKpi(BaseModel):
    occ: float
    occ_change: float
    adr: float
    adr_change: float
    revpar: float
    revpar_change: float
    budget_progress: float | None


class OverviewAlert(BaseModel):
    type: Literal["pending_recommendation", "competitor_change", "upcoming_event"]
    count: int
    message: str
    severity: Literal["critical", "warning", "info"]


class WeeklyTrendPoint(BaseModel):
    date: str
    occ: float
    adr: float
    revpar: float


class OverviewResponse(BaseModel):
    today_kpi: TodayKpi
    alerts: list[OverviewAlert]
    weekly_trend: list[WeeklyTrendPoint]


@router.get("/overview/", response_model=OverviewResponse)
async def get_overview(
    property_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_auth),
):
    today = date.today()
    yesterday = today - timedelta(days=1)

    # ── 今日の実績 ──────────────────────────────────────────────
    today_row = await db.scalar(
        select(DailyPerformance).where(
            DailyPerformance.property_id == property_id,
            DailyPerformance.date == today,
        )
    )
    # 今日のデータがなければ直近の実績を使用
    if today_row is None:
        today_row = await db.scalar(
            select(DailyPerformance)
            .where(DailyPerformance.property_id == property_id)
            .order_by(DailyPerformance.date.desc())
            .limit(1)
        )

    yesterday_row = await db.scalar(
        select(DailyPerformance).where(
            DailyPerformance.property_id == property_id,
            DailyPerformance.date == yesterday,
        )
    )

    if today_row:
        # occupancy_rate は 0-100 のパーセント形式で格納されている
        occ = round(float(today_row.occupancy_rate), 1)
        adr = round(float(today_row.adr), 0)
        revpar = round(float(today_row.revpar), 0)
        occ_change = round(
            float(today_row.occupancy_rate) - float(yesterday_row.occupancy_rate), 1
        ) if yesterday_row else 0.0
        adr_change = round(
            float(today_row.adr) - float(yesterday_row.adr), 0
        ) if yesterday_row else 0.0
        revpar_change = round(
            float(today_row.revpar) - float(yesterday_row.revpar), 0
        ) if yesterday_row else 0.0
    else:
        occ = adr = revpar = occ_change = adr_change = revpar_change = 0.0

    # ── 月次予算進捗 ─────────────────────────────────────────────
    month_start = today.replace(day=1)
    budget_row = await db.scalar(
        select(BudgetTarget).where(
            BudgetTarget.property_id == property_id,
            BudgetTarget.year == today.year,
            BudgetTarget.month == today.month,
        )
    )

    budget_progress: float | None = None
    if budget_row and budget_row.target_revenue:
        month_revenue = await db.scalar(
            select(func.sum(DailyPerformance.revenue)).where(
                DailyPerformance.property_id == property_id,
                DailyPerformance.date >= month_start,
                DailyPerformance.date <= today,
            )
        ) or 0
        budget_progress = round(
            float(month_revenue) / float(budget_row.target_revenue) * 100, 1
        )

    # ── アラート ─────────────────────────────────────────────────
    alerts: list[OverviewAlert] = []

    # 未承認の料金推薦
    pending_count = await db.scalar(
        select(func.count(Recommendation.id)).where(
            Recommendation.property_id == property_id,
            Recommendation.status == "pending",
        )
    ) or 0
    if pending_count > 0:
        alerts.append(OverviewAlert(
            type="pending_recommendation",
            count=pending_count,
            message=f"{pending_count}件の料金推薦が承認待ちです",
            severity="critical" if pending_count >= 5 else "warning",
        ))

    # 競合料金の変動（直近2日の比較）
    # scraped_at は timestamp 型なので datetime オブジェクトで比較する
    two_days_ago_dt = datetime.combine(today - timedelta(days=2), datetime.min.time())
    comp_change_count = await db.scalar(
        select(func.count(func.distinct(CompetitorPrice.competitor_name))).where(
            CompetitorPrice.property_id == property_id,
            CompetitorPrice.target_date >= today,
            CompetitorPrice.target_date <= today + timedelta(days=7),
            CompetitorPrice.scraped_at >= two_days_ago_dt,
        )
    ) or 0
    if comp_change_count > 0:
        alerts.append(OverviewAlert(
            type="competitor_change",
            count=int(comp_change_count),
            message=f"競合{comp_change_count}社の直近料金データが更新されました",
            severity="info",
        ))

    # ── 週間トレンド（過去7日） ───────────────────────────────────
    week_ago = today - timedelta(days=7)
    perf_rows = (
        await db.execute(
            select(DailyPerformance)
            .where(
                DailyPerformance.property_id == property_id,
                DailyPerformance.date >= week_ago,
                DailyPerformance.date <= today,
            )
            .order_by(DailyPerformance.date.asc())
        )
    ).scalars().all()

    weekly_trend = [
        WeeklyTrendPoint(
            date=str(row.date),
            occ=round(float(row.occupancy_rate), 1),
            adr=round(float(row.adr), 0),
            revpar=round(float(row.revpar), 0),
        )
        for row in perf_rows
    ]

    return OverviewResponse(
        today_kpi=TodayKpi(
            occ=occ,
            occ_change=occ_change,
            adr=adr,
            adr_change=adr_change,
            revpar=revpar,
            revpar_change=revpar_change,
            budget_progress=budget_progress,
        ),
        alerts=alerts,
        weekly_trend=weekly_trend,
    )
