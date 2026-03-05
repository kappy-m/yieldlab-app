from sqlalchemy import String, Integer, ForeignKey, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class PricingGrid(Base):
    """価格グリッド: 各日付×部屋タイプの現在価格設定"""
    __tablename__ = "pricing_grids"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"))
    room_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("room_types.id"))
    target_date: Mapped[str] = mapped_column(Date)
    bar_level: Mapped[str] = mapped_column(String(1))    # A / B / C / D / E
    price: Mapped[int] = mapped_column(Integer)
    available_rooms: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[str] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    updated_by: Mapped[str] = mapped_column(String(50), default="manual")  # manual / ai / cm_push

    property: Mapped["Property"] = relationship(back_populates="pricing_grids")
    room_type: Mapped["RoomType"] = relationship(back_populates="pricing_grids")
