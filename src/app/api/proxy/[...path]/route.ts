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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType,
  };

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  // redirect: "manual" で 307/308 を手動追従し、Authorization header を保持する。
  // Node.js fetch は redirect: "follow" 時に 3xx リダイレクト後の再リクエストで
  // Authorization header を落とすため、この実装が必須。
  let finalRes = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  // 307 / 308 のみ手動で追従（Authorization header を引き継ぐ）
  if (
    (finalRes.status === 307 || finalRes.status === 308) &&
    finalRes.headers.get("location")
  ) {
    const location = finalRes.headers.get("location")!;
    const redirectUrl = new URL(location, url.toString());
    finalRes = await fetch(redirectUrl.toString(), {
      method: req.method,
      headers,
      body,
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
