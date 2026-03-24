import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8400";

export async function POST() {
  // バックエンドにもログアウトを通知
  await fetch(`${BACKEND_URL}/auth/logout`, {
    method: "POST",
  }).catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set("yl_token", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
