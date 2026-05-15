"""
Google Trends データのキャッシュテーブル。

pytrends（非公式）を週1回バッチで取得し、エリア単位でキャッシュする。
IPブロック対策のため深夜（月曜03:00 JST）に実行し、失敗時は係数 1.0 でスキップ。
"""

from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GoogleTrendsCache(Base):
    """Google Trends 週次スナップショット（エリア×クエリ単位）"""
    __tablename__ = "google_trends_cache"
    __table_args__ = (
        UniqueConstraint(
            "area_code", "query", "period_start",
            name="uq_trends_area_query_period",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    area_code: Mapped[str] = mapped_column(String(50), index=True)
    query: Mapped[str] = mapped_column(String(100))
    period_start: Mapped[date] = mapped_column(Date, index=True)
    period_end: Mapped[date] = mapped_column(Date)
    trend_index: Mapped[float] = mapped_column(Float)  # 0〜100（Google Trends 正規化スコア）
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
