"""Reservation プロダクト用シードデータ"""
from __future__ import annotations

import asyncio
import datetime
import random

from sqlalchemy import select
from .database import AsyncSessionLocal
from .models.property import Property
from .models.reservation import Reservation, ReservationStatus

TODAY = datetime.date.today()

def _date(delta: int) -> datetime.date:
    return TODAY + datetime.timedelta(days=delta)

OTA_CHANNELS = ["楽天トラベル", "Expedia", "Booking.com", "自社サイト", "じゃらん", "一休.com", "直電"]
ROOM_TYPES = ["スタンダードダブル", "スーペリアツイン", "デラックスキング", "コーナースイート", "プレミアムツイン"]
PLAN_NAMES = ["スタンダードプラン（素泊まり）", "朝食付きプラン", "連泊特別プラン", "記念日プラン", "ビジネスプラン"]

GUEST_NAMES = [
    ("田中 太郎", "JP"), ("山田 花子", "JP"), ("鈴木 一郎", "JP"),
    ("佐藤 美咲", "JP"), ("伊藤 健二", "JP"), ("高橋 美紀", "JP"),
    ("渡辺 拓也", "JP"), ("小林 奈々", "JP"), ("中村 智也", "JP"),
    ("John Smith", "US"), ("Marie Dupont", "FR"), ("Wang Wei", "CN"),
    ("Park Ji-yeon", "KR"), ("Hans Mueller", "DE"), ("Sarah Johnson", "AU"),
]

def generate_reservations(count: int = 60) -> list[dict]:
    rsvs = []
    for i in range(count):
        ci = _date(random.randint(-30, 60))
        nights = random.randint(1, 5)
        co = ci + datetime.timedelta(days=nights)
        name, nat = random.choice(GUEST_NAMES)
        channel = random.choice(OTA_CHANNELS)
        status = ReservationStatus.confirmed
        if ci < TODAY and random.random() < 0.1:
            status = ReservationStatus.cancelled if random.random() < 0.7 else ReservationStatus.no_show
        amount = random.choice([8000, 10000, 12000, 15000, 18000, 22000, 28000, 35000]) * nights
        rsvs.append(dict(
            reservation_no=f"RES-2026-{100+i:04d}",
            ota_channel=channel,
            booking_date=ci - datetime.timedelta(days=random.randint(1, 60)),
            guest_name=name,
            guest_name_kana=None,
            guest_email=f"guest{i}@example.com",
            guest_count=random.randint(1, 3),
            nationality=nat,
            checkin_date=ci,
            checkout_date=co,
            nights=nights,
            room_type=random.choice(ROOM_TYPES),
            plan_name=random.choice(PLAN_NAMES),
            total_amount=float(amount),
            currency="JPY",
            status=status,
            is_group=False,
        ))
    return rsvs

async def seed_reservation() -> None:
    async with AsyncSessionLocal() as session:
        count_result = await session.execute(select(Reservation))
        existing = count_result.scalars().all()
        if existing:
            print(f"[seed_reservation] already has {len(existing)} reservations — skipping")
            return

        prop_result = await session.execute(select(Property).limit(1))
        prop = prop_result.scalar_one_or_none()
        if not prop:
            print("[seed_reservation] No property found — aborting")
            return

        data_list = generate_reservations(60)
        for data in data_list:
            res = Reservation(property_id=prop.id, **data)
            session.add(res)

        await session.commit()
        print(f"[seed_reservation] Inserted {len(data_list)} reservations for property {prop.id}")

if __name__ == "__main__":
    asyncio.run(seed_reservation())
