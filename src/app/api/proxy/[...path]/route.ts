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

  const backendRes = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
    redirect: "follow",
  });

  const resContentType =
    backendRes.headers.get("content-type") ?? "application/json";
  const resBody = await backendRes.text();

  return new NextResponse(resBody, {
    status: backendRes.status,
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
