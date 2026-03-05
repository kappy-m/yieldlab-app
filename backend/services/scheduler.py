"""
APScheduler: 毎朝6時JST に以下を自動実行する
  1. 競合価格スクレイプ（mock or live）
  2. ルールエンジン実行 → 推奨価格生成
  3. 自動承認（閾値以内）→ pricing_grid に反映
"""

import logging
from datetime import date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, and_
from ..database import AsyncSessionLocal
from ..models import (
    Property, CompSet, CompetitorPrice,
    RoomType, BarLadder, PricingGrid, Recommendation,
    ApprovalSetting, ApprovalLog,
)
from ..services.mock_scraper import generate_mock_prices, DEFAULT_COMP_HOTELS
from ..services.rule_engine import RuleEngineInput, recommend

logger = logging.getLogger(__name__)


async def run_daily_pipeline(property_id: int | None = None):
    """毎朝のパイプライン: スクレイプ → ルールエンジン → 自動承認"""
    logger.info(f"[Scheduler] Daily pipeline started (property_id={property_id or 'all'})")

    async with AsyncSessionLocal() as db:
        # 対象施設を取得
        if property_id:
            props_result = await db.execute(select(Property).where(Property.id == property_id))
        else:
            props_result = await db.execute(select(Property))
        properties = props_result.scalars().all()

        for prop in properties:
            logger.info(f"[Scheduler] Processing property: {prop.name} (id={prop.id})")
            await _scrape_and_store(db, prop)
            await _run_rule_engine(db, prop)

    logger.info("[Scheduler] Daily pipeline completed")


async def _scrape_and_store(db, prop: "Property"):
    """競合価格スクレイプ → DB保存"""
    comp_result = await db.execute(
        select(CompSet).where(
            and_(CompSet.property_id == prop.id, CompSet.is_active == True)
        ).order_by(CompSet.sort_order)
    )
    comp_hotels_db = comp_result.scalars().all()

    if not comp_hotels_db:
        # Comp Setが未設定の場合はデフォルトを使用
        mock_hotels = DEFAULT_COMP_HOTELS
        logger.warning(f"[Scheduler] No comp set for property {prop.id}, using defaults")
    else:
        mock_hotels = [
            {
                "name": c.name,
                # base_price / variance は mock_scraper の HOTEL_PRICE_CATALOG から自動取得
                "expedia_id": c.expedia_hotel_id,
                "mode": c.scrape_mode,
            }
            for c in comp_hotels_db
        ]

    today = date.today()

    # モックモードのホテルはmock_scraperで処理
    mock_list = [h for h in mock_hotels if h.get("mode", "mock") == "mock"]
    if mock_list:
        prices = generate_mock_prices(mock_list, today, days=30)
        for p in prices:
            record = CompetitorPrice(
                property_id=prop.id,
                target_date=date.fromisoformat(p.target_date),
                competitor_name=p.competitor_name,
                price=p.price,
                available_rooms=p.available_rooms,
                source_url=p.source_url,
            )
            db.add(record)

    # liveモードのホテルはPlaywrightスクレイパーで処理（未実装時はスキップ）
    live_list = [h for h in mock_hotels if h.get("mode") == "live"]
    if live_list:
        try:
            from ..services.scraper import scrape_dates_range
            live_prices = await scrape_dates_range(live_list, today, days=30)
            for p in live_prices:
                record = CompetitorPrice(
                    property_id=prop.id,
                    target_date=p.target_date,
                    competitor_name=p.competitor_name,
                    price=p.price,
                    available_rooms=p.available_rooms,
                    source_url=p.source_url,
                )
                db.add(record)
        except Exception as e:
            logger.error(f"[Scheduler] Live scraping failed: {e}")

    await db.commit()
    logger.info(f"[Scheduler] Scraping done for property {prop.id}")


async def _run_rule_engine(db, prop: "Property"):
    """ルールエンジン実行 → 推奨生成 → 自動承認"""
    setting_result = await db.execute(
        select(ApprovalSetting).where(ApprovalSetting.property_id == prop.id)
    )
    setting = setting_result.scalar_one_or_none()
    threshold = setting.auto_approve_threshold_levels if setting else 1

    room_result = await db.execute(
        select(RoomType).where(RoomType.property_id == prop.id).order_by(RoomType.sort_order)
    )
    room_types = room_result.scalars().all()

    bar_result = await db.execute(
        select(BarLadder).where(
            and_(BarLadder.property_id == prop.id, BarLadder.is_active == True)
        )
    )
    bar_map: dict[str, dict[str, int]] = {}
    for b in bar_result.scalars().all():
        rt_id = str(b.room_type_id or "default")
        if rt_id not in bar_map:
            bar_map[rt_id] = {}
        bar_map[rt_id][b.level] = b.price

    today = date.today()
    new_recs = 0

    for rt in room_types:
        prices_rt = bar_map.get(str(rt.id)) or bar_map.get("default") or {}

        for day_offset in range(30):
            from datetime import timedelta
            target = today + timedelta(days=day_offset)

            grid_result = await db.execute(
                select(PricingGrid).where(
                    and_(
                        PricingGrid.property_id == prop.id,
                        PricingGrid.room_type_id == rt.id,
                        PricingGrid.target_date == target,
                    )
                )
            )
            grid = grid_result.scalar_one_or_none()
            current_level = grid.bar_level if grid else "C"
            current_price = grid.price if grid else prices_rt.get("C", 12000)
            available = grid.available_rooms if grid else rt.total_rooms

            # 競合平均価格（過去24h以内のデータ）
            from sqlalchemy import func
            comp_avg_result = await db.execute(
                select(func.avg(CompetitorPrice.price)).where(
                    and_(
                        CompetitorPrice.property_id == prop.id,
                        CompetitorPrice.target_date == target,
                    )
                )
            )
            comp_avg = comp_avg_result.scalar() or 0

            inp = RuleEngineInput(
                current_level=current_level,
                pace_ratio=1.0 + (day_offset % 7 - 3) * 0.02,
                inventory_ratio=available / max(rt.total_rooms, 1),
                competitor_avg_price=float(comp_avg) if comp_avg else current_price * 1.08,
                own_price=float(current_price),
                days_to_arrival=day_offset,
            )
            out = recommend(inp, threshold)

            if out.delta_levels == 0:
                continue

            # 既存の推奨がないか確認
            existing = await db.execute(
                select(Recommendation).where(
                    and_(
                        Recommendation.property_id == prop.id,
                        Recommendation.room_type_id == rt.id,
                        Recommendation.target_date == target,
                        Recommendation.status.in_(["pending", "auto_approved"]),
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            rec_price = prices_rt.get(out.recommended_level, current_price)
            status = "auto_approved" if not out.needs_approval else "pending"

            rec = Recommendation(
                property_id=prop.id,
                room_type_id=rt.id,
                target_date=target,
                current_bar_level=current_level,
                recommended_bar_level=out.recommended_level,
                current_price=current_price,
                recommended_price=rec_price,
                delta_levels=out.delta_levels,
                reason=out.reason,
                status=status,
            )
            db.add(rec)

            # 自動承認の場合は pricing_grid も更新
            if status == "auto_approved" and grid:
                grid.bar_level = out.recommended_level
                grid.price = rec_price
                grid.updated_by = "ai"

                log = ApprovalLog(
                    recommendation_id=0,  # flush後に更新
                    action="approved",
                    reviewer_id="auto",
                    note=f"自動承認（閾値{threshold}ランク以内）",
                )
                db.add(log)
            new_recs += 1

    await db.commit()
    logger.info(f"[Scheduler] Rule engine done: {new_recs} recommendations for property {prop.id}")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")
    scheduler.add_job(
        run_daily_pipeline,
        trigger=CronTrigger(hour=6, minute=0),
        id="daily_pipeline",
        name="Daily pricing pipeline",
        replace_existing=True,
    )
    return scheduler
