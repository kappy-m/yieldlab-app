from sqlalchemy import String, Integer, Float, ForeignKey, Boolean, Text, Date, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
import datetime
from ..database import Base


class ReviewPlatform(str, enum.Enum):
    google   = "google"
    rakuten  = "rakuten"
    expedia  = "expedia"
    booking  = "booking"


class ReviewLanguage(str, enum.Enum):
    ja    = "ja"
    en    = "en"
    zh    = "zh"
    ko    = "ko"
    de    = "de"
    other = "other"


class ReviewEntry(Base):
    """
    外部 OTA / Google からの口コミエントリ。
    スクレイピング or 手動登録で投入。
    """
    __tablename__ = "review_entries"

    id:           Mapped[int]   = mapped_column(primary_key=True)
    property_id:  Mapped[int]   = mapped_column(Integer, ForeignKey("properties.id"), index=True)

    platform:     Mapped[ReviewPlatform]  = mapped_column(Enum(ReviewPlatform))
    author:       Mapped[str]             = mapped_column(String(100))
    rating:       Mapped[float]           = mapped_column(Float)
    text:         Mapped[str]             = mapped_column(Text)
    review_date:  Mapped[datetime.date]   = mapped_column(Date, index=True)
    language:     Mapped[ReviewLanguage]  = mapped_column(Enum(ReviewLanguage), default=ReviewLanguage.ja)

    responded:    Mapped[bool]            = mapped_column(Boolean, default=False)
    response:     Mapped[str | None]      = mapped_column(Text, nullable=True)
    responded_at: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)

    external_id:  Mapped[str | None]      = mapped_column(String(200), nullable=True)

    property: Mapped["Property"] = relationship(back_populates="review_entries")
