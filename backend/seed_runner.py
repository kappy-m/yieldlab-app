"""
シードデータ投入ロジック（main.py の lifespan から呼ばれる）
"""
import math
from datetime import date, timedelta
from .database import AsyncSessionLocal
from .models import Organization, Property, RoomType, BarLadder, ApprovalSetting, PricingGrid, CompSet, DailyPerformance


# ============================================================
# 日次実績サンプルデータ生成ヘルパー
# ============================================================

def _pseudo_rand(date_seed: int, salt: int = 0) -> float:
    """決定論的疑似乱数 (0.0〜1.0)"""
    x = (date_seed * 9301 + salt * 49297 + 233995) % 233280
    return x / 233280.0


def _seasonal_factor(d: date) -> float:
    """季節・月ごとの需要係数 (1.0 = 通常期)"""
    m = d.month
    day = d.day
    # 桜シーズン(3月下旬〜4月上旬)・GW・夏休み・年末年始を高く設定
    if m == 3 and day >= 20:
        return 1.18
    elif m == 4:
        return 1.22 if day <= 7 else 1.12  # 桜 > GW前哨戦
    elif m == 5 and day <= 6:
        return 1.25  # GW
    elif m == 5:
        return 1.08
    elif m in (6,):
        return 0.95  # 梅雨
    elif m in (7, 8):
        return 1.10  # 夏
    elif m == 9:
        return 1.05  # 秋の連休
    elif m in (10, 11):
        return 1.08  # 紅葉・ビジネス繁忙
    elif m == 12 and day >= 20:
        return 1.20  # 年末
    elif m == 12:
        return 1.12
    elif m == 1 and day <= 4:
        return 0.90  # 正月明け低迷
    elif m == 2:
        return 0.95  # バレンタイン以外低め
    else:
        return 1.00


def _generate_daily_perf(
    property_id: int,
    d: date,
    total_rooms: int,
    base_occ_by_dow: list[float],   # [Sun,Mon,Tue,Wed,Thu,Fri,Sat]
    base_adr: int,
    adr_weekend_premium: float = 1.20,
) -> DailyPerformance:
    """1日分の日次実績レコードを生成"""
    dow = d.weekday()  # 0=月,...,6=日
    # Python weekday: 0=Mon...6=Sun → base_occ_by_dow は [Sun,Mon,...Sat] = index = (dow+1)%7
    dow_idx = (dow + 1) % 7  # 0=Sun,1=Mon,...,6=Sat
    is_weekend = dow in (5, 6)  # 土日

    seasonal = _seasonal_factor(d)
    date_int = d.year * 10000 + d.month * 100 + d.day

    # 稼働率
    base_occ = base_occ_by_dow[dow_idx]
    noise_occ = (_pseudo_rand(date_int, 1) - 0.5) * 6.0  # ±3pt
    occ = min(98.0, max(40.0, base_occ * seasonal + noise_occ))
    rooms_sold = round(total_rooms * occ / 100)

    # ADR
    adr_factor = adr_weekend_premium if is_weekend else 1.0
    noise_adr = (_pseudo_rand(date_int, 2) - 0.5) * 0.12  # ±6%
    adr = round(base_adr * seasonal * adr_factor * (1 + noise_adr) / 100) * 100

    revenue = rooms_sold * adr
    revpar = revenue // total_rooms

    # 予約動態（その日に入った新規予約）
    noise_bk = _pseudo_rand(date_int, 3)
    new_bookings = max(1, round(rooms_sold * 0.15 * (0.7 + noise_bk * 0.6)))

    noise_cx = _pseudo_rand(date_int, 4)
    cancellations = max(0, round(new_bookings * 0.08 * (0.5 + noise_cx)))

    return DailyPerformance(
        property_id=property_id,
        date=d,
        occupancy_rate=round(occ, 1),
        rooms_sold=rooms_sold,
        total_rooms=total_rooms,
        adr=adr,
        revenue=revenue,
        revpar=revpar,
        new_bookings=new_bookings,
        cancellations=cancellations,
    )


# RPH日本橋: シティホテル・ビジネス＋観光
# DOW別ベース稼働率 [Sun,Mon,Tue,Wed,Thu,Fri,Sat]
RPH_BASE_OCC = [76.0, 71.0, 73.0, 75.0, 77.0, 86.0, 91.0]
RPH_BASE_ADR = 15500
RPH_ROOMS = 413

# 銀座Canvas: デザインホテル・週末観光客が多い
CANVAS_BASE_OCC = [83.0, 69.0, 71.0, 73.0, 75.0, 91.0, 95.0]
CANVAS_BASE_ADR = 21000
CANVAS_ROOMS = 134

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

        # ===== 日次実績サンプルデータ =====
        # 過去120日 + 今日 = 121日分（前日実績サマリーに十分な履歴）
        today = date.today()
        for day_offset in range(-120, 0):
            d = today + timedelta(days=day_offset)

            session.add(_generate_daily_perf(
                property_id=prop.id,
                d=d,
                total_rooms=RPH_ROOMS,
                base_occ_by_dow=RPH_BASE_OCC,
                base_adr=RPH_BASE_ADR,
                adr_weekend_premium=1.18,
            ))
            session.add(_generate_daily_perf(
                property_id=canvas.id,
                d=d,
                total_rooms=CANVAS_ROOMS,
                base_occ_by_dow=CANVAS_BASE_OCC,
                base_adr=CANVAS_BASE_ADR,
                adr_weekend_premium=1.30,
            ))

        await session.commit()
