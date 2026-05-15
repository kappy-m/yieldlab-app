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
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_, func
from ..database import AsyncSessionLocal
from ..models import (
    Property, CompSet, CompetitorPrice,
    RoomType, BarLadder, PricingGrid, Recommendation,
    ApprovalSetting, ApprovalLog, BookingSnapshot,
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
        mock_hotels = DEFAULT_COMP_HOTELS
        logger.warning(f"[Scheduler] No comp set for property {prop.id}, using defaults")
    else:
        mock_hotels = [
            {
                "name": c.name,
                "expedia_id": c.expedia_hotel_id,
                "rakuten_no": c.rakuten_hotel_no,
                "mode": c.scrape_mode,
            }
            for c in comp_hotels_db
        ]

    today = date.today()

    # ①モードごとに分類
    mock_list    = [h for h in mock_hotels if h.get("mode", "mock") == "mock"]
    rakuten_list = [h for h in mock_hotels if h.get("mode") == "rakuten"]
    live_list    = [h for h in mock_hotels if h.get("mode") == "live"]

    # ② mock → mock_scraper
    if mock_list:
        prices = generate_mock_prices(mock_list, today, days=30)
        for p in prices:
            db.add(CompetitorPrice(
                property_id=prop.id,
                target_date=date.fromisoformat(p.target_date),
                competitor_name=p.competitor_name,
                price=p.price,
                available_rooms=p.available_rooms,
                source_url=p.source_url,
            ))

    # ③ rakuten → 楽天トラベル公式APIスクレイパー（90日分）
    if rakuten_list:
        try:
            from ..services.rakuten_scraper import scrape_rakuten_comp_set
            from datetime import timedelta
            check_in_dates = [
                (today + timedelta(days=i)).isoformat() for i in range(90)
            ]
            rakuten_input = [
                {"name": h["name"], "rakuten_no": h["rakuten_no"]}
                for h in rakuten_list
                if h.get("rakuten_no")
            ]
            if rakuten_input:
                rakuten_prices = await scrape_rakuten_comp_set(
                    rakuten_input, check_in_dates
                )
                for p in rakuten_prices:
                    db.add(CompetitorPrice(
                        property_id=prop.id,
                        target_date=date.fromisoformat(p.target_date),
                        competitor_name=p.competitor_name,
                        price=p.price,
                        available_rooms=p.available_rooms,     # hotelReserveInfo.reserveRecordCount
                        plans_available=p.available_rooms,     # 同上（需要カーブ分析用）
                        source_url=p.source_url,
                    ))
            # rakuten_no未設定のものはmockにフォールバック
            no_rakuten = [h for h in rakuten_list if not h.get("rakuten_no")]
            if no_rakuten:
                fallback_prices = generate_mock_prices(no_rakuten, today, days=30)
                for p in fallback_prices:
                    db.add(CompetitorPrice(
                        property_id=prop.id,
                        target_date=date.fromisoformat(p.target_date),
                        competitor_name=p.competitor_name,
                        price=p.price,
                        available_rooms=p.available_rooms,
                        source_url="mock://fallback",
                    ))
        except Exception as e:
            logger.error(f"[Scheduler] Rakuten scraping failed: {e}")

    # ④ live → Playwright/Expediaスクレイパー
    if live_list:
        try:
            from ..services.scraper import scrape_dates_range
            live_prices = await scrape_dates_range(live_list, today, days=30)
            for p in live_prices:
                db.add(CompetitorPrice(
                    property_id=prop.id,
                    target_date=p.target_date,
                    competitor_name=p.competitor_name,
                    price=p.price,
                    available_rooms=p.available_rooms,
                    source_url=p.source_url,
                ))
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


async def take_booking_snapshots():
    """
    毎日 0:00 JST に pricing_grids の在庫データから予約スナップショットを取る。
    booked_rooms = total_rooms - available_rooms として計算する。
    """
    today = date.today()
    logger.info(f"[Snapshot] Taking booking snapshots for {today}")

    async with AsyncSessionLocal() as db:
        props_result = await db.execute(select(Property))
        properties = props_result.scalars().all()

        for prop in properties:
            # 全部屋タイプの合計在庫を取得
            rt_result = await db.execute(
                select(RoomType).where(RoomType.property_id == prop.id)
            )
            room_types = rt_result.scalars().all()
            total_rooms = sum(rt.total_rooms for rt in room_types)
            if total_rooms == 0:
                continue

            # 今後90日分の各日について集計
            from datetime import timedelta
            for day_offset in range(91):
                target = today + timedelta(days=day_offset)

                # その日の全部屋タイプの available_rooms 合計
                avail_result = await db.execute(
                    select(func.sum(PricingGrid.available_rooms)).where(
                        and_(
                            PricingGrid.property_id == prop.id,
                            PricingGrid.target_date == target,
                        )
                    )
                )
                avail = int(avail_result.scalar() or 0)
                booked = max(0, total_rooms - avail)

                # 平均単価も取得して売上オンハンドを計算
                price_result = await db.execute(
                    select(func.avg(PricingGrid.price)).where(
                        and_(
                            PricingGrid.property_id == prop.id,
                            PricingGrid.target_date == target,
                        )
                    )
                )
                avg_price = float(price_result.scalar() or 0)
                booked_revenue = int(booked * avg_price)

                # UPSERT: 既存レコードがあれば更新
                existing = await db.execute(
                    select(BookingSnapshot).where(
                        BookingSnapshot.property_id == prop.id,
                        BookingSnapshot.capture_date == today,
                        BookingSnapshot.target_date == target,
                    )
                )
                snap = existing.scalar_one_or_none()
                if snap:
                    snap.booked_rooms = booked
                    snap.booked_revenue = booked_revenue
                else:
                    db.add(BookingSnapshot(
                        property_id=prop.id,
                        capture_date=today,
                        target_date=target,
                        booked_rooms=booked,
                        booked_revenue=booked_revenue,
                    ))

            await db.commit()
            logger.info(f"[Snapshot] Snapshots saved for property {prop.id}")

    logger.info("[Snapshot] Booking snapshots completed")


async def poll_imap_all_properties():
    """全プロパティの IMAP をポーリングする。IMAP 未設定時は即座にリターン。"""
    from ..config import settings
    if not settings.IMAP_HOST:
        return
    from sqlalchemy import select
    from ..models import Property
    from ..services.imap_poller import poll_imap_and_ingest
    async with AsyncSessionLocal() as db:
        props = (await db.execute(select(Property))).scalars().all()
    for prop in props:
        await poll_imap_and_ingest(prop.id)


async def run_google_trends_batch() -> None:
    """
    Google Trends バッチ取得（毎週月曜 03:00 JST）。
    全プロパティのエリアコードを収集してユニーク化し、エリア単位でフェッチする。
    """
    from ..services.trend_fetcher import fetch_all_areas

    logger.info("[Scheduler] Google Trends バッチ開始")
    async with AsyncSessionLocal() as db:
        props_result = await db.execute(select(Property))
        properties = props_result.scalars().all()
        areas = list({p.event_area for p in properties if p.event_area})
        if not areas:
            areas = ["nihonbashi"]

        results = await fetch_all_areas(areas, db)
        logger.info("[Scheduler] Google Trends バッチ完了: %s", results)


async def run_circuit_breaker_check() -> None:
    """
    Rating Circuit Breaker の定期チェック（毎週月曜 04:00 JST）。
    評価データ更新後に実行し、凍結状態を更新する。
    """
    from ..services.pricing_engine import check_and_update_circuit_breaker

    logger.info("[Scheduler] Circuit Breaker チェック開始")
    async with AsyncSessionLocal() as db:
        props_result = await db.execute(select(Property))
        properties = props_result.scalars().all()
        for prop in properties:
            try:
                await check_and_update_circuit_breaker(prop.id, db)
            except Exception as exc:
                logger.error(
                    "[Scheduler] Circuit Breaker チェック失敗 (property=%d): %s",
                    prop.id, exc,
                )
    logger.info("[Scheduler] Circuit Breaker チェック完了")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")
    scheduler.add_job(
        run_daily_pipeline,
        trigger=CronTrigger(hour=6, minute=0),
        id="daily_pipeline",
        name="Daily pricing pipeline",
        replace_existing=True,
    )
    scheduler.add_job(
        take_booking_snapshots,
        trigger=CronTrigger(hour=0, minute=5),
        id="booking_snapshots",
        name="Daily booking snapshots",
        replace_existing=True,
    )
    scheduler.add_job(
        poll_imap_all_properties,
        trigger=IntervalTrigger(minutes=5),
        id="imap_poll",
        name="IMAP guest mail polling (5min)",
        replace_existing=True,
    )
    scheduler.add_job(
        run_google_trends_batch,
        trigger=CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="google_trends_batch",
        name="Weekly Google Trends fetch (Mon 03:00 JST)",
        replace_existing=True,
    )
    scheduler.add_job(
        run_circuit_breaker_check,
        trigger=CronTrigger(day_of_week="mon", hour=4, minute=0),
        id="circuit_breaker_check",
        name="Weekly Rating Circuit Breaker check (Mon 04:00 JST)",
        replace_existing=True,
    )
    return scheduler
