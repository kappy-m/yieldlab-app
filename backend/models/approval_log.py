from sqlalchemy import String, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class ApprovalLog(Base):
    __tablename__ = "approval_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    recommendation_id: Mapped[int] = mapped_column(Integer, ForeignKey("recommendations.id"), unique=True)
    reviewer_id: Mapped[str | None] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(20))       # approved / rejected / modified
    modified_bar_level: Mapped[str | None] = mapped_column(String(1))
    modified_price: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(500))
    actioned_at: Mapped[str] = mapped_column(DateTime, default=func.now())

    recommendation: Mapped["Recommendation"] = relationship(back_populates="approval_log")
