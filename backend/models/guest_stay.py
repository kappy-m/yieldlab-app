"""ゲスト滞在情報モデル（Front プロダクト用）"""
from __future__ import annotations

import datetime
import enum

from sqlalchemy import Integer, String, Date, Boolean, ForeignKey, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class StayStatus(str, enum.Enum):
    expected  = "expected"    # チェックイン予定
    checked_in = "checked_in" # チェックイン済み
    checked_out = "checked_out" # チェックアウト済み
    no_show   = "no_show"     # ノーショー
    cancelled = "cancelled"   # キャンセル


class GuestStay(Base):
    __tablename__ = "guest_stays"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)

    # 予約情報
    reservation_no: Mapped[str] = mapped_column(String(50), index=True)
    ota_channel: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 楽天, Expedia, etc.

    # ゲスト情報
    guest_name: Mapped[str] = mapped_column(String(100))
    guest_name_kana: Mapped[str | None] = mapped_column(String(100), nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    guest_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    guest_count: Mapped[int] = mapped_column(Integer, default=1)
    nationality: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "JP", "US", etc.

    # 部屋情報
    room_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    room_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 滞在日程
    checkin_date: Mapped[datetime.date] = mapped_column(Date, index=True)
    checkout_date: Mapped[datetime.date] = mapped_column(Date, index=True)
    nights: Mapped[int] = mapped_column(Integer, default=1)

    # ステータス
    status: Mapped[StayStatus] = mapped_column(
        Enum(StayStatus), default=StayStatus.expected, index=True
    )
    checkin_time: Mapped[datetime.time | None] = mapped_column(nullable=True)
    checkout_time: Mapped[datetime.time | None] = mapped_column(nullable=True)

    # 追加情報
    plan_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    special_requests: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_repeat: Mapped[bool] = mapped_column(Boolean, default=False)

    # リレーション
    property: Mapped["Property"] = relationship(back_populates="guest_stays")  # type: ignore[name-defined]
