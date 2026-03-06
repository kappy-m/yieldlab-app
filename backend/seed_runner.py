"""
シードデータ投入ロジック（main.py の lifespan から呼ばれる）
"""
from datetime import date, timedelta
from .database import AsyncSessionLocal
from .models import Organization, Property, RoomType, BarLadder, ApprovalSetting, PricingGrid, CompSet

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

INITIAL_LEVELS = [
    "C","D","C","C","C","A","A","B","C","C","C",
    "B","C","D","C","B","A","C","D","B","C","A",
    "C","B","C","D","C","A","B","C","D","C","B",
    "A","C","D","B","C","A","C","D","B","C","A",
    "C","B","D","C","A","B","C","D","B","C","A",
    "C","B","C","D","C","A","B","C","D","B","C",
    "A","C","B","D","C","A","B","C","D","B","C",
    "A","C","B","D","C","A","B","C","D","B","C",
]

# ===== 日本橋 競合セット =====
COMP_HOTELS = [
    {
        "name": "パレスホテル東京",
        "expedia_id": "69969",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Palace-Hotel-Tokyo.h69969.Hotel-Information",
        "rakuten_no": "184685",   # ✅ 楽天トラベル掲載確認済み
        "scrape_mode": "rakuten",
        "sort": 0,
    },
    {
        "name": "ザ・ペニンシュラ東京",
        "expedia_id": "1631412",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-The-Peninsula-Tokyo.h1631412.Hotel-Information",
        "rakuten_no": "184598",   # ✅ 楽天トラベル掲載確認済み
        "scrape_mode": "rakuten",
        "sort": 1,
    },
    {
        "name": "コンラッド東京",
        "expedia_id": "3895551",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Conrad-Tokyo.h3895551.Hotel-Information",
        "rakuten_no": "78151",    # ✅ 楽天トラベル掲載確認済み
        "scrape_mode": "rakuten",
        "sort": 2,
    },
    {
        "name": "マンダリン オリエンタル 東京",
        "expedia_id": "8045938",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Mandarin-Oriental-Tokyo.h8045938.Hotel-Information",
        "rakuten_no": None,       # 楽天非掲載 → mockフォールバック
        "scrape_mode": "mock",
        "sort": 3,
    },
    {
        "name": "シャングリ・ラ 東京",
        "expedia_id": "8080797",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Shangri-La-Hotel-Tokyo.h8080797.Hotel-Information",
        "rakuten_no": None,       # 楽天非掲載 → mockフォールバック
        "scrape_mode": "mock",
        "sort": 4,
    },
]

# ===== 銀座Canvas 客室タイプ・価格 =====
CANVAS_ROOM_TYPES = [
    ("スタンダードルーム",       "STD",     60, 0),
    ("デラックスルーム",         "DLX",     40, 1),
    ("コーナーデラックスルーム", "CNR_DLX", 20, 2),
    ("スタジオスイート",         "STU_STE", 10, 3),
    ("スイートルーム",           "STE",      4, 4),
]

CANVAS_BAR_PRICES: dict[str, dict[str, int]] = {
    "スタンダードルーム":       {"A": 22000, "B": 18000, "C": 14000, "D": 11000, "E": 8500},
    "デラックスルーム":         {"A": 28000, "B": 23000, "C": 18000, "D": 14000, "E": 11000},
    "コーナーデラックスルーム": {"A": 34000, "B": 28000, "C": 22000, "D": 18000, "E": 14000},
    "スタジオスイート":         {"A": 45000, "B": 37000, "C": 30000, "D": 24000, "E": 19000},
    "スイートルーム":           {"A": 60000, "B": 50000, "C": 40000, "D": 33000, "E": 26000},
}

# ===== 銀座Canvas 競合セット（同価格帯の銀座エリアホテル）=====
CANVAS_COMP_HOTELS = [
    {
        "name": "ホテルモントレ銀座",
        "expedia_id": "470223",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Hotel-Monterey-Ginza.h470223.Hotel-Information",
        "rakuten_no": "5002",     # ✅ 楽天トラベル確認済み
        "scrape_mode": "rakuten",
        "sort": 0,
    },
    {
        "name": "住友不動産ホテル ヴィラフォンテーヌグランド東京汐留",
        "expedia_id": "449889",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Villa-Fontaine-Premier-Shiodome.h449889.Hotel-Information",
        "rakuten_no": "80756",    # ✅ 楽天トラベル確認済み
        "scrape_mode": "rakuten",
        "sort": 1,
    },
    {
        "name": "東急ステイ銀座",
        "expedia_id": "2556234",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Tokyu-Stay-Ginza.h2556234.Hotel-Information",
        "rakuten_no": "149481",   # ✅ 楽天トラベル確認済み
        "scrape_mode": "rakuten",
        "sort": 2,
    },
    {
        "name": "ダイワロイネットホテル銀座　PREMIER",
        "expedia_id": "571978",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Daiwa-Roynet-Hotel-Ginza.h571978.Hotel-Information",
        "rakuten_no": "149164",   # ✅ 楽天トラベル確認済み
        "scrape_mode": "rakuten",
        "sort": 3,
    },
    {
        "name": "クインテッサホテル東京銀座",
        "expedia_id": "19292452",
        "url": "https://www.expedia.co.jp/Tokyo-Hotels-Quintessa-Hotel-Tokyo-Ginza.h19292452.Hotel-Information",
        "rakuten_no": "176983",   # ✅ 楽天トラベル確認済み
        "scrape_mode": "rakuten",
        "sort": 4,
    },
]

BAR_LEVEL_LABELS = {
    "A": "最高価格帯", "B": "高価格帯",
    "C": "標準価格帯", "D": "割引価格帯", "E": "大幅割引価格帯",
}


async def run_seed():
    async with AsyncSessionLocal() as session:
        org = Organization(name="ロイヤルパークホテルズ アンド リゾーツ", plan_tier="pro")
        session.add(org)
        await session.flush()

        prop = Property(
            org_id=org.id,
            name="ロイヤルパークホテル 東京日本橋",
            cm_property_code="RPH_NIHONBASHI_001",
            timezone="Asia/Tokyo",
            brand="ロイヤルパークホテル",
            address="東京都中央区日本橋蛎殻町2-1-1",
            star_rating=4,
            total_rooms=413,
            checkin_time="14:00",
            checkout_time="12:00",
            website_url="https://www.royalparkhotel.ne.jp/hotel/tokyo/",
        )
        session.add(prop)
        await session.flush()

        session.add(ApprovalSetting(
            property_id=prop.id,
            auto_approve_threshold_levels=1,
            notification_channel="email",
            notification_email="rm@example.com",
        ))

        for ch in COMP_HOTELS:
            session.add(CompSet(
                property_id=prop.id,
                name=ch["name"],
                expedia_hotel_id=ch["expedia_id"],
                expedia_url=ch["url"],
                rakuten_hotel_no=ch.get("rakuten_no"),
                scrape_mode=ch.get("scrape_mode", "mock"),
                is_active=True,
                sort_order=ch["sort"],
            ))

        today = date.today()
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
                session.add(BarLadder(
                    property_id=prop.id,
                    room_type_id=rt.id,
                    level=level,
                    price=price,
                    label=BAR_LEVEL_LABELS[level],
                ))

            for day_offset in range(90):
                d = today + timedelta(days=day_offset)
                lvl = INITIAL_LEVELS[(sort * 7 + day_offset) % len(INITIAL_LEVELS)]
                price = prices.get(lvl, prices.get("C", 12000))
                stock = max(2, total - day_offset // 10)
                session.add(PricingGrid(
                    property_id=prop.id,
                    room_type_id=rt.id,
                    target_date=d,
                    bar_level=lvl,
                    price=price,
                    available_rooms=stock,
                    updated_by="manual",
                ))

        # ===== 物件2: ザ ロイヤルパークキャンバス 銀座コリドー =====
        canvas = Property(
            org_id=org.id,
            name="ザ ロイヤルパークキャンバス 銀座コリドー",
            cm_property_code="RPH_CANVAS_GINZA_001",
            timezone="Asia/Tokyo",
            brand="ロイヤルパークキャンバス",
            address="東京都中央区銀座6-2-11",
            star_rating=4,
            total_rooms=134,
            checkin_time="15:00",
            checkout_time="11:00",
            website_url="https://canvas.royalparkhotels.co.jp/ginzacorridor/",
        )
        session.add(canvas)
        await session.flush()

        session.add(ApprovalSetting(
            property_id=canvas.id,
            auto_approve_threshold_levels=1,
            notification_channel="email",
            notification_email="rm@example.com",
        ))

        for ch in CANVAS_COMP_HOTELS:
            session.add(CompSet(
                property_id=canvas.id,
                name=ch["name"],
                expedia_hotel_id=ch["expedia_id"],
                expedia_url=ch["url"],
                rakuten_hotel_no=ch.get("rakuten_no"),
                scrape_mode=ch.get("scrape_mode", "mock"),
                is_active=True,
                sort_order=ch["sort"],
            ))

        for room_name, cm_code, total, sort in CANVAS_ROOM_TYPES:
            rt2 = RoomType(
                property_id=canvas.id,
                name=room_name,
                cm_room_type_code=cm_code,
                total_rooms=total,
                sort_order=sort,
            )
            session.add(rt2)
            await session.flush()

            prices2 = CANVAS_BAR_PRICES.get(room_name, {})
            for level, price in prices2.items():
                session.add(BarLadder(
                    property_id=canvas.id,
                    room_type_id=rt2.id,
                    level=level,
                    price=price,
                    label=BAR_LEVEL_LABELS[level],
                ))

            for day_offset in range(90):
                d = today + timedelta(days=day_offset)
                lvl = INITIAL_LEVELS[(sort * 5 + day_offset) % len(INITIAL_LEVELS)]
                price = prices2.get(lvl, prices2.get("C", 14000))
                stock = max(1, total - day_offset // 15)
                session.add(PricingGrid(
                    property_id=canvas.id,
                    room_type_id=rt2.id,
                    target_date=d,
                    bar_level=lvl,
                    price=price,
                    available_rooms=stock,
                    updated_by="manual",
                ))

        await session.commit()
