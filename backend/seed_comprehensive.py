"""
包括的シードデータ — 全プロダクト3ヶ月分サンプルデータ
実行: cd /volume1/docker/yieldlab-app && python3 -m backend.seed_comprehensive
"""
from __future__ import annotations

import asyncio
import datetime
import json
from datetime import date, timedelta

from sqlalchemy import select, func, delete

from .database import AsyncSessionLocal, init_db
from .models.property import Property
from .models.room_type import RoomType
from .models.comp_set import CompSet
from .models.competitor_price import CompetitorPrice
from .models.competitor_rating import CompetitorRating
from .models.booking_snapshot import BookingSnapshot
from .models.cost_setting import CostSetting
from .models.budget_target import BudgetTarget
from .models.recommendation import Recommendation
from .models.guest_stay import GuestStay, StayStatus
from .models.reservation import Reservation, ReservationStatus
from .models.review_entry import ReviewEntry, ReviewPlatform, ReviewLanguage
from .models.inquiry_entry import InquiryEntry, InquiryChannel, InquiryStatus, InquiryPriority

TODAY = date.today()


def _d(delta: int) -> date:
    return TODAY + timedelta(days=delta)


def _pr(n: int, salt: int = 0) -> float:
    x = (n * 9301 + salt * 49297 + 233995) % 233280
    return x / 233280.0


def _pick(n: int, salt: int, items: list):
    return items[int(_pr(n, salt) * len(items)) % len(items)]


def _prange(n: int, salt: int, lo: float, hi: float) -> float:
    return lo + _pr(n, salt) * (hi - lo)


def _seasonal(d: date) -> float:
    m, day = d.month, d.day
    if m == 3 and day >= 20: return 1.18
    if m == 4 and day <= 7: return 1.22
    if m == 4: return 1.12
    if m == 5 and day <= 6: return 1.25
    if m == 5: return 1.08
    if m == 6: return 0.95
    if m in (7, 8): return 1.10
    if m == 9: return 1.05
    if m in (10, 11): return 1.08
    if m == 12 and day >= 20: return 1.20
    if m == 12: return 1.12
    if m == 1 and day <= 4: return 0.90
    if m == 2: return 0.95
    return 1.00


def _dti(d: date) -> int:
    return d.year * 10000 + d.month * 100 + d.day


def _dt(d: date, hour: int = 8) -> datetime.datetime:
    return datetime.datetime.combine(d, datetime.time(hour, 0))


# ─── 競合価格 ──────────────────────────────────────────────────────────────────

async def seed_competitor_prices(session, prop, comp_names: list[str], base_adr: int):
    count = (await session.execute(
        select(func.count()).select_from(CompetitorPrice)
        .where(CompetitorPrice.property_id == prop.id)
    )).scalar() or 0
    if count >= 200:
        print(f"  [comp_prices] {prop.name}: {count}件 — skip")
        return

    await session.execute(delete(CompetitorPrice).where(CompetitorPrice.property_id == prop.id))

    added = 0
    for day_offset in range(-60, 91):
        d = _d(day_offset)
        di = _dti(d)
        sf = _seasonal(d)
        is_wknd = d.weekday() in (4, 5, 6)
        wknd = 1.15 if is_wknd else 1.0
        scraped_d = _d(min(day_offset, 0))

        for ci, name in enumerate(comp_names):
            ni = sum(ord(c) for c in name) + ci * 97
            price_mult = 0.82 + _pr(ni, 0) * 0.36
            noise = 0.93 + _pr(di + ci * 7, 1) * 0.14
            price = round(base_adr * sf * wknd * price_mult * noise / 500) * 500
            avail = max(0, round(_prange(di + ci, 2, 0, 15)))
            plans = max(0, avail - round(_prange(di + ci, 3, 0, 4)))
            session.add(CompetitorPrice(
                property_id=prop.id,
                scraped_at=_dt(scraped_d),
                target_date=d,
                competitor_name=name,
                room_type_label="スタンダード",
                price=price,
                available_rooms=avail,
                plans_available=plans,
            ))
            added += 1

    print(f"  [comp_prices] {prop.name}: {added}件")


# ─── 競合評価 ──────────────────────────────────────────────────────────────────

RATING_SEEDS = {
    "パレスホテル東京":          (4.6, 2340, 4.7, 4.8, 4.5),
    "ザ・ペニンシュラ東京":      (4.7, 3120, 4.8, 4.9, 4.6),
    "コンラッド東京":            (4.5, 1890, 4.6, 4.7, 4.4),
    "マンダリン オリエンタル 東京": (4.6, 2100, 4.7, 4.8, 4.5),
    "シャングリ・ラ 東京":       (4.4, 1650, 4.5, 4.6, 4.3),
    "ホテルモントレ銀座":        (3.9, 890, 4.0, 4.2, 3.8),
    "住友不動産ホテル ヴィラフォンテーヌグランド東京汐留": (4.1, 1230, 4.2, 4.4, 4.0),
    "東急ステイ銀座":            (4.0, 1100, 4.1, 4.3, 3.9),
    "ダイワロイネットホテル銀座　PREMIER": (4.2, 980, 4.3, 4.4, 4.1),
    "クインテッサホテル東京銀座": (4.3, 760, 4.4, 4.5, 4.2),
}


async def seed_competitor_ratings(session, prop, comp_names: list[str]):
    count = (await session.execute(
        select(func.count()).select_from(CompetitorRating)
        .where(CompetitorRating.property_id == prop.id)
    )).scalar() or 0
    if count >= len(comp_names):
        print(f"  [comp_ratings] {prop.name}: {count}件 — skip")
        return

    await session.execute(delete(CompetitorRating).where(CompetitorRating.property_id == prop.id))

    for name in comp_names:
        seed_data = RATING_SEEDS.get(name, (4.0, 600, 4.1, 4.2, 3.9))
        overall, rev_count, svc, loc, room = seed_data
        ni = sum(ord(c) for c in name)
        for source in ("rakuten", "google"):
            noise = _pr(ni + (1 if source == "google" else 2), 5) * 0.2 - 0.1
            session.add(CompetitorRating(
                property_id=prop.id,
                hotel_name=name,
                is_own_property=False,
                source=source,
                overall=round(min(5.0, max(1.0, overall + noise)), 1),
                review_count=rev_count + round(_pr(ni, 6) * 150),
                service_score=round(min(5.0, svc + noise * 0.5), 1),
                location_score=round(min(5.0, loc + noise * 0.3), 1),
                room_score=round(min(5.0, room + noise * 0.5), 1),
                fetched_at=datetime.datetime.now(datetime.timezone.utc),
            ))
    print(f"  [comp_ratings] {prop.name}: {len(comp_names) * 2}件")


# ─── BookingSnapshot ───────────────────────────────────────────────────────────

async def seed_booking_snapshots(session, prop, total_rooms: int, base_occ: float):
    count = (await session.execute(
        select(func.count()).select_from(BookingSnapshot)
        .where(BookingSnapshot.property_id == prop.id)
    )).scalar() or 0
    if count >= 200:
        print(f"  [snapshots] {prop.name}: {count}件 — skip")
        return

    await session.execute(delete(BookingSnapshot).where(BookingSnapshot.property_id == prop.id))

    added = 0
    for cap_offset in range(-14, 1):
        cap = _d(cap_offset)
        cap_i = _dti(cap)
        for tgt_offset in range(cap_offset, cap_offset + 90):
            tgt = _d(tgt_offset)
            if tgt < _d(-30):
                continue
            tgt_i = _dti(tgt)
            days_out = tgt_offset - cap_offset
            pace = min(1.0, 0.35 + (90 - days_out) / 90 * 0.60)
            sf = _seasonal(tgt)
            noise = 0.94 + _pr(tgt_i + cap_i, 7) * 0.12
            booked = round(total_rooms * base_occ * sf * pace * noise)
            booked = max(0, min(total_rooms, booked))
            avg_rate = round(_prange(tgt_i, 8, 12000, 28000) / 1000) * 1000
            session.add(BookingSnapshot(
                property_id=prop.id,
                capture_date=cap,
                target_date=tgt,
                booked_rooms=booked,
                booked_revenue=booked * avg_rate,
            ))
            added += 1

    print(f"  [snapshots] {prop.name}: {added}件")


# ─── コスト設定 ────────────────────────────────────────────────────────────────

COST_CATS = {
    "人件費":           (3200, 2_800_000),
    "光熱費":           (480,  650_000),
    "リネン・アメニティ": (1100, 0),
    "OTA手数料":        (1900, 0),
    "その他":           (280,  180_000),
}


async def seed_cost_settings(session, prop):
    count = (await session.execute(
        select(func.count()).select_from(CostSetting)
        .where(CostSetting.property_id == prop.id)
    )).scalar() or 0
    if count >= 5:
        print(f"  [costs] {prop.name}: {count}件 — skip")
        return
    for cat, (per_room, fixed) in COST_CATS.items():
        session.add(CostSetting(
            property_id=prop.id,
            cost_category=cat,
            amount_per_room_night=per_room,
            fixed_monthly=fixed,
        ))
    print(f"  [costs] {prop.name}: {len(COST_CATS)}件")


# ─── 予算目標 ──────────────────────────────────────────────────────────────────

async def seed_budget_targets(session, prop, total_rooms: int, base_occ: float, base_adr: int):
    count = (await session.execute(
        select(func.count()).select_from(BudgetTarget)
        .where(BudgetTarget.property_id == prop.id)
    )).scalar() or 0
    if count >= 4:
        print(f"  [budgets] {prop.name}: {count}件 — skip")
        return

    import calendar
    added = 0
    for delta_m in range(-3, 3):
        raw = TODAY.month + delta_m
        y = TODAY.year + (raw - 1) // 12
        m = (raw - 1) % 12 + 1
        existing = (await session.execute(
            select(BudgetTarget).where(
                BudgetTarget.property_id == prop.id,
                BudgetTarget.year == y,
                BudgetTarget.month == m,
            )
        )).scalar_one_or_none()
        if existing:
            continue
        days = calendar.monthrange(y, m)[1]
        sf_avg = sum(_seasonal(date(y, m, d)) for d in range(1, days + 1)) / days
        t_occ = round(base_occ * sf_avg * 100, 1)
        t_adr = round(base_adr * sf_avg / 1000) * 1000
        t_revpar = round(t_occ / 100 * t_adr)
        session.add(BudgetTarget(
            property_id=prop.id,
            year=y, month=m,
            target_occupancy=t_occ,
            target_adr=t_adr,
            target_revpar=t_revpar,
            target_revenue=t_revpar * total_rooms * days,
        ))
        added += 1
    print(f"  [budgets] {prop.name}: {added}件")


# ─── レコメンデーション ────────────────────────────────────────────────────────

REASONS = [
    "競合平均が自社より12%高い状況です。需要が高いため価格引き上げを推奨します。",
    "稼働率85%超・残室数が少なくなっています。BAR引き上げのチャンスです。",
    "直近7日の予約ペースが例年比+18%で推移しています。高単価への切り替えを推奨します。",
    "競合の平均価格が自社より8%低く設定されています。価格競争力維持のため下調整を検討してください。",
    "同週の昨年実績と比較して稼働率が低下しています。需要喚起のため価格調整を推奨します。",
    "祝前日のため需要上昇が見込まれます。BAR1段階の引き上げを推奨します。",
    "イベント期間中のため価格水準を高く維持することを推奨します。",
    "稼働率が60%を下回る見込みです。需要喚起のため割引設定を推奨します。",
]

BARS = ["A", "B", "C", "D", "E"]
BAR_P_RPH    = {"A": 15000, "B": 13000, "C": 11000, "D": 9000, "E": 7000}
BAR_P_CANVAS = {"A": 22000, "B": 18000, "C": 14000, "D": 11000, "E": 8500}


async def seed_recommendations(session, prop, room_types: list):
    count = (await session.execute(
        select(func.count()).select_from(Recommendation)
        .where(Recommendation.property_id == prop.id)
    )).scalar() or 0
    if count >= 20:
        print(f"  [recs] {prop.name}: {count}件 — skip")
        return

    is_canvas = "Canvas" in prop.name
    bar_p = BAR_P_CANVAS if is_canvas else BAR_P_RPH
    rt = room_types[0] if room_types else None
    if not rt:
        return

    added = 0
    for day_offset in range(-60, 15):
        if day_offset % 2 != 0:
            continue
        d = _d(day_offset)
        di = _dti(d)
        cur_idx = int(_pr(di, 10) * 5) % 5
        cur_lvl = BARS[cur_idx]
        direction = 1 if _pr(di, 11) > 0.38 else -1
        rec_idx = max(0, min(4, cur_idx - direction))
        rec_lvl = BARS[rec_idx]
        if cur_lvl == rec_lvl:
            continue
        if day_offset < -7:
            status = "approved" if _pr(di, 12) > 0.2 else "rejected"
        elif day_offset < 0:
            status = "auto_approved"
        else:
            status = "pending"
        session.add(Recommendation(
            property_id=prop.id,
            room_type_id=rt.id,
            target_date=d,
            current_bar_level=cur_lvl,
            recommended_bar_level=rec_lvl,
            current_price=bar_p.get(cur_lvl, 11000),
            recommended_price=bar_p.get(rec_lvl, 11000),
            delta_levels=cur_idx - rec_idx,
            reason=_pick(di, 13, REASONS),
            status=status,
            generated_at=_dt(_d(day_offset - 1), 6),
        ))
        added += 1
    print(f"  [recs] {prop.name}: {added}件")


# ─── GuestStay ─────────────────────────────────────────────────────────────────

GUEST_ALL = [
    ("田中 太郎", "タナカ タロウ", "JP"), ("山田 花子", "ヤマダ ハナコ", "JP"),
    ("鈴木 一郎", "スズキ イチロウ", "JP"), ("佐藤 美咲", "サトウ ミサキ", "JP"),
    ("伊藤 健二", "イトウ ケンジ", "JP"), ("高橋 由美", "タカハシ ユミ", "JP"),
    ("渡辺 拓也", "ワタナベ タクヤ", "JP"), ("小林 奈々", "コバヤシ ナナ", "JP"),
    ("中村 智也", "ナカムラ トモヤ", "JP"), ("加藤 誠", "カトウ マコト", "JP"),
    ("吉田 さくら", "ヨシダ サクラ", "JP"), ("松本 雄一", "マツモト ユウイチ", "JP"),
    ("John Smith", None, "US"), ("Marie Dupont", None, "FR"),
    ("Wang Wei", None, "CN"), ("Park Ji-yeon", None, "KR"),
    ("Hans Mueller", None, "DE"), ("Sarah Johnson", None, "AU"),
    ("Li Fang", None, "CN"), ("Kim Min-jun", None, "KR"),
    ("Ahmed Hassan", None, "AE"), ("Emily Wilson", None, "US"),
]

ROOM_T = ["スタンダードダブル", "スーペリアツイン", "デラックスキング", "コーナースイート", "プレミアムツイン"]
PLANS  = ["スタンダードプラン（素泊まり）", "朝食付きプラン", "連泊特別プラン", "記念日プラン", "ビジネスプラン"]
OTA_F  = ["楽天トラベル", "Expedia", "Booking.com", "自社サイト", "じゃらん"]
SREQS  = [
    "アレルギー（そば）あり", "バースデーケーキ希望", "ベビーベッド希望",
    "高層階リクエスト", "早朝チェックアウト希望",
    "Chinese breakfast preferred", "Quiet room requested",
    None, None, None, None, None, None,
]


async def seed_guest_stays_full(session, prop):
    count = (await session.execute(
        select(func.count()).select_from(GuestStay)
        .where(GuestStay.property_id == prop.id)
    )).scalar() or 0
    if count >= 60:
        print(f"  [stays] {prop.name}: {count}件 — skip")
        return

    await session.execute(delete(GuestStay).where(GuestStay.property_id == prop.id))

    recs = []
    res_base = prop.id * 10000

    # 過去60日: 全てチェックアウト済み
    for day_offset in range(-60, 0):
        d = _d(day_offset)
        di = _dti(d)
        sf = _seasonal(d)
        cnt = max(1, round(_prange(di, 0, 2, 6) * sf * (1.2 if d.weekday() >= 4 else 1.0)))
        for j in range(cnt):
            s = di * 100 + j
            name, kana, nat = _pick(s, 1, GUEST_ALL)
            nights = max(1, round(_prange(s, 2, 1, 4)))
            fl = max(1, round(_prange(s, 3, 1, 15)))
            rm = f"{fl:02d}{max(1, round(_prange(s, 4, 1, 30))):02d}"
            rn = res_base + len(recs) + 1
            recs.append(GuestStay(
                property_id=prop.id,
                reservation_no=f"GS-{rn:06d}",
                ota_channel=_pick(s, 5, OTA_F),
                guest_name=name, guest_name_kana=kana,
                guest_email=f"g{rn}@example.com",
                guest_count=max(1, round(_prange(s, 6, 1, 3))),
                nationality=nat,
                room_number=rm, room_type=_pick(s, 7, ROOM_T), floor=fl,
                checkin_date=d, checkout_date=d + timedelta(days=nights), nights=nights,
                status=StayStatus.checked_out,
                checkin_time=datetime.time(14 + round(_prange(s, 8, 0, 4)), 0),
                checkout_time=datetime.time(10 + round(_prange(s, 9, 0, 2)), 0),
                plan_name=_pick(s, 10, PLANS),
                special_requests=_pick(s, 11, SREQS),
                is_repeat=_pr(s, 12) > 0.72,
            ))

    # 今日: チェックアウト組 + チェックイン組
    di_today = _dti(TODAY)
    for j in range(14):
        s = di_today * 100 + j + 500
        name, kana, nat = _pick(s, 1, GUEST_ALL)
        fl = max(1, round(_prange(s, 3, 1, 12)))
        rm = f"{fl:02d}{max(1, round(_prange(s, 4, 1, 25))):02d}"
        rn = res_base + len(recs) + 1
        if j < 5:  # チェックアウト
            recs.append(GuestStay(
                property_id=prop.id,
                reservation_no=f"GS-{rn:06d}",
                ota_channel=_pick(s, 5, OTA_F),
                guest_name=name, guest_name_kana=kana,
                guest_email=f"g{rn}@example.com",
                guest_count=max(1, round(_prange(s, 6, 1, 3))),
                nationality=nat,
                room_number=rm, room_type=_pick(s, 7, ROOM_T), floor=fl,
                checkin_date=_d(-1), checkout_date=TODAY, nights=1,
                status=StayStatus.checked_out if _pr(s, 13) > 0.3 else StayStatus.checked_in,
                checkin_time=datetime.time(15, 0),
                checkout_time=datetime.time(11, 0) if _pr(s, 13) > 0.3 else None,
                plan_name=_pick(s, 10, PLANS),
                special_requests=_pick(s, 11, SREQS),
                is_repeat=_pr(s, 12) > 0.65,
            ))
        else:  # チェックイン
            nights = max(1, round(_prange(s, 2, 1, 3)))
            status = StayStatus.checked_in if _pr(s, 14) > 0.4 else StayStatus.expected
            recs.append(GuestStay(
                property_id=prop.id,
                reservation_no=f"GS-{rn:06d}",
                ota_channel=_pick(s, 5, OTA_F),
                guest_name=name, guest_name_kana=kana,
                guest_email=f"g{rn}@example.com",
                guest_count=max(1, round(_prange(s, 6, 1, 3))),
                nationality=nat,
                room_number=rm if status == StayStatus.checked_in else None,
                room_type=_pick(s, 7, ROOM_T), floor=fl if status == StayStatus.checked_in else None,
                checkin_date=TODAY, checkout_date=_d(nights), nights=nights,
                status=status,
                checkin_time=datetime.time(14, 30) if status == StayStatus.checked_in else None,
                plan_name=_pick(s, 10, PLANS),
                special_requests=_pick(s, 11, SREQS),
                is_repeat=_pr(s, 12) > 0.72,
            ))

    # 今後14日: チェックイン予定
    for day_offset in range(1, 15):
        d = _d(day_offset)
        di = _dti(d)
        cnt = max(1, round(_prange(di, 0, 3, 8)))
        for j in range(cnt):
            s = di * 100 + j + 200
            name, kana, nat = _pick(s, 1, GUEST_ALL)
            nights = max(1, round(_prange(s, 2, 1, 4)))
            rn = res_base + len(recs) + 1
            recs.append(GuestStay(
                property_id=prop.id,
                reservation_no=f"GS-{rn:06d}",
                ota_channel=_pick(s, 5, OTA_F),
                guest_name=name, guest_name_kana=kana,
                guest_email=f"g{rn}@example.com",
                guest_count=max(1, round(_prange(s, 6, 1, 3))),
                nationality=nat,
                room_number=None, room_type=_pick(s, 7, ROOM_T), floor=None,
                checkin_date=d, checkout_date=d + timedelta(days=nights), nights=nights,
                status=StayStatus.expected,
                plan_name=_pick(s, 10, PLANS),
                special_requests=_pick(s, 11, SREQS),
                is_repeat=_pr(s, 12) > 0.75,
            ))

    for r in recs:
        session.add(r)
    print(f"  [stays] {prop.name}: {len(recs)}件")


# ─── Reservation ───────────────────────────────────────────────────────────────

OTA_RES = [
    "楽天トラベル", "楽天トラベル", "楽天トラベル",
    "Expedia", "Expedia",
    "Booking.com", "Booking.com",
    "自社サイト", "自社サイト",
    "じゃらん", "一休.com", "直電",
]
GUESTS_RES = [
    ("田中 太郎", "JP"), ("山田 花子", "JP"), ("鈴木 美咲", "JP"),
    ("佐藤 健二", "JP"), ("伊藤 由美", "JP"), ("高橋 拓也", "JP"),
    ("渡辺 奈々", "JP"), ("小林 智也", "JP"), ("中村 誠", "JP"),
    ("加藤 花子", "JP"), ("吉田 一郎", "JP"), ("松本 美紀", "JP"),
    ("John Smith", "US"), ("Marie Dupont", "FR"), ("Wang Wei", "CN"),
    ("Park Ji-yeon", "KR"), ("Hans Mueller", "DE"), ("Sarah Johnson", "AU"),
    ("Li Fang", "CN"), ("Kim Min-jun", "KR"),
]
AMOUNTS_RES = [8000, 10000, 12000, 15000, 18000, 22000, 28000, 35000, 45000]


async def seed_reservations_full(session, prop):
    count = (await session.execute(
        select(func.count()).select_from(Reservation)
        .where(Reservation.property_id == prop.id)
    )).scalar() or 0
    if count >= 120:
        print(f"  [reservations] {prop.name}: {count}件 — skip")
        return

    await session.execute(delete(Reservation).where(Reservation.property_id == prop.id))

    recs = []
    for i in range(250):
        s = prop.id * 100000 + i
        ci_off = round(_prange(s, 0, -90, 91))
        ci = _d(ci_off)
        nights = max(1, round(_prange(s, 1, 1, 6)))
        co = ci + timedelta(days=nights)
        lead = max(1, round(_prange(s, 2, 1, 90)))
        bk = ci - timedelta(days=lead)
        name, nat = _pick(s, 3, GUESTS_RES)
        channel = _pick(s, 4, OTA_RES)
        amt_pp = _pick(s, 5, AMOUNTS_RES)

        if ci < TODAY:
            r = _pr(s, 6)
            if r < 0.07:
                status = ReservationStatus.cancelled
            elif r < 0.10:
                status = ReservationStatus.no_show
            else:
                status = ReservationStatus.confirmed
        else:
            status = ReservationStatus.cancelled if _pr(s, 7) < 0.05 else ReservationStatus.confirmed

        recs.append(Reservation(
            property_id=prop.id,
            reservation_no=f"RES-{prop.id}-{i:04d}",
            ota_channel=channel,
            booking_date=bk,
            guest_name=name, guest_name_kana=None,
            guest_email=f"res{prop.id}_{i}@example.com",
            guest_count=max(1, round(_prange(s, 8, 1, 4))),
            nationality=nat,
            checkin_date=ci, checkout_date=co, nights=nights,
            room_type=_pick(s, 9, ROOM_T),
            plan_name=_pick(s, 10, PLANS),
            total_amount=float(amt_pp * nights),
            currency="JPY",
            status=status,
            is_group=_pr(s, 11) > 0.95,
        ))

    for r in recs:
        session.add(r)
    print(f"  [reservations] {prop.name}: {len(recs)}件")


# ─── ReviewEntry / InquiryEntry ────────────────────────────────────────────────

REVIEWS = [
    ("ja", "google",  5.0, "田中　恵",     "スタッフの皆さんがとても親切で、チェックインからチェックアウトまで快適に過ごせました。部屋も清潔で、眺めが素晴らしかったです。また訪れたいと思います。", "田中様、素晴らしいご評価をありがとうございます。またのご来館を心よりお待ちしております。"),
    ("ja", "rakuten", 5.0, "佐藤　美幸",   "記念日に利用させていただきました。スタッフの方がサプライズを用意してくださり、感動しました！部屋も広く、アメニティも充実していました。", "佐藤様、記念日にご利用いただきありがとうございます。またのご来館をお待ちしております。"),
    ("ja", "google",  4.0, "山本　隆",     "立地が最高で、交通アクセスが便利でした。朝食のビュッフェが充実していて満足しています。ただ、部屋がやや狭く感じました。", None),
    ("en", "expedia", 5.0, "Sarah Chen",   "Absolutely wonderful stay! The concierge helped us plan our entire Tokyo itinerary. Room had a stunning view. Will definitely be back.", None),
    ("en", "booking", 4.0, "John Miller",  "Excellent location near the train station. Staff was very friendly. The room was a bit small but clean and well-maintained. Breakfast had great variety.", None),
    ("ja", "rakuten", 2.0, "鈴木　一郎",   "チェックイン時の待ち時間が長く、案内も不十分でした。部屋の清掃が行き届いておらず、浴室に汚れが残っていました。改善を望みます。", "鈴木様、ご不便をおかけして誠に申し訳ございません。清掃体制の強化に努めてまいります。"),
    ("zh", "google",  4.0, "陈小燕",       "酒店整体感觉不错，地理位置优越。前台服务很周到，能说简单中文。房间干净整洁，设施齐全。早餐种类丰富，性价比高。", None),
    ("zh", "booking", 3.0, "李 明",        "位置很好，靠近地铁站，交通方便。但是房间比较小，隔音效果不太好。早餐选择不多。服务人员态度友善。", None),
    ("ko", "expedia", 4.0, "김민준",       "위치가 매우 좋고 직원들이 친절했습니다. 객실은 깨끗하고 편안했습니다. 아침 식사 메뉴가 더 다양하면 좋겠습니다.", None),
    ("de", "booking", 4.0, "Thomas Weber", "Gutes Hotel in zentraler Lage. Das Personal war freundlich und hilfsbereit. Das Frühstücksbuffet war reichhaltig. Das Zimmer war sauber, aber etwas klein.", None),
    ("ja", "google",  5.0, "伊藤　朋子",   "温泉とサウナが最高でした。夕食のコース料理も美味しく、全体的に大満足です。スタッフの気配りが随所に感じられました。", None),
    ("ja", "rakuten", 4.0, "中村　健太",   "ビジネス出張で利用。Wi-Fiが安定していて、デスクスペースも十分ありました。朝食付きプランが便利でした。次回もリピートします。", None),
    ("en", "google",  5.0, "Emma Johnson", "One of the best hotels in Tokyo. Immaculate rooms, exceptional service, and the breakfast buffet was outstanding.", "Thank you, Emma! Your kind words mean a lot. We look forward to welcoming you back soon."),
    ("ja", "booking", 3.0, "池田　亮",     "立地は良いですが、部屋がやや古い印象でした。スタッフは丁寧でした。価格を考えると普通レベルです。", None),
    ("zh", "rakuten", 5.0, "刘 芳",        "非常棒的住宿体验！工作人员非常友善，入住手续简单快捷。房间宽敞整洁，设施齐全。强烈推荐！", None),
    ("en", "expedia", 4.0, "Michael Brown","Great hotel overall. The service was excellent. Only minor complaint was the gym could be larger. Would stay again.", None),
    ("ja", "google",  4.0, "高橋　由美",   "家族旅行で利用しました。子どもへのサービスが充実していて、子連れでも快適に過ごせました。大浴場も良かったです。", None),
    ("ko", "booking", 5.0, "이지연",       "도쿄 중심부에 위치한 좋은 호텔입니다. 직원들의 서비스가 훌륭했고, 객실도 깔끔했습니다. 다음에 도쿄 방문 시 다시 이용하겠습니다.", None),
    ("de", "google",  5.0, "Anna Schmidt", "Ausgezeichnetes Hotel! Sehr freundliches Personal, saubere Zimmer und hervorragendes Frühstück. Die Lage ist perfekt.", None),
    ("ja", "expedia", 2.0, "山口　花子",   "隣室の騒音が気になり、ゆっくり休めませんでした。防音対策の改善を望みます。", "山口様、ご不便をおかけして申し訳ございません。防音改善を引き続き検討してまいります。"),
    ("en", "booking", 5.0, "Jessica Lee",  "Perfect location, friendly staff, and incredibly clean rooms. The restaurant on-site was also excellent. Highly recommend!", None),
    ("ja", "google",  5.0, "清水　大輔",   "出張で定期的に利用しています。いつも清潔で快適で、スタッフの対応が良く、安心して過ごせます。", None),
    ("zh", "expedia", 4.0, "王 建国",      "酒店位置优越，周边交通便利。工作人员态度好，帮我们推荐了附近的餐厅。早餐丰富，总体满意。", None),
    ("ja", "rakuten", 5.0, "吉田　さくら", "夜景が最高で、彼と二人で素敵な時間を過ごしました。コンシェルジュのレストランの案内も的確でした。", "吉田様、素敵なお時間を過ごしていただけて嬉しいです。またのご来館をお待ちしております。"),
    ("en", "google",  3.0, "Maria Garcia", "The hotel is in a good location but the rooms need renovation. The staff was helpful. The breakfast was disappointing.", None),
    ("ko", "rakuten", 4.0, "박서준",       "훌륭한 숙박 경험이었습니다! 체크인부터 체크아웃까지 모든 것이 완벽했습니다. 조식 뷔페도 다양하고 맛있었습니다.", None),
    ("ja", "booking", 4.0, "橋本　涼",     "全体的に満足しています。部屋も清潔で、スタッフの対応も良かったです。ただ、朝食の混雑が少し気になりました。", None),
    ("en", "rakuten", 5.0, "David Wilson", "Exceptional hotel. The attention to detail was impressive, from the room setup to the dining experience. Worth every penny.", None),
    ("ja", "google",  4.0, "木村　浩二",   "立地が便利で、周辺の飲食店も多く選択肢が豊富でした。部屋は清潔で、施設全体の管理が行き届いています。", None),
    ("ja", "expedia", 5.0, "岡田　修",     "コンシェルジュのサービスが一流でした。チェックアウトもスムーズで、次回の予約もここにしようと思います。", None),
]

PLT = {"google": ReviewPlatform.google, "rakuten": ReviewPlatform.rakuten,
       "expedia": ReviewPlatform.expedia, "booking": ReviewPlatform.booking}
LNG = {"ja": ReviewLanguage.ja, "en": ReviewLanguage.en, "zh": ReviewLanguage.zh,
       "ko": ReviewLanguage.ko, "de": ReviewLanguage.de}

INQUIRIES = [
    dict(channel=InquiryChannel.email, customer_name="田中　浩二", customer_email="koji.tanaka@example.com",
         subject="チェックイン時間の変更について", language="ja",
         status=InquiryStatus.new, priority=InquiryPriority.medium,
         tags=json.dumps(["チェックイン", "時間変更"]),
         content="お世話になっております。当日の会議が長引く可能性があり、18時頃にチェックインになってしまう可能性があります。問題なくチェックインできますでしょうか？"),
    dict(channel=InquiryChannel.form, customer_name="山田　花子", customer_email="hanako.yamada@example.jp",
         subject="記念日プランについてのご相談", language="ja",
         status=InquiryStatus.in_progress, priority=InquiryPriority.high,
         assignee="佐藤（フロント）", tags=json.dumps(["記念日", "特別アレンジ"]),
         content="来月の結婚記念日に夫婦で宿泊を予定しています。ケーキの手配やフラワーデコレーションをお願いすることはできますか？"),
    dict(channel=InquiryChannel.email, customer_name="James Wilson", customer_email="j.wilson@company.com",
         subject="Corporate account inquiry", language="en",
         status=InquiryStatus.new, priority=InquiryPriority.high,
         tags=json.dumps(["法人", "コーポレート"]),
         content="Hello, I am the travel manager for Wilson & Associates. We frequently travel to Tokyo and are looking for a preferred hotel partner. Could you provide information about corporate rates?"),
    dict(channel=InquiryChannel.phone, customer_name="鈴木　太郎", customer_phone="090-1234-5678",
         subject="お荷物の預かりについて", language="ja",
         status=InquiryStatus.resolved, priority=InquiryPriority.low,
         tags=json.dumps(["手荷物", "預かり"]),
         response="チェックイン前後のお荷物お預かりは無料でご対応しております。フロントにてお申し付けください。",
         content="チェックアウト後も荷物を預かっていただけますか？観光して夕方の新幹線で帰る予定です。"),
    dict(channel=InquiryChannel.email, customer_name="佐々木　理恵", customer_email="rie.sasaki@mail.com",
         subject="駐車場のご案内について", language="ja",
         status=InquiryStatus.new, priority=InquiryPriority.low,
         tags=json.dumps(["駐車場"]),
         content="来週末に宿泊を予定しています。お車で伺う予定なのですが、ホテルに駐車場はございますか？料金と収容台数を教えていただけますか？"),
    dict(channel=InquiryChannel.form, customer_name="高橋　由美子", customer_email="yumi@example.com",
         subject="バリアフリー設備について", language="ja",
         status=InquiryStatus.in_progress, priority=InquiryPriority.high,
         assignee="客室担当", tags=json.dumps(["バリアフリー", "設備"]),
         content="車椅子を使用している母を連れて宿泊予定です。バリアフリー対応のお部屋はございますか？施設内の移動で気をつける点があれば教えてください。"),
    dict(channel=InquiryChannel.email, customer_name="Chen Wei", customer_email="chen@example.com",
         subject="Airport transfer inquiry", language="en",
         status=InquiryStatus.resolved, priority=InquiryPriority.medium,
         tags=json.dumps(["交通", "空港"]),
         response="We offer airport shuttle service from both Narita and Haneda. Please contact us 48 hours in advance.",
         content="Do you provide airport transfer service from Narita or Haneda airports? What is the cost per trip?"),
    dict(channel=InquiryChannel.phone, customer_name="伊藤　一郎", customer_phone="080-9876-5432",
         subject="ペット同伴可否について", language="ja",
         status=InquiryStatus.closed, priority=InquiryPriority.low,
         tags=json.dumps(["ペット"]),
         response="誠に申し訳ございませんが、当ホテルはペット同伴のご宿泊はお受けしておりません。",
         content="小型犬を連れて宿泊することは可能ですか？"),
    dict(channel=InquiryChannel.form, customer_name="渡辺　美咲", customer_email="misaki@example.com",
         subject="グループ予約の割引について", language="ja",
         status=InquiryStatus.new, priority=InquiryPriority.high,
         tags=json.dumps(["グループ", "割引"]),
         content="20名程度のグループで宿泊を検討しています。グループ割引や専用フロアの用意はありますか？来月の研修旅行で使用予定です。"),
    dict(channel=InquiryChannel.email, customer_name="김 영수", customer_email="kim@example.kr",
         subject="한국어 서비스 문의", language="ko",
         status=InquiryStatus.new, priority=InquiryPriority.medium,
         tags=json.dumps(["韓国語", "多言語"]),
         content="한국어를 할 수 있는 직원이 있나요? 체크인 시 한국어로 안내를 받을 수 있는지 궁금합니다."),
]


async def seed_reviews_full(session, prop):
    r_count = (await session.execute(
        select(func.count()).select_from(ReviewEntry)
        .where(ReviewEntry.property_id == prop.id)
    )).scalar() or 0

    if r_count >= 20:
        print(f"  [reviews] {prop.name}: {r_count}件 — skip")
    else:
        await session.execute(delete(ReviewEntry).where(ReviewEntry.property_id == prop.id))
        base = TODAY - timedelta(days=90)
        step = 90 / max(len(REVIEWS), 1)
        for i, (lang, plt, rating, author, text, resp) in enumerate(REVIEWS):
            rd = base + timedelta(days=round(step * i))
            responded = resp is not None
            session.add(ReviewEntry(
                property_id=prop.id,
                platform=PLT[plt], author=author, rating=rating, text=text,
                review_date=rd, language=LNG[lang],
                responded=responded, response=resp,
                responded_at=rd + timedelta(days=1) if responded else None,
            ))
        print(f"  [reviews] {prop.name}: {len(REVIEWS)}件")

    q_count = (await session.execute(
        select(func.count()).select_from(InquiryEntry)
        .where(InquiryEntry.property_id == prop.id)
    )).scalar() or 0

    if q_count >= 8:
        print(f"  [inquiries] {prop.name}: {q_count}件 — skip")
    else:
        await session.execute(delete(InquiryEntry).where(InquiryEntry.property_id == prop.id))
        base = TODAY - timedelta(days=30)
        for i, q in enumerate(INQUIRIES):
            session.add(InquiryEntry(
                property_id=prop.id,
                inquiry_date=base + timedelta(days=i * 3),
                **q,
            ))
        print(f"  [inquiries] {prop.name}: {len(INQUIRIES)}件")


# ─── メイン ────────────────────────────────────────────────────────────────────

async def run_comprehensive_seed():
    await init_db()
    async with AsyncSessionLocal() as session:
        props = (await session.execute(select(Property))).scalars().all()
        if not props:
            print("❌ プロパティが見つかりません。先に seed_runner.py を実行してください。")
            return

        for prop in props:
            print(f"\n=== {prop.name} (id={prop.id}) ===")
            is_canvas = "Canvas" in prop.name
            base_adr = 21000 if is_canvas else 15500
            total_rooms = prop.total_rooms or (134 if is_canvas else 413)
            base_occ = 0.82 if is_canvas else 0.77

            comp_names = [c.name for c in (
                await session.execute(
                    select(CompSet)
                    .where(CompSet.property_id == prop.id, CompSet.is_active == True)
                    .order_by(CompSet.sort_order)
                )
            ).scalars().all()]

            room_types = (await session.execute(
                select(RoomType)
                .where(RoomType.property_id == prop.id)
                .order_by(RoomType.sort_order)
            )).scalars().all()

            await seed_competitor_prices(session, prop, comp_names, base_adr)
            await seed_competitor_ratings(session, prop, comp_names)
            await seed_booking_snapshots(session, prop, total_rooms, base_occ)
            await seed_cost_settings(session, prop)
            await seed_budget_targets(session, prop, total_rooms, base_occ, base_adr)
            await seed_recommendations(session, prop, list(room_types))
            await seed_guest_stays_full(session, prop)
            await seed_reservations_full(session, prop)
            await seed_reviews_full(session, prop)

            await session.commit()
            print(f"  ✓ {prop.name} 完了")

    print("\n✅ 包括的シード完了")


if __name__ == "__main__":
    asyncio.run(run_comprehensive_seed())
