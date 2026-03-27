import { useState, useEffect } from "react";
import type { ProductCode, AnyProductRole, SalesRole, ProductRole } from "@/lib/api";

/** localStorage の yl_user から取得するユーザー情報の型 */
interface StoredUser {
  id: number;
  name: string;
  role: string;
  org_id: number;
  product_roles: Partial<Record<ProductCode, AnyProductRole>>;
}

const SALES_ROLES: SalesRole[] = [
  "sales_manager",
  "booking_staff",
  "revenue_manager",
];

function isSalesRole(role: AnyProductRole | undefined): role is SalesRole {
  return SALES_ROLES.includes(role as SalesRole);
}

function isProductRole(role: AnyProductRole | undefined): role is ProductRole {
  return role === "admin" || role === "editor" || role === "viewer";
}

function readStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("yl_user");
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

/** イニシャル（最大2文字）を名前から生成する */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export interface CurrentUserState {
  /** ログイン中のユーザー情報（未ログイン時は null） */
  user: StoredUser | null;
  /** Sales プロダクト専用の機能別ロール（未設定 or 汎用ロールの場合は null） */
  salesRole: SalesRole | null;
  /** 指定プロダクトのロールを返す */
  productRole: (code: ProductCode) => AnyProductRole | null;
  /**
   * 指定プロダクトでアサイン操作が可能かどうか。
   * admin / editor / SalesRole を持つユーザーが対象。
   */
  canAssign: (code: ProductCode) => boolean;
  /** 表示用イニシャル文字列 */
  initials: string;
}

/**
 * localStorage の yl_user から現在ログイン中のユーザー情報を取得する hook。
 * SSR-safe: window が存在しない環境では全フィールドが null / false になる。
 */
export function useCurrentUser(): CurrentUserState {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(readStoredUser());
    // storage イベントで他タブからのログアウト等に追随する
    const handler = () => setUser(readStoredUser());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const productRole = (code: ProductCode): AnyProductRole | null =>
    user?.product_roles?.[code] ?? null;

  const salesRole: SalesRole | null = (() => {
    const r = user?.product_roles?.sales;
    return isSalesRole(r) ? r : null;
  })();

  const canAssign = (code: ProductCode): boolean => {
    const r = user?.product_roles?.[code];
    if (!r) return false;
    if (isProductRole(r)) return r === "admin" || r === "editor";
    // SalesRole はいずれもアサイン操作可能
    return isSalesRole(r);
  };

  const initials = user ? getInitials(user.name) : "?";

  return { user, salesRole, productRole, canAssign, initials };
}
