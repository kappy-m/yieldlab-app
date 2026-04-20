"""
既存の daily_performances を今日 + 90日先まで延伸する。
既存レコードは上書きしない（ON CONFLICT DO NOTHING 相当）。

Usage:
    cd /volume1/docker/yieldlab-app
    python3 -m backend.seed_extend_daily
"""
import asyncio
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .database import AsyncSessionLocal, engine
from .models import Property, DailyPerformance
from .seed_runner import (
    _generate_daily_perf,
    RPH_BASE_OCC, RPH_BASE_ADR, RPH_ROOMS,
    CANVAS_BASE_OCC, CANVAS_BASE_ADR, CANVAS_ROOMS,
)


async def extend_daily_performances(days_ahead: int = 90) -> None:
    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    async with AsyncSessionLocal() as db:
        props = (await db.execute(select(Property))).scalars().all()

        for prop in props:
            # 物件種別ごとのパラメータ
            if "銀座" in prop.name or "canvas" in prop.name.lower():
                base_occ = CANVAS_BASE_OCC
                base_adr = CANVAS_BASE_ADR
                total    = CANVAS_ROOMS
                premium  = 1.30
            else:
                base_occ = RPH_BASE_OCC
                base_adr = RPH_BASE_ADR
                total    = RPH_ROOMS
                premium  = 1.18

            # 既存の最大日付を確認
            max_date_row = await db.execute(
                select(DailyPerformance.date)
                .where(DailyPerformance.property_id == prop.id)
                .order_by(DailyPerformance.date.desc())
                .limit(1)
            )
            max_date = max_date_row.scalar_one_or_none()
            start_date = (max_date + timedelta(days=1)) if max_date else today

            if start_date > end_date:
                print(f"  [{prop.name}] 既に {max_date} まで存在 — skip")
                continue

            inserted = 0
            d = start_date
            while d <= end_date:
                row = _generate_daily_perf(
                    property_id=prop.id,
                    d=d,
                    total_rooms=total,
                    base_occ_by_dow=base_occ,
                    base_adr=base_adr,
                    adr_weekend_premium=premium,
                )
                db.add(row)
                inserted += 1
                d += timedelta(days=1)

            await db.commit()
            print(f"  [{prop.name}] {start_date} 〜 {end_date}: {inserted}件追加")

    print(f"完了: 今日({today}) + {days_ahead}日先({end_date}) まで延伸")


if __name__ == "__main__":
    asyncio.run(extend_daily_performances())
