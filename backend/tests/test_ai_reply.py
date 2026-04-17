"""
AI返信案生成エンドポイントのユニットテスト。

テスト対象: POST /ai/reply
- APIキー未設定時はフォールバックテンプレートを返す
- APIキーあり・OpenAI正常時はAI生成テキストを返す
- OpenAI例外時はフォールバックへ degradeする
- 認証なしは401
- content_type="review" / "inquiry" 両方で動作する
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers.ai_reply import router
from backend.routers.auth import require_auth


# require_auth をスタブユーザーで差し替える
class _StubUser:
    id = 1
    name = "Test User"
    is_active = True


def _override_auth():
    return _StubUser()


app = FastAPI()
app.include_router(router)
app.dependency_overrides[require_auth] = _override_auth

client = TestClient(app)


# ── ヘルパー ──────────────────────────────────────────────────────────────

def _post(payload: dict) -> dict:
    res = client.post("/ai/reply", json=payload)
    assert res.status_code == 200
    return res.json()


# ── テスト ────────────────────────────────────────────────────────────────

def test_fallback_when_no_api_key():
    """OPENAI_API_KEY 未設定時はフォールバックテンプレートを返す。"""
    with patch.dict(os.environ, {}, clear=True):
        os.environ.pop("OPENAI_API_KEY", None)
        data = _post({"content_type": "review", "content": "清潔で快適でした。"})
    assert data["fallback"] is True
    assert data["model"] == "template"
    assert len(data["reply"]) > 0


def test_fallback_language_selection():
    """言語パラメータに応じたフォールバックテンプレートが返る。"""
    with patch.dict(os.environ, {}, clear=True):
        os.environ.pop("OPENAI_API_KEY", None)
        data = _post({"content_type": "review", "content": "Great stay!", "language": "en"})
    assert "Thank you" in data["reply"]


def _make_openai_mock(reply_text: str | None = None, side_effect: Exception | None = None):
    """openai モジュールをまるごとモックする。遅延importに対応。"""
    mock_openai_mod = MagicMock()
    mock_client = AsyncMock()
    if side_effect:
        mock_client.chat.completions.create = AsyncMock(side_effect=side_effect)
    else:
        mock_choice = MagicMock()
        mock_choice.message.content = reply_text
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    mock_openai_mod.AsyncOpenAI.return_value = mock_client
    return mock_openai_mod


def test_openai_success():
    """APIキーあり・OpenAI正常時はAI生成テキストを返す。"""
    import sys
    mock_mod = _make_openai_mock(reply_text="AIが生成した返信文です。")
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
        with patch.dict(sys.modules, {"openai": mock_mod}):
            data = _post({"content_type": "review", "content": "清潔で快適でした。"})

    assert data["fallback"] is False
    assert data["model"] == "gpt-4o"
    assert data["reply"] == "AIが生成した返信文です。"


def test_openai_exception_falls_back():
    """OpenAI例外時はフォールバックテンプレートへ degradeする。"""
    import sys
    mock_mod = _make_openai_mock(side_effect=Exception("timeout"))
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
        with patch.dict(sys.modules, {"openai": mock_mod}):
            data = _post({"content_type": "inquiry", "content": "チェックインは何時ですか？"})

    assert data["fallback"] is True
    assert data["model"] == "template"


def test_inquiry_content_type():
    """content_type=inquiry でもフォールバックが正常に返る。"""
    with patch.dict(os.environ, {}, clear=True):
        os.environ.pop("OPENAI_API_KEY", None)
        data = _post({"content_type": "inquiry", "content": "駐車場はありますか？"})
    assert data["fallback"] is True
    assert len(data["reply"]) > 0


def test_unauthenticated_returns_401():
    """認証なし（依存関係オーバーライドなし）は 401 を返す。"""
    bare_app = FastAPI()
    bare_app.include_router(router)
    bare_client = TestClient(bare_app, raise_server_exceptions=False)
    res = bare_client.post("/ai/reply", json={"content_type": "review", "content": "test"})
    assert res.status_code == 401
