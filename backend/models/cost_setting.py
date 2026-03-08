from sqlalchemy import String, Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


COST_CATEGORIES = ["人件費", "光熱費", "リネン・アメニティ", "OTA手数料", "その他"]


class CostSetting(Base):
    """
    コスト設定。物件ごとの費用カテゴリを定義し、GOPPAR算出に使用する。
    - amount_per_room_night: 1室1泊あたりの変動費（円）
    - fixed_monthly: 月次固定費（円）
    """
    __tablename__ = "cost_settings"
    __table_args__ = (
        UniqueConstraint("property_id", "cost_category", name="uq_cost_setting"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)
    cost_category: Mapped[str] = mapped_column(String(50))
    amount_per_room_night: Mapped[int] = mapped_column(Integer, default=0)
    fixed_monthly: Mapped[int] = mapped_column(Integer, default=0)
