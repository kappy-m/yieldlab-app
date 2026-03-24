import { NextRequest, NextResponse } from "next/server";

// サーバーサイドのみ: BACKEND_URL はクライアントには公開しない
const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8400";
const IS_PROD = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24; // 1日

export async function POST(req: NextRequest) {
  const body = await req.text();

  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json(data, { status: 200 });

  // Next.js middleware が読める同一ドメインで HttpOnly cookie をセット
  response.cookies.set("yl_token", data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    path: "/",
  });

  return response;
}
