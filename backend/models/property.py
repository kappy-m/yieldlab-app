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

    organization: Mapped["Organization"] = relationship(back_populates="properties")
    bar_ladders: Mapped[list["BarLadder"]] = relationship(back_populates="property")
    room_types: Mapped[list["RoomType"]] = relationship(back_populates="property")
    approval_settings: Mapped[list["ApprovalSetting"]] = relationship(back_populates="property")
    competitor_prices: Mapped[list["CompetitorPrice"]] = relationship(back_populates="property")
    pricing_grids: Mapped[list["PricingGrid"]] = relationship(back_populates="property")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="property")
    comp_sets: Mapped[list["CompSet"]] = relationship(back_populates="property")
