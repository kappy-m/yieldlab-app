from sqlalchemy import String, Integer, ForeignKey, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class CompetitorPrice(Base):
    """Expediaスクレイピング結果"""
    __tablename__ = "competitor_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"))
    scraped_at: Mapped[str] = mapped_column(DateTime, default=func.now())
    target_date: Mapped[str] = mapped_column(Date)
    competitor_name: Mapped[str] = mapped_column(String(200))
    room_type_label: Mapped[str | None] = mapped_column(String(200))
    price: Mapped[int] = mapped_column(Integer)           # 円
    available_rooms: Mapped[int | None] = mapped_column(Integer)
    source_url: Mapped[str | None] = mapped_column(String(500))

    property: Mapped["Property"] = relationship(back_populates="competitor_prices")
