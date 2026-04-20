from sqlalchemy import String, Integer, ForeignKey, Text, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
import datetime
from ..database import Base


class GuestConversation(Base):
    """ゲストとのメールチャット会話スレッド。1メール = 1会話 (V1)。"""
    __tablename__ = "guest_conversations"
    __table_args__ = (
        UniqueConstraint("property_id", "external_id", name="uq_conv_property_external"),
    )

    id:               Mapped[int]           = mapped_column(primary_key=True)
    property_id:      Mapped[int]           = mapped_column(Integer, ForeignKey("properties.id"), index=True)
    guest_name:       Mapped[str]           = mapped_column(String(100))
    guest_email:      Mapped[str | None]    = mapped_column(String(200), nullable=True)
    room_no:          Mapped[str | None]    = mapped_column(String(20), nullable=True)
    detected_language: Mapped[str]          = mapped_column(String(10), default="ja")
    status:           Mapped[str]           = mapped_column(String(20), default="open", index=True)
    assignee_id:      Mapped[int | None]    = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    unread_count:     Mapped[int]           = mapped_column(Integer, default=0)
    # IMAP Message-ID ヘッダー。ポーリングの重複取り込み防止に使う
    external_id:      Mapped[str | None]    = mapped_column(String(500), nullable=True, index=True)
    last_message_at:  Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())
    created_at:       Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())

    property:   Mapped["Property"]          = relationship(back_populates="guest_conversations")
    assignee:   Mapped["User | None"]       = relationship("User", foreign_keys=[assignee_id])
    messages:   Mapped[list["GuestMessage"]] = relationship(
        back_populates="conversation",
        order_by="GuestMessage.created_at",
    )


class GuestMessage(Base):
    """会話内の1メッセージ。inbound=ゲスト発、outbound=スタッフ発。"""
    __tablename__ = "guest_messages"

    id:                Mapped[int]        = mapped_column(primary_key=True)
    conversation_id:   Mapped[int]        = mapped_column(Integer, ForeignKey("guest_conversations.id"), index=True)
    direction:         Mapped[str]        = mapped_column(String(10))   # "inbound" | "outbound"
    text:              Mapped[str]        = mapped_column(Text)
    # inbound: langdetect で検出したゲスト言語 / outbound: "ja"
    detected_language: Mapped[str]        = mapped_column(String(10), default="ja")
    # inbound: 日本語訳 (非日本語の場合のみ非null) / outbound: ゲスト言語訳
    translated_text:   Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at:        Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())

    conversation: Mapped["GuestConversation"] = relationship(back_populates="messages")
