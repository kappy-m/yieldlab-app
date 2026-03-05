from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class RoomType(Base):
    __tablename__ = "room_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"))
    name: Mapped[str] = mapped_column(String(100))
    cm_room_type_code: Mapped[str | None] = mapped_column(String(100))
    total_rooms: Mapped[int] = mapped_column(Integer, default=10)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    property: Mapped["Property"] = relationship(back_populates="room_types")
    bar_ladders: Mapped[list["BarLadder"]] = relationship(back_populates="room_type")
    pricing_grids: Mapped[list["PricingGrid"]] = relationship(back_populates="room_type")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="room_type")
