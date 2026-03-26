from sqlalchemy import String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class BarLadder(Base):
    """BARラダー: ホテルが登録する価格ランク定義"""
    __tablename__ = "bar_ladders"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"))
    room_type_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("room_types.id"), nullable=True)
    level: Mapped[str] = mapped_column(String(5))   # 1-20 の数値文字列（TL-Lincoln互換）
    price: Mapped[int] = mapped_column(Integer)      # 円
    label: Mapped[str] = mapped_column(String(50), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    property: Mapped["Property"] = relationship(back_populates="bar_ladders")
    room_type: Mapped["RoomType | None"] = relationship(back_populates="bar_ladders")
