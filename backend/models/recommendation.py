from sqlalchemy import String, Integer, ForeignKey, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class Recommendation(Base):
    """AIが生成した推奨価格変更"""
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"))
    room_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("room_types.id"))
    target_date: Mapped[str] = mapped_column(Date)

    current_bar_level: Mapped[str] = mapped_column(String(5))
    recommended_bar_level: Mapped[str] = mapped_column(String(5))
    current_price: Mapped[int] = mapped_column(Integer)
    recommended_price: Mapped[int] = mapped_column(Integer)
    delta_levels: Mapped[int] = mapped_column(Integer)   # 正=UP / 負=DOWN
    reason: Mapped[str] = mapped_column(String(500), default="")

    # pending / auto_approved / approved / rejected
    status: Mapped[str] = mapped_column(String(30), default="pending")
    generated_at: Mapped[str] = mapped_column(DateTime, default=func.now())

    property: Mapped["Property"] = relationship(back_populates="recommendations")
    room_type: Mapped["RoomType"] = relationship(back_populates="recommendations")
    approval_log: Mapped["ApprovalLog | None"] = relationship(back_populates="recommendation")
