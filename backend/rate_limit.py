"""
Rate limiter インスタンスの共有モジュール。
main.py・各ルーターで import して使用する。
循環インポートを防ぐため独立モジュールとして定義。
"""
from starlette.requests import Request
from slowapi import Limiter


def _get_real_ip(request: Request) -> str:
    """
    BFF (Next.js) が転送した X-Forwarded-For からクライアント IP を取得する。
    SlowAPI デフォルトの get_remote_address は socket IP のみ参照するため、
    BFF 経由だと全リクエストが 127.0.0.1 に見えレートリミットが全ユーザー共有になる。
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=_get_real_ip)
