/**
 * API クライアント — 基盤
 *
 * 全リクエストは /api/proxy/* (BFF) 経由でバックエンドに転送される。
 * JWT は HttpOnly Cookie (yl_token) で管理し、localStorage には格納しない。
 */

export const BFF_BASE = "/api/proxy";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BFF_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  // 401: セッション切れ → Cookie を削除してログインページへリダイレクト
  if (res.status === 401) {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ログアウト失敗しても強制遷移
    }
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("セッションが切れました。再ログインしてください。");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---- Auth Types ----

export type ProductCode = "yield" | "manage" | "review" | "reservation" | "sales";
export type ProductRole = "admin" | "editor" | "viewer";

/** Sales プロダクト専用の機能別ロール。汎用 ProductRole とは独立して定義する。 */
export type SalesRole = "sales_manager" | "booking_staff" | "revenue_manager";

/** 汎用ロールと Sales 専用ロールのユニオン。product_roles の値型として使用。 */
export type AnyProductRole = ProductRole | SalesRole;

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  name: string;
  role: string;
  org_id: number;
  product_roles: Partial<Record<ProductCode, AnyProductRole>>;
}

export interface UserOut {
  id: number;
  name: string;
  email: string;
  role: string;
  org_id: number;
  product_roles: Partial<Record<ProductCode, AnyProductRole>>;
}

// ---- Auth Functions ----

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);

  const res = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "ログインに失敗しました");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`/api/auth/logout`, { method: "POST" });
  // HttpOnly Cookie は /api/auth/logout がクリアする
  // yl_user キャッシュのみ削除（機密情報ではないため localStorage 利用継続）
  if (typeof window !== "undefined") {
    localStorage.removeItem("yl_user");
  }
}

export function fetchCurrentUser(): Promise<UserOut> {
  return apiFetch<UserOut>("/auth/me");
}
