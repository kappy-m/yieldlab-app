"""
開発用シードデータ投入スクリプト
実行: cd backend && python -m seed
"""

import asyncio
from datetime import date, timedelta
from backend.database import init_db, AsyncSessionLocal
from backend.models import Organization, Property, RoomType, BarLadder, ApprovalSetting, PricingGrid, CompSet

ROOM_TYPES = [
    ("スタンダードシングル", "STD_SGL", 15, 0),
    ("スタンダードツイン",   "STD_TWN", 14, 1),
    ("デラックスツイン",     "DLX_TWN", 13, 2),
    ("スーペリアダブル",     "SUP_DBL", 12, 3),
    ("コーナーダブル",       "CNR_DBL", 11, 4),
    ("ジュニアスイート",     "JNR_STE", 10, 5),
    ("エグゼクティブスイート","EXE_STE",  9, 6),
    ("プレミアムスイート",   "PRM_STE",  8, 7),
    ("ペントハウススイート", "PHU_STE",  7, 8),
    ("ロイヤルスイート",     "RYL_STE",  6, 9),
]

BAR_PRICES: dict[str, dict[str, int]] = {
    "スタンダードシングル": {"A": 15000, "B": 13000, "C": 11000, "D": 9000,  "E": 7000},
    "スタンダードツイン":   {"A": 19000, "B": 16000, "C": 13000, "D": 11000, "E": 9000},
    "デラックスツイン":     {"A": 22000, "B": 20000, "C": 17000, "D": 15000, "E": 12000},
    "スーペリアダブル":     {"A": 28000, "B": 24000, "C": 20000, "D": 16000, "E": 13000},
    "コーナーダブル":       {"A": 31000, "B": 27000, "C": 22000, "D": 19000, "E": 15000},
    "ジュニアスイート":     {"A": 35000, "B": 30000, "C": 25000, "D": 22000, "E": 18000},
    "エグゼクティブスイート":{"A": 40000, "B": 34000, "C": 28000, "D": 24000, "E": 20000},
    "プレミアムスイート":   {"A": 45000, "B": 38000, "C": 30000, "D": 27000, "E": 22000},
    "ペントハウススイート": {"A": 52000, "B": 43000, "C": 35000, "D": 30000, "E": 25000},
    "ロイヤルスイート":     {"A": 60000, "B": 50000, "C": 42000, "D": 38000, "E": 30000},
}

INITIAL_LEVELS = ["C", "D", "C", "C", "C", "A", "A", "B", "C", "C", "C",
                  "B", "C", "D", "C", "B", "A", "C", "D", "B", "C", "A",
                  "C", "B", "C", "D", "C", "A", "B", "C", "D", "C", "B",
                  "A", "C", "D", "B", "C", "A", "C", "D", "B", "C", "A",
                  "C", "B", "D", "C", "A", "B", "C", "D", "B", "C", "A",
                  "C", "B", "C", "D", "C", "A", "B", "C", "D", "B", "C",
                  "A", "C", "B", "D", "C", "A", "B", "C", "D", "B", "C",
                  "A", "C", "B", "D", "C", "A", "B", "C", "D", "B", "C"]


async def seed():
    await init_db()

    async with AsyncSessionLocal() as session:
        # Organization
        org = Organization(name="サンプルホテルグループ", plan_tier="pro")
        session.add(org)
        await session.flush()

        # Property
        prop = Property(
            org_id=org.id,
            name="東京・渋谷ホテル",
            cm_property_code="TL_SHIBUYA_001",
            timezone="Asia/Tokyo",
        )
        session.add(prop)
        await session.flush()

        # ApprovalSetting
        setting = ApprovalSetting(
            property_id=prop.id,
            auto_approve_threshold_levels=1,
            notification_channel="email",
            notification_email="rm@example.com",
        )
        session.add(setting)

        # Comp Set（渋谷エリアの実在競合ホテル — Expedia Japan IDを実測値で設定）
        comp_hotels = [
            {
                "name": "セルリアンタワー東急ホテル",
                "expedia_id": "661016",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Cerulean-Tower-Tokyu-Hotel.h661016.Hotel-Information",
                "sort": 0,
            },
            {
                "name": "渋谷エクセルホテル東急",
                "expedia_id": "486569",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Shibuya-Excel-Hotel-Tokyu.h486569.Hotel-Information",
                "sort": 1,
            },
            {
                "name": "渋谷グランベルホテル",
                "expedia_id": "8150500",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Shibuya-Granbell-Hotel.h8150500.Hotel-Information",
                "sort": 2,
            },
            {
                "name": "ヒルトン東京",
                "expedia_id": "22597",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Hilton-Tokyo.h22597.Hotel-Information",
                "sort": 3,
            },
            {
                "name": "パークハイアット東京",
                "expedia_id": "108657",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Park-Hyatt-Tokyo.h108657.Hotel-Information",
                "sort": 4,
            },
        ]
        for ch in comp_hotels:
            cs = CompSet(
                property_id=prop.id,
                name=ch["name"],
                expedia_hotel_id=ch["expedia_id"],
                expedia_url=ch.get("url"),
                scrape_mode="mock",  # 本番スクレイプ時は "live" に変更
                is_active=True,
                sort_order=ch["sort"],
            )
            session.add(cs)

        # RoomTypes + BarLadders + PricingGrid
        today = date.today()
        level_cycle = INITIAL_LEVELS

        for room_name, cm_code, total, sort in ROOM_TYPES:
            rt = RoomType(
                property_id=prop.id,
                name=room_name,
                cm_room_type_code=cm_code,
                total_rooms=total,
                sort_order=sort,
            )
            session.add(rt)
            await session.flush()

            prices = BAR_PRICES.get(room_name, {})
            for level, price in prices.items():
                bl = BarLadder(
                    property_id=prop.id,
                    room_type_id=rt.id,
                    level=level,
                    price=price,
                    label={"A": "最高価格帯", "B": "高価格帯", "C": "標準価格帯", "D": "割引価格帯", "E": "大幅割引価格帯"}[level],
                )
                session.add(bl)

            for day_offset in range(90):
                d = today + timedelta(days=day_offset)
                lvl = level_cycle[(sort * 7 + day_offset) % len(level_cycle)]
                price = prices.get(lvl, prices.get("C", 12000))
                stock = max(2, total - day_offset // 10)
                pg = PricingGrid(
                    property_id=prop.id,
                    room_type_id=rt.id,
                    target_date=d,
                    bar_level=lvl,
                    price=price,
                    available_rooms=stock,
                    updated_by="manual",
                )
                session.add(pg)

        await session.commit()
        print(f"✓ Seeded property_id={prop.id}: {prop.name}")
        print(f"  Org: {org.name}")
        print(f"  Room types: {len(ROOM_TYPES)}")
        print(f"  Pricing grids: {len(ROOM_TYPES) * 90} rows")


if __name__ == "__main__":
    asyncio.run(seed())
