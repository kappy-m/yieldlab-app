from sqlalchemy import String, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(200))
    cm_property_code: Mapped[str | None] = mapped_column(String(100))
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Tokyo")
    created_at: Mapped[str] = mapped_column(DateTime, default=func.now())

    # ホテル詳細情報（自社物件のリアルデータ用）
    brand: Mapped[str | None] = mapped_column(String(100))          # ブランド名
    address: Mapped[str | None] = mapped_column(String(300))        # 住所
    star_rating: Mapped[int | None] = mapped_column(Integer)        # 星数
    total_rooms: Mapped[int | None] = mapped_column(Integer)        # 総客室数
    checkin_time: Mapped[str | None] = mapped_column(String(10))    # チェックイン時刻
    checkout_time: Mapped[str | None] = mapped_column(String(10))   # チェックアウト時刻
    website_url: Mapped[str | None] = mapped_column(String(300))    # 公式サイト
    own_rakuten_hotel_no: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 自社の楽天ホテル番号
    event_area: Mapped[str] = mapped_column(String(30), default="nihonbashi")            # マーケットイベントエリア: nihonbashi | ginza

    organization: Mapped["Organization"] = relationship(back_populates="properties")
    bar_ladders: Mapped[list["BarLadder"]] = relationship(back_populates="property")
    room_types: Mapped[list["RoomType"]] = relationship(back_populates="property")
    approval_settings: Mapped[list["ApprovalSetting"]] = relationship(back_populates="property")
    competitor_prices: Mapped[list["CompetitorPrice"]] = relationship(back_populates="property")
    pricing_grids: Mapped[list["PricingGrid"]] = relationship(back_populates="property")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="property")
    comp_sets: Mapped[list["CompSet"]] = relationship(back_populates="property")
    daily_performances: Mapped[list["DailyPerformance"]] = relationship(back_populates="property")
    competitor_ratings: Mapped[list["CompetitorRating"]] = relationship(back_populates="property")
