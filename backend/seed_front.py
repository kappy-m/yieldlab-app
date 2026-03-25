"""Front プロダクト用シードデータ（guest_stays テーブル）"""
from __future__ import annotations

import asyncio
import datetime
import random

from sqlalchemy import select
from .database import AsyncSessionLocal
from .models.property import Property
from .models.guest_stay import GuestStay, StayStatus

TODAY = datetime.date.today()
TOMORROW = TODAY + datetime.timedelta(days=1)
YESTERDAY = TODAY - datetime.timedelta(days=1)


def _date(delta: int) -> datetime.date:
    return TODAY + datetime.timedelta(days=delta)


OTA_CHANNELS = ["楽天トラベル", "Expedia", "Booking.com", "自社サイト", "じゃらん"]
ROOM_TYPES = ["スタンダードダブル", "スーペリアツイン", "デラックスキング", "コーナースイート", "プレミアムツイン"]
PLAN_NAMES = ["スタンダードプラン（素泊まり）", "朝食付きプラン", "連泊特別プラン", "記念日プラン", "ビジネスプラン"]

GUEST_DATA = [
    # 今日チェックイン予定
    dict(reservation_no="RES-2026-001", ota_channel="楽天トラベル",
         guest_name="田中 太郎", guest_name_kana="タナカ タロウ",
         guest_email="tanaka@example.com", guest_phone="090-1234-5678",
         guest_count=2, nationality="JP", room_number="301", room_type="スーペリアツイン", floor=3,
         checkin_date=TODAY, checkout_date=_date(2), nights=2,
         status=StayStatus.expected, plan_name="朝食付きプラン",
         special_requests="アレルギー（そば）あり", is_repeat=True),
    dict(reservation_no="RES-2026-002", ota_channel="Expedia",
         guest_name="John Smith", guest_name_kana=None,
         guest_email="john@example.com", guest_phone=None,
         guest_count=1, nationality="US", room_number="512", room_type="デラックスキング", floor=5,
         checkin_date=TODAY, checkout_date=_date(3), nights=3,
         status=StayStatus.expected, plan_name="スタンダードプラン（素泊まり）",
         special_requests="High floor room requested", is_repeat=False),
    dict(reservation_no="RES-2026-003", ota_channel="自社サイト",
         guest_name="鈴木 花子", guest_name_kana="スズキ ハナコ",
         guest_email="suzuki@example.com", guest_phone="080-9876-5432",
         guest_count=2, nationality="JP", room_number=None, room_type="コーナースイート", floor=8,
         checkin_date=TODAY, checkout_date=_date(1), nights=1,
         status=StayStatus.checked_in, checkin_time=datetime.time(14, 30),
         plan_name="記念日プラン", special_requests="バースデーケーキ要望", is_repeat=False),
    # 今日チェックアウト予定（昨日〜今日）
    dict(reservation_no="RES-2026-004", ota_channel="じゃらん",
         guest_name="山田 健二", guest_name_kana="ヤマダ ケンジ",
         guest_email=None, guest_phone="070-1111-2222",
         guest_count=1, nationality="JP", room_number="205", room_type="スタンダードダブル", floor=2,
         checkin_date=YESTERDAY, checkout_date=TODAY, nights=1,
         status=StayStatus.checked_in, checkin_time=datetime.time(15, 0),
         plan_name="ビジネスプラン", special_requests=None, is_repeat=True),
    dict(reservation_no="RES-2026-005", ota_channel="Booking.com",
         guest_name="Marie Dupont", guest_name_kana=None,
         guest_email="marie@example.com", guest_phone=None,
         guest_count=2, nationality="FR", room_number="417", room_type="プレミアムツイン", floor=4,
         checkin_date=YESTERDAY, checkout_date=TODAY, nights=1,
         status=StayStatus.checked_out, checkin_time=datetime.time(16, 0), checkout_time=datetime.time(9, 45),
         plan_name="スタンダードプラン（素泊まり）", special_requests=None, is_repeat=False),
    # 在泊中（複数泊）
    dict(reservation_no="RES-2026-006", ota_channel="楽天トラベル",
         guest_name="佐藤 美咲", guest_name_kana="サトウ ミサキ",
         guest_email="sato@example.com", guest_phone="090-3333-4444",
         guest_count=3, nationality="JP", room_number="620", room_type="スーペリアツイン", floor=6,
         checkin_date=_date(-2), checkout_date=_date(1), nights=3,
         status=StayStatus.checked_in, checkin_time=datetime.time(14, 15),
         plan_name="朝食付きプラン", special_requests="ベビーベッド希望", is_repeat=False),
    dict(reservation_no="RES-2026-007", ota_channel="自社サイト",
         guest_name="Hiroshi Nakamura", guest_name_kana="ナカムラ ヒロシ",
         guest_email="nakamura@example.com", guest_phone="080-5555-6666",
         guest_count=1, nationality="JP", room_number="710", room_type="デラックスキング", floor=7,
         checkin_date=_date(-1), checkout_date=_date(2), nights=3,
         status=StayStatus.checked_in, checkin_time=datetime.time(18, 30),
         plan_name="ビジネスプラン", special_requests="早朝チェックアウト希望", is_repeat=True),
    # 明日以降チェックイン予定
    dict(reservation_no="RES-2026-008", ota_channel="Expedia",
         guest_name="Wang Wei", guest_name_kana=None,
         guest_email="wang@example.com", guest_phone=None,
         guest_count=2, nationality="CN", room_number=None, room_type="コーナースイート", floor=None,
         checkin_date=TOMORROW, checkout_date=_date(4), nights=3,
         status=StayStatus.expected, plan_name="朝食付きプラン",
         special_requests="Chinese breakfast preferred", is_repeat=False),
    dict(reservation_no="RES-2026-009", ota_channel="じゃらん",
         guest_name="伊藤 雅之", guest_name_kana="イトウ マサユキ",
         guest_email="ito@example.com", guest_phone="090-7777-8888",
         guest_count=2, nationality="JP", room_number=None, room_type="プレミアムツイン", floor=None,
         checkin_date=TOMORROW, checkout_date=_date(3), nights=2,
         status=StayStatus.expected, plan_name="連泊特別プラン",
         special_requests=None, is_repeat=True),
    # ノーショー
    dict(reservation_no="RES-2026-010", ota_channel="Booking.com",
         guest_name="Anonymous Guest", guest_name_kana=None,
         guest_email=None, guest_phone=None,
         guest_count=1, nationality=None, room_number="101", room_type="スタンダードダブル", floor=1,
         checkin_date=YESTERDAY, checkout_date=TODAY, nights=1,
         status=StayStatus.no_show, plan_name="スタンダードプラン（素泊まり）",
         special_requests=None, is_repeat=False),
]


async def seed_front() -> None:
    async with AsyncSessionLocal() as session:
        # 既存データ確認
        count_result = await session.execute(select(GuestStay))
        existing = count_result.scalars().all()
        if existing:
            print(f"[seed_front] already has {len(existing)} guest_stay records — skipping")
            return

        # Property取得
        prop_result = await session.execute(select(Property).limit(1))
        prop = prop_result.scalar_one_or_none()
        if not prop:
            print("[seed_front] No property found — aborting")
            return

        for data in GUEST_DATA:
            stay = GuestStay(property_id=prop.id, **data)
            session.add(stay)

        await session.commit()
        print(f"[seed_front] Inserted {len(GUEST_DATA)} guest stays for property {prop.id}")


if __name__ == "__main__":
    asyncio.run(seed_front())
