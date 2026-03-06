import datetime
from sqlalchemy import Integer, Float, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class DailyPerformance(Base):
    """日次ホテル実績データ（稼働率・ADR・売上等）"""
    __tablename__ = "daily_performances"
    __table_args__ = (
        UniqueConstraint("property_id", "date", name="uq_perf_property_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)
    date: Mapped[datetime.date] = mapped_column(Date, index=True)

    # 稼働系
    occupancy_rate: Mapped[float] = mapped_column(Float)   # 0〜100 (%)
    rooms_sold: Mapped[int] = mapped_column(Integer)       # 販売室数
    total_rooms: Mapped[int] = mapped_column(Integer)      # 総客室数（参照用）

    # 価格・収益系
    adr: Mapped[int] = mapped_column(Integer)              # Average Daily Rate（円）
    revenue: Mapped[int] = mapped_column(Integer)          # 客室売上合計（円）
    revpar: Mapped[int] = mapped_column(Integer)           # RevPAR = revenue / total_rooms（円）

    # 予約動態
    new_bookings: Mapped[int] = mapped_column(Integer)     # その日の新規予約数
    cancellations: Mapped[int] = mapped_column(Integer, default=0)  # キャンセル数

    property: Mapped["Property"] = relationship(back_populates="daily_performances")
