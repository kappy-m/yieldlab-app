"""予約モデル（Reservation プロダクト用）"""
from __future__ import annotations

import datetime
import enum

from sqlalchemy import Integer, String, Date, Boolean, ForeignKey, Enum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class ReservationStatus(str, enum.Enum):
    confirmed   = "confirmed"    # 確定
    pending     = "pending"      # 仮予約・保留
    cancelled   = "cancelled"    # キャンセル
    no_show     = "no_show"      # ノーショー
    modified    = "modified"     # 変更済み


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)

    # 予約情報
    reservation_no: Mapped[str] = mapped_column(String(50), index=True)
    ota_channel: Mapped[str | None] = mapped_column(String(50), nullable=True)
    booking_date: Mapped[datetime.date] = mapped_column(Date, index=True)

    # ゲスト情報
    guest_name: Mapped[str] = mapped_column(String(100))
    guest_name_kana: Mapped[str | None] = mapped_column(String(100), nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    guest_count: Mapped[int] = mapped_column(Integer, default=1)
    nationality: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # 滞在情報
    checkin_date: Mapped[datetime.date] = mapped_column(Date, index=True)
    checkout_date: Mapped[datetime.date] = mapped_column(Date, index=True)
    nights: Mapped[int] = mapped_column(Integer, default=1)
    room_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    plan_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # 金額
    total_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="JPY")

    # ステータス
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus), default=ReservationStatus.confirmed, index=True
    )
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)

    # リレーション
    property: Mapped["Property"] = relationship(back_populates="reservations")  # type: ignore[name-defined]
