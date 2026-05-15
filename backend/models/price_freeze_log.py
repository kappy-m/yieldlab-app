"""
Rating Circuit Breaker の凍結状態を管理するテーブル。

overall_rating の30日トレンドが -0.1 以上下落した場合に is_active=True になり、
PriceOptimizer が値上げ方向の推奨を出すのを封印する。

解除条件:
  - 7日間連続回復 (+0.05 以上) → is_active=False（自動解除）
  - 管理画面から手動解除 → manual_release=True, is_active=False
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Float, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PriceFreezeLog(Base):
    """Rating Circuit Breaker の凍結状態"""
    __tablename__ = "price_freeze_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # トリガー時の評価スナップショット
    baseline_overall: Mapped[float] = mapped_column(Float)
    trigger_overall: Mapped[float] = mapped_column(Float)
    trigger_reason: Mapped[str] = mapped_column(String(300))

    frozen_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    manual_release: Mapped[bool] = mapped_column(Boolean, default=False)

    property: Mapped["Property"] = relationship(back_populates="price_freeze_logs")
