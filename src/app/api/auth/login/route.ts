import { NextRequest, NextResponse } from "next/server";

// サーバーサイドのみ: BACKEND_URL はクライアントには公開しない
const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8400";
const IS_PROD = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24; // 1日

export async function POST(req: NextRequest) {
  const body = await req.text();

  // 実際のクライアントIPをバックエンドへ転送する。
  // これがないとBFF経由のリクエストがすべて127.0.0.1に見え、
  // レートリミットがユーザー単位でなくサーバー全体に適用されてしまう。
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Forwarded-For": clientIp,
    },
    body,
  });

  // JSONパース失敗に備えてfallbackを用意する
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSONレスポンス（例: 502 Bad Gateway など）は空オブジェクトで続行
  }

  if (!res.ok) {
    // SlowAPI の 429 は {"error": "..."} 形式なので FastAPI 標準の detail に正規化
    if (res.status === 429) {
      return NextResponse.json(
        { detail: "ログイン試行回数の上限に達しました。1分後に再試行してください。" },
        { status: 429 }
      );
    }
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json(data, { status: 200 });

  // Next.js middleware が読める同一ドメインで HttpOnly cookie をセット
  response.cookies.set("yl_token", String(data.access_token ?? ""), {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    path: "/",
  });

  return response;
}
