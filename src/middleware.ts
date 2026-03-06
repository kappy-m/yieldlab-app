import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Edge Runtimeでは関数内でprocess.envを参照する
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数未設定の場合はスルー（ローカル開発環境用）
  if (!user || !password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");

  if (authorization && authorization.startsWith("Basic ")) {
    const encoded = authorization.slice(6);
    try {
      const decoded = atob(encoded);
      const colonIndex = decoded.indexOf(":");
      if (colonIndex !== -1) {
        const inputUser = decoded.slice(0, colonIndex);
        const inputPassword = decoded.slice(colonIndex + 1);
        if (inputUser === user && inputPassword === password) {
          return NextResponse.next();
        }
      }
    } catch {
      // invalid base64 — fall through to 401
    }
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Yieldlab manage", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
