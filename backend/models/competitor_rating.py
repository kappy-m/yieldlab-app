"""
競合ホテル評価データ（マルチソース対応）

source: "rakuten" | "google" | "tripadvisor"
ソースごとに1レコード。定期更新（週1回程度）で上書き。
"""

import datetime
from sqlalchemy import Integer, Float, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class CompetitorRating(Base):
    """競合ホテルの評価スコア（ソース別）"""
    __tablename__ = "competitor_ratings"
    __table_args__ = (
        UniqueConstraint("property_id", "hotel_name", "source", name="uq_rating_prop_hotel_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(Integer, ForeignKey("properties.id"), index=True)

    # ホテル識別
    hotel_name: Mapped[str] = mapped_column(String(200))
    rakuten_no: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 楽天施設番号

    # データソース: "rakuten" | "google" | "tripadvisor"
    source: Mapped[str] = mapped_column(String(20), index=True)

    # 総合評価（全ソース共通）
    overall: Mapped[float | None] = mapped_column(Float, nullable=True)     # 1.0〜5.0
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 楽天専用カテゴリ評価
    service_score: Mapped[float | None] = mapped_column(Float, nullable=True)   # サービス
    location_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 立地
    room_score: Mapped[float | None] = mapped_column(Float, nullable=True)      # 部屋
    equipment_score: Mapped[float | None] = mapped_column(Float, nullable=True) # 設備
    bath_score: Mapped[float | None] = mapped_column(Float, nullable=True)      # 風呂
    meal_score: Mapped[float | None] = mapped_column(Float, nullable=True)      # 食事

    # Google / TripAdvisor 用の汎用スコア（将来拡張）
    extra_scores: Mapped[str | None] = mapped_column(String(500), nullable=True)  # JSON文字列

    # 口コミ・レビュー
    user_review: Mapped[str | None] = mapped_column(String(2000), nullable=True)  # 最新1件のレビュー本文
    review_url: Mapped[str | None] = mapped_column(String(500), nullable=True)     # レビューページURL

    fetched_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    property: Mapped["Property"] = relationship(back_populates="competitor_ratings")
