from sqlalchemy import Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class BudgetTarget(Base):
    """
    月次予算目標。物件ごとに年月単位で KPI 目標を設定する。
    実績（DailyPerformance の月次集計）との比較に使用する。
    """
    __tablename__ = "budget_targets"
    __table_args__ = (
        UniqueConstraint("property_id", "year", "month", name="uq_budget_target"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    # KPI 目標値
    target_occupancy: Mapped[float | None] = mapped_column(Float, nullable=True)   # %
    target_adr: Mapped[int | None] = mapped_column(Integer, nullable=True)          # 円
    target_revpar: Mapped[int | None] = mapped_column(Integer, nullable=True)       # 円
    target_revenue: Mapped[int | None] = mapped_column(Integer, nullable=True)      # 円
