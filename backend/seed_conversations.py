"""ゲストチャット MVP 用サンプル会話データ投入"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from .database import AsyncSessionLocal
from .models import Property
from .models.guest_conversation import GuestConversation, GuestMessage

logger = logging.getLogger(__name__)

SAMPLE_CONVERSATIONS = [
    {
        "guest_name": "John Smith",
        "guest_email": "john.smith@example.com",
        "room_no": "301",
        "detected_language": "en",
        "status": "open",
        "messages": [
            {
                "direction": "inbound",
                "text": "Hi, could you tell me what time breakfast is served? Also, is there a gym available?",
                "detected_language": "en",
                "translated_text": "朝食は何時から提供されますか？また、ジムはありますか？",
                "offset_hours": -3,
            },
        ],
    },
    {
        "guest_name": "李 明",
        "guest_email": "li.ming@example.cn",
        "room_no": "512",
        "detected_language": "zh",
        "status": "pending",
        "assignee_name": "佐藤 花子",
        "messages": [
            {
                "direction": "inbound",
                "text": "请问能帮我安排一辆出租车去机场吗？我明天早上8点需要出发。",
                "detected_language": "zh",
                "translated_text": "明日の朝8時に空港へのタクシーを手配していただけますか？",
                "offset_hours": -6,
            },
            {
                "direction": "outbound",
                "text": "かしこまりました。明日の朝7時45分にフロントでタクシーをご用意いたします。",
                "detected_language": "ja",
                "translated_text": "好的，我们将在明天早上7点45分为您在前台安排好出租车。",
                "offset_hours": -5,
            },
            {
                "direction": "inbound",
                "text": "非常感谢！请问费用大约是多少？",
                "detected_language": "zh",
                "translated_text": "ありがとうございます！費用はおよそいくらですか？",
                "offset_hours": -2,
            },
        ],
    },
    {
        "guest_name": "김 지수",
        "guest_email": "jisoo.kim@example.kr",
        "room_no": "208",
        "detected_language": "ko",
        "status": "open",
        "messages": [
            {
                "direction": "inbound",
                "text": "체크아웃 시간을 오후 1시로 늦출 수 있을까요? 추가 요금이 있나요?",
                "detected_language": "ko",
                "translated_text": "チェックアウトを午後1時に遅らせることはできますか？追加料金はありますか？",
                "offset_hours": -1,
            },
        ],
    },
    {
        "guest_name": "田中 健一",
        "guest_email": "kenichi.tanaka@example.jp",
        "room_no": "405",
        "detected_language": "ja",
        "status": "resolved",
        "messages": [
            {
                "direction": "inbound",
                "text": "部屋のエアコンの調子が悪いです。少し見ていただけますか？",
                "detected_language": "ja",
                "translated_text": None,
                "offset_hours": -24,
            },
            {
                "direction": "outbound",
                "text": "ご不便をおかけして申し訳ございません。すぐにメンテナンス担当者を向かわせます。",
                "detected_language": "ja",
                "translated_text": None,
                "offset_hours": -23,
            },
        ],
    },
    {
        "guest_name": "Maria Garcia",
        "guest_email": "maria.garcia@example.es",
        "room_no": "617",
        "detected_language": "en",
        "status": "open",
        "messages": [
            {
                "direction": "inbound",
                "text": "Is it possible to get an extra pillow and a blanket for my room?",
                "detected_language": "en",
                "translated_text": "部屋に枕とブランケットを追加でお願いできますか？",
                "offset_hours": -0,
            },
        ],
    },
]


async def seed_conversations() -> None:
    async with AsyncSessionLocal() as db:
        # 対象プロパティを取得（1件目）
        result = await db.execute(select(Property).limit(1))
        prop = result.scalar_one_or_none()
        if not prop:
            logger.warning("[SeedConversations] No property found — skipping")
            return

        # ユーザー一覧（担当者用）
        from .models.user import User
        users_result = await db.execute(select(User).order_by(User.id))
        users = users_result.scalars().all()
        user_map = {u.name: u.id for u in users}

        now = datetime.now()
        for sample in SAMPLE_CONVERSATIONS:
            msgs = sample["messages"]
            last_offset = msgs[-1]["offset_hours"]
            last_msg_at = now + timedelta(hours=last_offset)
            unread_count = sum(1 for m in msgs if m["direction"] == "inbound" and m["offset_hours"] >= -1)

            assignee_name = sample.get("assignee_name")
            assignee_id = user_map.get(assignee_name) if assignee_name else None

            conv = GuestConversation(
                property_id=prop.id,
                guest_name=sample["guest_name"],
                guest_email=sample.get("guest_email"),
                room_no=sample.get("room_no"),
                detected_language=sample["detected_language"],
                status=sample["status"],
                assignee_id=assignee_id,
                unread_count=unread_count,
                last_message_at=last_msg_at,
                created_at=now + timedelta(hours=msgs[0]["offset_hours"]),
            )
            db.add(conv)
            await db.flush()

            for msg_data in msgs:
                msg = GuestMessage(
                    conversation_id=conv.id,
                    direction=msg_data["direction"],
                    text=msg_data["text"],
                    detected_language=msg_data["detected_language"],
                    translated_text=msg_data["translated_text"],
                    created_at=now + timedelta(hours=msg_data["offset_hours"]),
                )
                db.add(msg)

        await db.commit()
        logger.info("[SeedConversations] Seeded %d conversations for property %d", len(SAMPLE_CONVERSATIONS), prop.id)
