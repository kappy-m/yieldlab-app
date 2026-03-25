"""メール送信エンドポイント（Resend API）"""
from __future__ import annotations

import os
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from ..routers.auth import require_auth
from ..models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mail", tags=["mail"])

# ────────────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────────────

class SendMailRequest(BaseModel):
    to_email: str = Field(..., description="宛先メールアドレス")
    to_name: Optional[str] = Field(default=None, description="宛先名（表示用）")
    subject: str = Field(..., min_length=1, max_length=500, description="件名")
    body: str = Field(..., min_length=1, max_length=10000, description="本文（プレーンテキスト）")
    reply_to: Optional[str] = Field(default=None, description="返信先メールアドレス")
    # 内部管理用（ログ・追跡）
    inquiry_id: Optional[int] = Field(default=None, description="関連する問い合わせID")


class SendMailResponse(BaseModel):
    message_id: Optional[str] = None
    status: str  # "sent" | "failed" | "simulated"
    detail: str


# ────────────────────────────────────────────────────────────────────────────
# Endpoint
# ────────────────────────────────────────────────────────────────────────────

@router.post("/send", response_model=SendMailResponse)
async def send_mail(
    req: SendMailRequest,
    current_user: User = Depends(require_auth),
) -> SendMailResponse:
    api_key = os.getenv("RESEND_API_KEY", "")
    from_email = os.getenv("RESEND_FROM_EMAIL", "noreply@yieldlab.dev")
    from_name = os.getenv("RESEND_FROM_NAME", "YieldLab")

    if not api_key:
        # APIキー未設定時はシミュレーション（ログのみ）
        logger.info(
            "[MAIL SIMULATED] to=%s subject=%s inquiry_id=%s",
            req.to_email, req.subject, req.inquiry_id,
        )
        return SendMailResponse(
            status="simulated",
            detail="RESEND_API_KEY が未設定のため、メール送信をシミュレートしました。",
        )

    try:
        import resend  # 遅延インポート

        resend.api_key = api_key

        # HTML 本文：プレーンテキストを簡易的にHTMLに変換
        html_body = "<br>".join(req.body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").split("\n"))
        html_content = f"""
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6; padding: 24px;">
  <p>{html_body}</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="font-size: 12px; color: #94a3b8;">
    本メールは YieldLab より自動送信されています。<br>
    このメールに直接返信することでホテルへ連絡いただけます。
  </p>
</body>
</html>
"""

        params: resend.Emails.SendParams = {
            "from": f"{from_name} <{from_email}>",
            "to": [f"{req.to_name} <{req.to_email}>" if req.to_name else req.to_email],
            "subject": req.subject,
            "html": html_content,
        }
        if req.reply_to:
            params["reply_to"] = req.reply_to

        email = resend.Emails.send(params)
        message_id = email.get("id") if isinstance(email, dict) else str(email)

        logger.info("[MAIL SENT] id=%s to=%s subject=%s", message_id, req.to_email, req.subject)

        return SendMailResponse(
            message_id=message_id,
            status="sent",
            detail=f"{req.to_email} へメールを送信しました。",
        )

    except Exception as exc:
        logger.error("Resend API error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"メール送信に失敗しました: {exc}",
        )
