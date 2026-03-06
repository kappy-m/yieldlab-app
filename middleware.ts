import { NextRequest, NextResponse } from "next/server";

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER ?? "";
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD ?? "";

export function middleware(request: NextRequest) {
  // Basic認証が未設定の場合はスキップ（開発環境用フォールバック）
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");

  if (authorization) {
    const encoded = authorization.replace(/^Basic\s+/, "");
    try {
      const decoded = atob(encoded);
      const [user, ...rest] = decoded.split(":");
      const password = rest.join(":");
      if (user === BASIC_AUTH_USER && password === BASIC_AUTH_PASSWORD) {
        return NextResponse.next();
      }
    } catch {
      // invalid base64 — fall through to 401
    }
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Yieldlab manage"',
    },
  });
}

export const config = {
  // _next/static, 画像, faviconはBasic認証をスキップ
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
