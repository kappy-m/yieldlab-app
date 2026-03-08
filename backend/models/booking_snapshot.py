from sqlalchemy import String, Integer, Float, ForeignKey, UniqueConstraint, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
import datetime


class BookingSnapshot(Base):
    """
    日次予約スナップショット。
    毎日深夜に「その日時点で将来各日に何室予約が入っているか」を記録する。
    これにより booking pace（予約ペース）の推移を時系列で追跡できる。
    """
    __tablename__ = "booking_snapshots"
    __table_args__ = (
        UniqueConstraint("property_id", "capture_date", "target_date", name="uq_snapshot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)
    # スナップショットを取った日
    capture_date: Mapped[datetime.date] = mapped_column(Date, index=True)
    # 予約対象日
    target_date: Mapped[datetime.date] = mapped_column(Date, index=True)
    # その時点での予約室数（total_rooms - available_rooms から逆算）
    booked_rooms: Mapped[int] = mapped_column(Integer, default=0)
    # その時点での売上オンハンド（booked_rooms × 平均単価）
    booked_revenue: Mapped[int] = mapped_column(Integer, default=0)
