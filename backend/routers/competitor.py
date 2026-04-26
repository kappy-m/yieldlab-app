from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, field_serializer
from datetime import date, datetime, timedelta
from ..database import get_db
from ..models import CompetitorPrice
from ..models.property import Property
from ..services.scraper import scrape_dates_range
from ..dependencies import get_authed_property

router = APIRouter(prefix="/properties/{property_id}/competitor", tags=["competitor"])


class CompetitorPriceOut(BaseModel):
    id: int
    competitor_name: str
    target_date: date
    price: int
    available_rooms: int | None
    plans_available: int | None = None
    scraped_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("target_date")
    def serialize_date(self, v: date) -> str:
        return v.isoformat()

    @field_serializer("scraped_at")
    def serialize_datetime(self, v: datetime) -> str:
        return v.isoformat()


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
    date_from: date | None = None,
    date_to: date | None = None,
    competitor_name: str | None = None,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    query = select(CompetitorPrice).where(CompetitorPrice.property_id == prop.id)
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
    date_from: date | None = None,
    date_to: date | None = None,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """競合の日別平均・最安・最高価格を集計"""
    query = select(
        CompetitorPrice.target_date,
        func.avg(CompetitorPrice.price).label("avg_price"),
        func.min(CompetitorPrice.price).label("min_price"),
        func.max(CompetitorPrice.price).label("max_price"),
        func.count(CompetitorPrice.id).label("count"),
    ).where(CompetitorPrice.property_id == prop.id)

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


@router.delete("/prices/clear")
async def clear_competitor_prices(
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """競合価格データを全削除（comp-set変更後のリセット用）"""
    from sqlalchemy import delete
    result = await db.execute(
        delete(CompetitorPrice).where(CompetitorPrice.property_id == prop.id)
    )
    await db.commit()
    return {"status": "cleared", "deleted_rows": result.rowcount}


@router.get("/demand-curve")
async def get_demand_curve(
    check_in_date: date,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """
    特定チェックイン日の需要カーブデータを返す。

    同一 check_in_date に対して観測日(scraped_at)が異なる複数スナップショットが
    存在する場合、価格と予約可能プラン数の時系列変化を返す。

    これにより:
    - 価格低下 + プラン数減少 → 値下げが需要を喚起（価格弾力性あり）
    - 価格維持 + プラン数減少 → 自然需要（強い日程）
    - 価格上昇 + プラン数多数 → 強気戦略（様子見中）
    などを把握し、プライシングアルゴリズムの学習データとして活用できる。
    """
    query = (
        select(
            CompetitorPrice.competitor_name,
            CompetitorPrice.scraped_at,
            CompetitorPrice.price,
            CompetitorPrice.plans_available,
        )
        .where(
            and_(
                CompetitorPrice.property_id == prop.id,
                CompetitorPrice.target_date == check_in_date,
            )
        )
        .order_by(CompetitorPrice.competitor_name, CompetitorPrice.scraped_at)
    )
    result = await db.execute(query)
    rows = result.all()

    # ホテル別に整形
    curve: dict[str, list] = {}
    for row in rows:
        name = row.competitor_name
        if name not in curve:
            curve[name] = []
        curve[name].append({
            "observed_at": row.scraped_at.isoformat() if row.scraped_at else None,
            "price": row.price,
            "plans_available": row.plans_available,
        })

    # 各ホテルの価格変動率・プラン減少率を計算
    summary = []
    for name, snapshots in curve.items():
        if len(snapshots) < 2:
            summary.append({
                "competitor": name,
                "snapshots": snapshots,
                "price_change_pct": None,
                "plan_depletion_rate": None,
                "signal": "データ不足（スナップショット1件）",
            })
            continue

        first = snapshots[0]
        last  = snapshots[-1]

        price_change_pct = (
            round((last["price"] - first["price"]) / first["price"] * 100, 1)
            if first["price"] else None
        )

        # プラン数の変化率（減少率 = 逼迫度の代理指標）
        if first.get("plans_available") and last.get("plans_available") is not None:
            plan_depletion_rate = round(
                (first["plans_available"] - last["plans_available"])
                / first["plans_available"] * 100, 1
            )
        else:
            plan_depletion_rate = None

        # シグナル判定
        if price_change_pct is not None and plan_depletion_rate is not None:
            if price_change_pct < -3 and plan_depletion_rate > 20:
                signal = "値下げ→需要喚起あり（価格弾力性検出）"
            elif price_change_pct <= 0 and plan_depletion_rate > 30:
                signal = "価格維持でも自然需要旺盛（強い日程）"
            elif price_change_pct > 3 and plan_depletion_rate < 10:
                signal = "値上げ中・在庫豊富（様子見戦略）"
            elif plan_depletion_rate > 50:
                signal = "急速な逼迫（早期満室の可能性）"
            else:
                signal = "通常推移"
        else:
            signal = "分析データ不足"

        summary.append({
            "competitor": name,
            "snapshots": snapshots,
            "price_change_pct": price_change_pct,
            "plan_depletion_rate": plan_depletion_rate,
            "signal": signal,
        })

    return {
        "check_in_date": check_in_date.isoformat(),
        "property_id": prop.id,
        "competitors": summary,
        "note": "plans_availableは楽天APIのroomInfo件数（予約可能プラン数）。直接の残室数ではなく逼迫度の代理指標として使用。",
    }


def _classify_strategy(points: list[tuple[int, float]]) -> str:
    """リードタイム曲線から競合の値付け戦略を分類する"""
    import statistics
    if len(points) < 5:
        return "insufficient_data"
    max_days = max(d for d, _ in points)
    # データ範囲に応じてしきい値を動的調整（最大30日なら半分以降を「遠い」と見なす）
    far_threshold = max(7, max_days // 2)
    near_threshold = min(7, max_days // 4)
    prices_far = [p for d, p in points if d > far_threshold]
    prices_near = [p for d, p in points if d <= near_threshold]
    if not prices_far or not prices_near:
        return "insufficient_data"
    all_prices = [p for _, p in points]
    mean_all = statistics.mean(all_prices)
    if mean_all == 0:
        return "insufficient_data"
    cv = statistics.stdev(all_prices) / mean_all if len(all_prices) > 1 else 0.0
    mean_far = statistics.mean(prices_far)
    mean_near = statistics.mean(prices_near)
    if cv < 0.05:
        return "stable_pricer"
    if mean_far > 0 and mean_near < mean_far * 0.90:
        return "last_minute_discounter"
    if mean_far > 0 and mean_near > mean_far * 1.10:
        return "demand_follower"
    return "premium_holder"


class LeadTimeCurvePoint(BaseModel):
    days_before: int
    avg_price: int
    sample_count: int


class LeadTimeCurveOut(BaseModel):
    competitor_name: str
    curves: list[LeadTimeCurvePoint]
    strategy: str   # premium_holder | demand_follower | last_minute_discounter | stable_pricer | insufficient_data
    total_samples: int


@router.get("/lead-time", response_model=list[LeadTimeCurveOut])
async def get_lead_time_curves(
    date_from: date | None = None,
    date_to: date | None = None,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """競合各社のリードタイム価格曲線と戦略分類を返す。
    days_before = target_date - scrape日。正の整数 = 何日前に見た価格か。
    全target_dateをaggregateして1競合1曲線を生成する。
    """
    today = date.today()
    df = date_from or (today - timedelta(days=30))
    dt = date_to or (today + timedelta(days=90))

    query = select(
        CompetitorPrice.competitor_name,
        CompetitorPrice.scraped_at,
        CompetitorPrice.target_date,
        CompetitorPrice.price,
    ).where(
        and_(
            CompetitorPrice.property_id == prop.id,
            CompetitorPrice.target_date >= df,
            CompetitorPrice.target_date <= dt,
        )
    )
    result = await db.execute(query)
    rows = result.all()

    # competitor_name → days_before(int) → [price, ...]
    buckets: dict[str, dict[int, list[int]]] = {}
    for row in rows:
        name = row.competitor_name
        td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
        sd = row.scraped_at.date() if hasattr(row.scraped_at, "date") else date.fromisoformat(str(row.scraped_at)[:10])
        days_before = (td - sd).days
        if days_before < 0:
            continue
        if name not in buckets:
            buckets[name] = {}
        if days_before not in buckets[name]:
            buckets[name][days_before] = []
        buckets[name][days_before].append(row.price)

    output: list[LeadTimeCurveOut] = []
    for name, day_map in sorted(buckets.items()):
        curves = [
            LeadTimeCurvePoint(
                days_before=d,
                avg_price=round(sum(prices) / len(prices)),
                sample_count=len(prices),
            )
            for d, prices in sorted(day_map.items(), reverse=True)
        ]
        all_points = [(c.days_before, float(c.avg_price)) for c in curves]
        output.append(LeadTimeCurveOut(
            competitor_name=name,
            curves=curves,
            strategy=_classify_strategy(all_points),
            total_samples=sum(c.sample_count for c in curves),
        ))

    return output


@router.post("/scrape")
async def trigger_scrape(
    body: ScrapeRequest,
    background_tasks: BackgroundTasks,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """Expedia スクレイピングをバックグラウンドで実行"""
    property_id = prop.id

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
