import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8400";

async function proxyRequest(
  req: NextRequest,
  params: Promise<{ path: string[] }>
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("yl_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const joinedPath = path.join("/");
  const url = new URL(`/${joinedPath}`, BACKEND_URL);

  // クエリパラメータを転送
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const contentType = req.headers.get("content-type") ?? "application/json";
  const isMultipart = contentType.startsWith("multipart/form-data");

  // multipart/form-data の場合は Content-Type ヘッダーを転送するが上書きしない
  // （boundary 情報が含まれるため上書きすると FastAPI のパースが失敗する）
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(isMultipart ? { "Content-Type": contentType } : { "Content-Type": contentType }),
  };

  let body: string | ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    // multipart/form-data はバイナリデータなので arrayBuffer で転送する。
    // text() で読むと文字列変換によりバイナリが破損するため NG。
    body = isMultipart ? await req.arrayBuffer() : await req.text();
  }

  // redirect: "manual" で 3xx を手動追従し、Authorization header を保持する。
  //
  // 【問題の背景】
  // Node.js fetch は redirect:"follow" 時に 3xx 後の再リクエストで Authorization
  // header を自動的に削除する。Railway は FastAPI の redirect_slashes=True により
  // /overview → /overview/ の 307 を返すが、その Location が http:// になるため
  // さらに 301 (HTTP→HTTPS) が発生する。全リダイレクトで Authorization を保持する。
  //
  // リダイレクト仕様:
  //   307/308: method・body・headers を維持
  //   301/302: method を GET に変更（body なし）、headers は維持
  const MAX_REDIRECTS = 5;
  let currentUrl = url.toString();
  let currentMethod = req.method;
  let currentBody = body;
  let finalRes = await fetch(currentUrl, {
    method: currentMethod,
    headers,
    body: currentBody,
    redirect: "manual",
  });

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const { status } = finalRes;
    if (![301, 302, 307, 308].includes(status)) break;
    const location = finalRes.headers.get("location");
    if (!location) break;

    // Railway の http:// リダイレクトを https:// に正規化（逆方向は維持）
    const redirectUrl = new URL(location, currentUrl);
    if (
      redirectUrl.hostname === url.hostname &&
      url.protocol === "https:" &&
      redirectUrl.protocol === "http:"
    ) {
      redirectUrl.protocol = "https:";
    }

    // 301/302 は method を GET に変更
    if (status === 301 || status === 302) {
      currentMethod = "GET";
      currentBody = undefined;
    }
    currentUrl = redirectUrl.toString();
    finalRes = await fetch(currentUrl, {
      method: currentMethod,
      headers,
      body: currentBody,
      redirect: "manual",
    });
  }

  const resContentType =
    finalRes.headers.get("content-type") ?? "application/json";
  const resBody = await finalRes.text();

  return new NextResponse(resBody, {
    status: finalRes.status,
    headers: { "Content-Type": resContentType },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, params);
}
