"""ゲストチャット会話 API"""
from __future__ import annotations

import logging
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..dependencies import get_authed_property
from ..models.guest_conversation import GuestConversation, GuestMessage
from ..models.user import User
from ..routers.auth import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/properties/{property_id}/conversations",
    tags=["conversations"],
)


# ────────────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: int
    direction: Literal["inbound", "outbound"]
    text: str
    detected_language: str
    translated_text: str | None
    created_at: str

    model_config = {"from_attributes": True}


class ConversationSummaryOut(BaseModel):
    id: int
    guest_name: str
    guest_email: str | None
    room_no: str | None
    detected_language: str
    status: str
    assignee_id: int | None
    assignee_name: str | None
    unread_count: int
    last_message_preview: str | None
    last_message_at: str

    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: int
    guest_name: str
    guest_email: str | None
    room_no: str | None
    detected_language: str
    status: str
    assignee_id: int | None
    assignee_name: str | None
    unread_count: int
    last_message_at: str
    messages: list[MessageOut]

    model_config = {"from_attributes": True}


class ConversationListOut(BaseModel):
    items: list[ConversationSummaryOut]
    total: int
    unread_total: int


class SendMessageIn(BaseModel):
    text: str
    direction: Literal["inbound", "outbound"] = "outbound"


class AiDraftOut(BaseModel):
    draft: str
    model: str
    fallback: bool = False


class AssigneeIn(BaseModel):
    assignee_id: int | None


class StatusIn(BaseModel):
    status: Literal["open", "pending", "resolved"]


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def _dt_str(dt) -> str:
    return dt.isoformat() if dt else ""


async def _translate(text: str, target_lang: str) -> str | None:
    """gpt-4o-mini でテキストを target_lang に翻訳する。失敗時は None を返す。"""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or target_lang == "ja":
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        lang_names = {"en": "English", "zh": "Chinese", "ko": "Korean", "de": "German"}
        target_name = lang_names.get(target_lang, target_lang)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"Translate the following text to {target_name}. Output only the translation, nothing else."},
                {"role": "user", "content": text},
            ],
            max_tokens=800,
            temperature=0.3,
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception as e:
        logger.warning("Translation failed: %s", e)
        return None


async def _translate_to_japanese(text: str) -> str | None:
    """非日本語テキストを日本語に翻訳する。"""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Translate the following text to Japanese. Output only the translation, nothing else."},
                {"role": "user", "content": text},
            ],
            max_tokens=800,
            temperature=0.3,
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception as e:
        logger.warning("Translation to Japanese failed: %s", e)
        return None


def _build_summary(conv: GuestConversation) -> ConversationSummaryOut:
    last_msg = conv.messages[-1] if conv.messages else None
    return ConversationSummaryOut(
        id=conv.id,
        guest_name=conv.guest_name,
        guest_email=conv.guest_email,
        room_no=conv.room_no,
        detected_language=conv.detected_language,
        status=conv.status,
        assignee_id=conv.assignee_id,
        assignee_name=conv.assignee.name if conv.assignee else None,
        unread_count=conv.unread_count,
        last_message_preview=(last_msg.text[:80] if last_msg else None),
        last_message_at=_dt_str(conv.last_message_at),
    )


# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=ConversationListOut)
async def list_conversations(
    property_id: int,
    prop=Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GuestConversation)
        .where(GuestConversation.property_id == property_id)
        .options(
            selectinload(GuestConversation.messages),
            selectinload(GuestConversation.assignee),
        )
        .order_by(GuestConversation.unread_count.desc(), GuestConversation.last_message_at.desc())
    )
    convs = result.scalars().all()
    unread_total = sum(c.unread_count for c in convs)
    return ConversationListOut(
        items=[_build_summary(c) for c in convs],
        total=len(convs),
        unread_total=unread_total,
    )


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    property_id: int,
    conversation_id: int,
    prop=Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GuestConversation)
        .where(
            and_(
                GuestConversation.id == conversation_id,
                GuestConversation.property_id == property_id,
            )
        )
        .options(
            selectinload(GuestConversation.messages),
            selectinload(GuestConversation.assignee),
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationDetailOut(
        id=conv.id,
        guest_name=conv.guest_name,
        guest_email=conv.guest_email,
        room_no=conv.room_no,
        detected_language=conv.detected_language,
        status=conv.status,
        assignee_id=conv.assignee_id,
        assignee_name=conv.assignee.name if conv.assignee else None,
        unread_count=conv.unread_count,
        last_message_at=_dt_str(conv.last_message_at),
        messages=[
            MessageOut(
                id=m.id,
                direction=m.direction,
                text=m.text,
                detected_language=m.detected_language,
                translated_text=m.translated_text,
                created_at=_dt_str(m.created_at),
            )
            for m in conv.messages
        ],
    )


@router.patch("/{conversation_id}/read", response_model=dict)
async def mark_read(
    property_id: int,
    conversation_id: int,
    prop=Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """パネルを開いた時に呼ぶ。unread_count を 0 にリセットする。"""
    result = await db.execute(
        select(GuestConversation).where(
            and_(
                GuestConversation.id == conversation_id,
                GuestConversation.property_id == property_id,
            )
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.unread_count = 0
    await db.commit()
    return {"ok": True}


@router.post("/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    property_id: int,
    conversation_id: int,
    body: SendMessageIn,
    prop=Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GuestConversation).where(
            and_(
                GuestConversation.id == conversation_id,
                GuestConversation.property_id == property_id,
            )
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.direction == "outbound":
        # スタッフの日本語返信 → ゲスト言語に翻訳して translated_text に保存
        translated = await _translate(body.text, conv.detected_language)
        msg = GuestMessage(
            conversation_id=conv.id,
            direction="outbound",
            text=body.text,
            detected_language="ja",
            translated_text=translated,
        )
    else:
        # 手動 inbound 投稿（テスト用）
        detected_lang = "ja"
        try:
            from langdetect import detect
            detected_lang = detect(body.text) if len(body.text) > 3 else "ja"
        except Exception:
            pass
        translated = None
        if detected_lang != "ja":
            translated = await _translate_to_japanese(body.text)
        msg = GuestMessage(
            conversation_id=conv.id,
            direction="inbound",
            text=body.text,
            detected_language=detected_lang,
            translated_text=translated,
        )
        conv.unread_count += 1

    db.add(msg)
    from sqlalchemy import func as sa_func
    conv.last_message_at = sa_func.now()
    await db.commit()
    await db.refresh(msg)

    return MessageOut(
        id=msg.id,
        direction=msg.direction,
        text=msg.text,
        detected_language=msg.detected_language,
        translated_text=msg.translated_text,
        created_at=_dt_str(msg.created_at),
    )


@router.post("/{conversation_id}/ai-draft", response_model=AiDraftOut)
async def generate_ai_draft(
    property_id: int,
    conversation_id: int,
    prop=Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """最新 inbound メッセージを元に gpt-4o で日本語返信ドラフトを生成する。"""
    result = await db.execute(
        select(GuestConversation)
        .where(
            and_(
                GuestConversation.id == conversation_id,
                GuestConversation.property_id == property_id,
            )
        )
        .options(selectinload(GuestConversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    inbound_msgs = [m for m in conv.messages if m.direction == "inbound"]
    if not inbound_msgs:
        raise HTTPException(status_code=422, detail="No inbound messages to draft from")

    last_inbound = inbound_msgs[-1]
    # 翻訳済み日本語があればそれを使い、なければ原文を使う
    content_for_ai = last_inbound.translated_text or last_inbound.text

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return AiDraftOut(
            draft="チェックイン時刻は15時からです。ご不明な点はお気軽にお申し付けください。",
            model="template",
            fallback=True,
        )

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "あなたはホテルのフロントスタッフです。ゲストからのメッセージに対して、"
                        "丁寧で温かみのある日本語で簡潔な返信案を作成してください。"
                        "返信は2〜3文以内にまとめてください。"
                    ),
                },
                {
                    "role": "user",
                    "content": f"ゲストからのメッセージ:\n{content_for_ai}\n\n返信案を作成してください。",
                },
            ],
            max_tokens=400,
            temperature=0.7,
        )
        draft = (resp.choices[0].message.content or "").strip()
        return AiDraftOut(draft=draft, model="gpt-4o")
    except Exception as e:
        logger.error("AI draft generation failed: %s", e)
        raise HTTPException(status_code=503, detail="AI draft generation failed")


@router.patch("/{conversation_id}/assignee", response_model=dict)
async def update_assignee(
    property_id: int,
    conversation_id: int,
    body: AssigneeIn,
    prop=Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GuestConversation).where(
            and_(
                GuestConversation.id == conversation_id,
                GuestConversation.property_id == property_id,
            )
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.assignee_id = body.assignee_id
    await db.commit()
    return {"ok": True}


@router.patch("/{conversation_id}/status", response_model=dict)
async def update_status(
    property_id: int,
    conversation_id: int,
    body: StatusIn,
    prop=Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GuestConversation).where(
            and_(
                GuestConversation.id == conversation_id,
                GuestConversation.property_id == property_id,
            )
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.status = body.status
    await db.commit()
    return {"ok": True}
