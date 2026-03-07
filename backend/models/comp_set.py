from sqlalchemy import String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class CompSet(Base):
    """競合セット: ホテルがスクレイピング対象として登録する競合ホテル"""
    __tablename__ = "comp_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"))
    name: Mapped[str] = mapped_column(String(200))           # 競合ホテル名
    expedia_hotel_id: Mapped[str | None] = mapped_column(String(50))   # h{ID} の数字部分
    expedia_url: Mapped[str | None] = mapped_column(String(500))       # Expedia 参照用URL
    rakuten_hotel_no: Mapped[str | None] = mapped_column(String(50))       # 楽天トラベル hotelNo
    google_place_id: Mapped[str | None] = mapped_column(String(200), nullable=True)    # Google Places place_id
    tripadvisor_location_id: Mapped[str | None] = mapped_column(String(50), nullable=True)  # TripAdvisor location_id
    scrape_mode: Mapped[str] = mapped_column(String(20), default="mock")  # mock / rakuten / live
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    property: Mapped["Property"] = relationship(back_populates="comp_sets")
