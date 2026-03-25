"""AI返信案生成エンドポイント (GPT-4o)"""
from __future__ import annotations

import os
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..routers.auth import require_auth
from ..models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

# ────────────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────────────

ContentType = Literal["review", "inquiry"]
Language = Literal["ja", "en", "zh", "ko", "de"]


class AiReplyRequest(BaseModel):
    content_type: ContentType = Field(..., description="'review' or 'inquiry'")
    content: str = Field(..., min_length=1, max_length=2000, description="口コミ・問い合わせ本文")
    language: Language = Field(default="ja", description="返信言語")
    platform: str | None = Field(default=None, description="プラットフォーム名（review のみ）")
    rating: float | None = Field(default=None, ge=1, le=5, description="評価スコア（review のみ）")
    hotel_name: str | None = Field(default=None, description="ホテル名（文脈向上用）")


class AiReplyResponse(BaseModel):
    reply: str
    model: str
    fallback: bool = False  # API失敗時はテンプレートにフォールバック


# ────────────────────────────────────────────────────────────────────────────
# Fallback templates（API不使用時・エラー時）
# ────────────────────────────────────────────────────────────────────────────

FALLBACK_TEMPLATES: dict[Language, str] = {
    "ja": "この度はご宿泊いただき、また貴重なご意見をお聞かせいただき誠にありがとうございます。\n\nいただいたご意見を真摯に受け止め、スタッフ一同サービス向上に努めてまいります。またのご来館を心よりお待ちしております。",
    "en": "Thank you so much for taking the time to share your experience with us. We truly appreciate your feedback and will use it to continue improving our services. We hope to welcome you back soon!",
    "zh": "非常感谢您抽出宝贵时间分享您的住宿体验。我们非常重视您的反馈，并将以此为契机不断提升服务质量。期待再次为您服务！",
    "ko": "소중한 리뷰를 남겨주셔서 진심으로 감사드립니다. 소중한 의견을 바탕으로 더욱 나은 서비스를 제공할 수 있도록 최선을 다하겠습니다. 다음에도 꼭 방문해 주시기 바랍니다.",
    "de": "Vielen Dank, dass Sie sich die Zeit genommen haben, Ihre Erfahrungen mit uns zu teilen. Wir schätzen Ihr Feedback sehr und werden es nutzen, um unsere Dienstleistungen weiter zu verbessern. Wir hoffen, Sie bald wieder bei uns begrüßen zu dürfen.",
}

# ────────────────────────────────────────────────────────────────────────────
# System prompts per language
# ────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPTS: dict[Language, str] = {
    "ja": "あなたはホテルのカスタマーサポート担当者です。お客様の口コミや問い合わせに対して、丁寧で温かみのある日本語で返信を作成してください。ホテルの代表として誠実に、かつ具体的に対応してください。返信は2〜4段落で、300字以内にまとめてください。",
    "en": "You are a hotel customer support representative. Write a warm, professional response in English to the guest's review or inquiry. Be sincere, specific, and represent the hotel well. Keep the response to 2-4 paragraphs, under 200 words.",
    "zh": "您是酒店客户服务代表。请用温暖、专业的中文回复客人的评价或咨询。请真诚、具体地代表酒店回应。回复控制在2-4段，200字以内。",
    "ko": "귀하는 호텔 고객 서비스 담당자입니다. 따뜻하고 전문적인 한국어로 고객의 리뷰나 문의에 답변해 주세요. 진심 어린 태도로 구체적으로 답변하며 호텔을 잘 대표해 주세요. 답변은 2-4단락, 200자 이내로 작성해 주세요.",
    "de": "Sie sind ein Kundendienstmitarbeiter eines Hotels. Schreiben Sie eine warme, professionelle Antwort auf Deutsch auf die Bewertung oder Anfrage des Gastes. Seien Sie aufrichtig und konkret. Halten Sie die Antwort bei 2-4 Absätzen und unter 200 Wörtern.",
}


def _build_user_prompt(req: AiReplyRequest) -> str:
    parts = []
    if req.hotel_name:
        parts.append(f"ホテル名: {req.hotel_name}")
    if req.content_type == "review":
        parts.append(f"種別: 口コミ（{req.platform or 'OTA'}）")
        if req.rating is not None:
            parts.append(f"評価: {req.rating}/5.0")
    else:
        parts.append("種別: 問い合わせ")
    parts.append(f"\n口コミ・問い合わせ内容:\n{req.content}")
    parts.append("\n上記に対する返信文を作成してください。")
    return "\n".join(parts)


# ────────────────────────────────────────────────────────────────────────────
# Endpoint
# ────────────────────────────────────────────────────────────────────────────

@router.post("/reply", response_model=AiReplyResponse)
async def generate_ai_reply(
    req: AiReplyRequest,
    current_user: User = Depends(require_auth),
) -> AiReplyResponse:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("OPENAI_API_KEY is not set — returning fallback template")
        return AiReplyResponse(
            reply=FALLBACK_TEMPLATES.get(req.language, FALLBACK_TEMPLATES["ja"]),
            model="template",
            fallback=True,
        )

    try:
        from openai import AsyncOpenAI  # 遅延インポート（キーなし環境でのimportエラー回避）

        client = AsyncOpenAI(api_key=api_key)
        system = SYSTEM_PROMPTS.get(req.language, SYSTEM_PROMPTS["ja"])
        user_prompt = _build_user_prompt(req)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=600,
            temperature=0.7,
        )

        reply_text = response.choices[0].message.content or ""
        return AiReplyResponse(reply=reply_text.strip(), model="gpt-4o")

    except Exception as exc:
        logger.error("OpenAI API error: %s", exc, exc_info=True)
        # API失敗時はテンプレートにフォールバック（UXを壊さない）
        return AiReplyResponse(
            reply=FALLBACK_TEMPLATES.get(req.language, FALLBACK_TEMPLATES["ja"]),
            model="template",
            fallback=True,
        )
