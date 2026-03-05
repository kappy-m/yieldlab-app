from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class ApprovalSetting(Base):
    """承認設定: プライス管理者が閾値を設定"""
    __tablename__ = "approval_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"))
    # N ランク以下の変動は自動反映、N+1 以上は承認必要
    auto_approve_threshold_levels: Mapped[int] = mapped_column(Integer, default=1)
    notification_channel: Mapped[str] = mapped_column(String(50), default="email")
    notification_email: Mapped[str | None] = mapped_column(String(200))

    property: Mapped["Property"] = relationship(back_populates="approval_settings")
