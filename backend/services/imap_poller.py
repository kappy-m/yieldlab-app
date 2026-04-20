"""
IMAP ポーリング — 5分毎に新着メールを取り込み GuestConversation/GuestMessage として保存する。

asyncio.to_thread() で同期 imaplib をスレッドプールに委譲し、
AsyncIOScheduler のイベントループをブロックしない。
IMAP_HOST / IMAP_USER / IMAP_PASSWORD が未設定の場合は静かにスキップする。
"""
from __future__ import annotations

import asyncio
import email
import imaplib
import logging
import os
from email.header import decode_header
from email.utils import parseaddr

logger = logging.getLogger(__name__)


def _decode_header_value(raw: str | bytes | None) -> str:
    if not raw:
        return ""
    parts, result = decode_header(raw), []
    for chunk, charset in parts:
        if isinstance(chunk, bytes):
            result.append(chunk.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(chunk)
    return "".join(result)


def _extract_body(msg: email.message.Message) -> str:
    """text/plain パートを優先して本文を返す。"""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace") if payload else ""
    payload = msg.get_payload(decode=True)
    charset = msg.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace") if payload else ""


def _fetch_unseen_mails(host: str, user: str, password: str) -> list[dict]:
    """IMAP UNSEEN フェッチ (同期)。メール情報の list を返す。"""
    results: list[dict] = []
    try:
        conn = imaplib.IMAP4_SSL(host)
        conn.login(user, password)
        conn.select("INBOX")
        _, msg_ids = conn.search(None, "UNSEEN")
        ids = msg_ids[0].split() if msg_ids[0] else []
        for mid in ids:
            _, data = conn.fetch(mid, "(RFC822)")
            if not data or not data[0]:
                continue
            raw = data[0][1]
            msg = email.message_from_bytes(raw)
            message_id = msg.get("Message-ID", "").strip()
            from_raw = msg.get("From", "")
            _, from_addr = parseaddr(from_raw)
            from_name = _decode_header_value(from_raw).split("<")[0].strip().strip('"') or from_addr
            subject = _decode_header_value(msg.get("Subject", ""))
            body = _extract_body(msg)
            results.append({
                "message_id": message_id,
                "from_name":  from_name or "Unknown Guest",
                "from_email": from_addr,
                "subject":    subject,
                "body":       body.strip()[:4000],  # DB サイズ上限
            })
        conn.logout()
    except Exception as e:
        logger.error("[IMAP] Fetch failed: %s", e)
    return results


async def poll_imap_and_ingest(property_id: int) -> int:
    """
    IMAP をポーリングして新着メールを GuestConversation + GuestMessage として保存する。
    追加した inbound メッセージ数を返す。
    """
    from ..config import settings
    if not settings.IMAP_HOST or not settings.IMAP_USER or not settings.IMAP_PASSWORD:
        logger.debug("[IMAP] IMAP settings not configured — skipping poll")
        return 0

    mails = await asyncio.to_thread(
        _fetch_unseen_mails,
        settings.IMAP_HOST,
        settings.IMAP_USER,
        settings.IMAP_PASSWORD,
    )
    if not mails:
        return 0

    from ..database import AsyncSessionLocal
    from ..models.guest_conversation import GuestConversation, GuestMessage
    from sqlalchemy import select, and_

    added = 0
    async with AsyncSessionLocal() as db:
        for mail in mails:
            message_id = mail["message_id"]
            body = mail["body"]
            if not body:
                continue

            # 重複チェック: 同一 property + external_id
            if message_id:
                existing = await db.execute(
                    select(GuestConversation).where(
                        and_(
                            GuestConversation.property_id == property_id,
                            GuestConversation.external_id == message_id,
                        )
                    )
                )
                if existing.scalar_one_or_none():
                    continue

            # 言語検出
            detected_lang = "ja"
            try:
                from langdetect import detect
                detected_lang = detect(body) if len(body) > 5 else "ja"
            except Exception:
                pass

            # 日本語訳 (非日本語の場合)
            translated = None
            if detected_lang != "ja":
                translated = await _translate_to_japanese(body)

            # 会話を新規作成
            conv = GuestConversation(
                property_id=property_id,
                guest_name=mail["from_name"],
                guest_email=mail["from_email"] or None,
                room_no=None,
                detected_language=detected_lang,
                status="open",
                unread_count=1,
                external_id=message_id or None,
            )
            db.add(conv)
            await db.flush()  # conv.id を確定

            msg = GuestMessage(
                conversation_id=conv.id,
                direction="inbound",
                text=body,
                detected_language=detected_lang,
                translated_text=translated,
            )
            db.add(msg)
            added += 1

        await db.commit()

    logger.info("[IMAP] Ingested %d new conversations for property %d", added, property_id)
    return added


async def _translate_to_japanese(text: str) -> str | None:
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
        logger.warning("[IMAP] Translation failed: %s", e)
        return None
