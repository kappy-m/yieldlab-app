import { NextRequest, NextResponse } from "next/server";

// プロダクトコードとアクセス可能なパスのマッピング
const PRODUCT_PATHS: Record<string, string> = {
  yield: "/yield",
  manage: "/manage",
  review: "/review",
  reservation: "/reservation",
  sales: "/sales",
};

// 認証不要なパス
const PUBLIC_PATHS = ["/login", "/unauthorized", "/_next", "/favicon.ico"];

/**
 * Edge Runtimeで動作するJWT検証（署名検証なし）。
 * ペイロードのデコードのみ行い、product_roles を確認する。
 * セキュリティ上の注意: 署名検証は FastAPI バックエンドが担当。
 * ミドルウェアはUX目的（リダイレクト）のみに使用する。
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的アセット・公開パスはスルー
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Basic Auth（環境変数設定時のみ有効）
  const basicUser = process.env.BASIC_AUTH_USER;
  const basicPassword = process.env.BASIC_AUTH_PASSWORD;

  if (basicUser && basicPassword) {
    const authorization = request.headers.get("authorization");
    if (authorization?.startsWith("Basic ")) {
      try {
        const decoded = atob(authorization.slice(6));
        const colonIdx = decoded.indexOf(":");
        if (
          colonIdx !== -1 &&
          decoded.slice(0, colonIdx) === basicUser &&
          decoded.slice(colonIdx + 1) === basicPassword
        ) {
          // Basic Auth OK — JWT チェックに進む
        } else {
          return new NextResponse("認証が必要です", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="Yieldlab", charset="UTF-8"' },
          });
        }
      } catch {
        return new NextResponse("認証が必要です", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Yieldlab", charset="UTF-8"' },
        });
      }
    } else {
      return new NextResponse("認証が必要です", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Yieldlab", charset="UTF-8"' },
      });
    }
  }

  // JWT ガード: プロダクトパスにアクセスする場合のみチェック
  const matchedProduct = Object.entries(PRODUCT_PATHS).find(([, path]) =>
    pathname.startsWith(path)
  );

  if (matchedProduct) {
    const [productCode] = matchedProduct;
    const token = request.cookies.get("yl_token")?.value;

    if (!token) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    // JWT有効期限チェック
    const exp = payload.exp as number | undefined;
    if (exp && exp * 1000 < Date.now()) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    // プロダクトアクセス権チェック
    const roles = payload.roles as Record<string, string> | undefined;
    if (!roles || Object.keys(roles).length === 0) {
      // roles フィールドがない古い JWT → 再ログインを促す
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set("yl_token", "", { httpOnly: true, maxAge: 0, path: "/" });
      return res;
    }
    if (!roles[productCode]) {
      const unauthorizedUrl = request.nextUrl.clone();
      unauthorizedUrl.pathname = "/unauthorized";
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
