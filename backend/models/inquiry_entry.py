from sqlalchemy import String, Integer, ForeignKey, Text, Date, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
import datetime
from ..database import Base


class InquiryChannel(str, enum.Enum):
    email = "email"
    form  = "form"
    phone = "phone"


class InquiryStatus(str, enum.Enum):
    new         = "new"
    in_progress = "in_progress"
    resolved    = "resolved"
    closed      = "closed"


class InquiryPriority(str, enum.Enum):
    high   = "high"
    medium = "medium"
    low    = "low"


class InquiryEntry(Base):
    """
    フォーム / メール / 電話からの問い合わせエントリ。
    """
    __tablename__ = "inquiry_entries"

    id:             Mapped[int]  = mapped_column(primary_key=True)
    property_id:    Mapped[int]  = mapped_column(Integer, ForeignKey("properties.id"), index=True)

    channel:        Mapped[InquiryChannel]  = mapped_column(Enum(InquiryChannel))
    status:         Mapped[InquiryStatus]   = mapped_column(Enum(InquiryStatus), default=InquiryStatus.new, index=True)
    priority:       Mapped[InquiryPriority] = mapped_column(Enum(InquiryPriority), default=InquiryPriority.medium)

    customer_name:  Mapped[str]      = mapped_column(String(100))
    customer_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    subject:        Mapped[str]      = mapped_column(String(300))
    content:        Mapped[str]      = mapped_column(Text)
    inquiry_date:   Mapped[datetime.date] = mapped_column(Date, index=True)
    language:       Mapped[str]      = mapped_column(String(10), default="ja")

    assignee:       Mapped[str | None] = mapped_column(String(100), nullable=True)
    tags:           Mapped[str | None] = mapped_column(String(500), nullable=True)  # JSON配列をシリアライズ

    response:       Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_at:   Mapped[datetime.date | None] = mapped_column(Date, nullable=True)

    property: Mapped["Property"] = relationship(back_populates="inquiry_entries")
