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

# TL-Lincoln互換 20レベル: level "1"=最高値, "20"=最安値
# (max_rate, min_rate) のペアから20レベルを線形補間で生成
_ROOM_RATE_RANGE: dict[str, tuple[int, int]] = {
    "スタンダードシングル": (16000,  7000),
    "スタンダードツイン":   (20000,  9000),
    "デラックスツイン":     (24000, 12000),
    "スーペリアダブル":     (30000, 13000),
    "コーナーダブル":       (33000, 15000),
    "ジュニアスイート":     (38000, 18000),
    "エグゼクティブスイート":(42000, 20000),
    "プレミアムスイート":   (48000, 22000),
    "ペントハウススイート": (55000, 25000),
    "ロイヤルスイート":     (65000, 30000),
}


def _build_bar_prices(max_rate: int, min_rate: int, levels: int = 20) -> dict[str, int]:
    """1〜20のレートランクに対応した価格辞書を線形補間で生成（500円単位切り捨て）"""
    result: dict[str, int] = {}
    for n in range(1, levels + 1):
        raw = max_rate - (max_rate - min_rate) * (n - 1) / (levels - 1)
        result[str(n)] = int(raw / 500) * 500  # 500円単位
    return result


BAR_PRICES: dict[str, dict[str, int]] = {
    name: _build_bar_prices(*rng) for name, rng in _ROOM_RATE_RANGE.items()
}

# 旧 A/B/C/D/E → 数値レベルへの対応マップ (A=3, B=7, C=10, D=15, E=18)
_OLD_LEVEL_MAP = {"A": "3", "B": "7", "C": "10", "D": "15", "E": "18"}
_OLD_INITIAL = ["C", "D", "C", "C", "C", "A", "A", "B", "C", "C", "C",
                "B", "C", "D", "C", "B", "A", "C", "D", "B", "C", "A",
                "C", "B", "C", "D", "C", "A", "B", "C", "D", "C", "B",
                "A", "C", "D", "B", "C", "A", "C", "D", "B", "C", "A",
                "C", "B", "D", "C", "A", "B", "C", "D", "B", "C", "A",
                "C", "B", "C", "D", "C", "A", "B", "C", "D", "B", "C",
                "A", "C", "B", "D", "C", "A", "B", "C", "D", "B", "C",
                "A", "C", "B", "D", "C", "A", "B", "C", "D", "B", "C"]
INITIAL_LEVELS = [_OLD_LEVEL_MAP[x] for x in _OLD_INITIAL]


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

        # Comp Set（Royal Park Hotels チェーン — Expedia IDは実測値）
        comp_hotels = [
            {
                "name": "ロイヤルパークホテル 東京日本橋",
                "expedia_id": "21288",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Royal-Park-Hotel-Tokyo-Nihonbashi.h21288.Hotel-Information",
                "sort": 0,
            },
            {
                "name": "ザ ロイヤルパーク ホテル 銀座6丁目",
                "expedia_id": "96969455",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-The-Royal-Park-Hotel-Ginza-6-Chome.h96969455.Hotel-Information",
                "sort": 1,
            },
            {
                "name": "ザ ロイヤルパーク ホテル 東京羽田",
                "expedia_id": "8080801",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-The-Royal-Park-Hotel-Tokyo-Haneda.h8080801.Hotel-Information",
                "sort": 2,
            },
            {
                "name": "ロイヤルパーク キャンバス 渋谷桜丘",
                "expedia_id": "96969456",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Royal-Park-Canvas-Shibuya-Sakuragaoka.h96969456.Hotel-Information",
                "sort": 3,
            },
            {
                "name": "ロイヤルパーク キャンバス 大手町",
                "expedia_id": "96969457",
                "url": "https://www.expedia.co.jp/Tokyo-Hotels-Royal-Park-Canvas-Otemachi.h96969457.Hotel-Information",
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
            for level_str, price in prices.items():
                n = int(level_str)
                if n <= 3:
                    label = "プレミアム"
                elif n <= 7:
                    label = "ハイシーズン"
                elif n <= 12:
                    label = "スタンダード"
                elif n <= 16:
                    label = "ディスカウント"
                else:
                    label = "ローレート"
                bl = BarLadder(
                    property_id=prop.id,
                    room_type_id=rt.id,
                    level=level_str,
                    price=price,
                    label=label,
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
