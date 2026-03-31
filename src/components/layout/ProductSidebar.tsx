"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  TrendingUp,
  Building2,
  Star,
  Calendar,
  Briefcase,
  MapPin,
  User,
  LogOut,
  Search,
  X,
} from "lucide-react";
import { fetchProperties, logout } from "@/lib/api";
import { useProperty } from "@/hooks/useProperty";

const PRODUCTS = [
  {
    code: "yield",
    label: "Manage",
    icon: TrendingUp,
    href: "/yield",
    description: "レベニューマネジメント",
  },
  {
    code: "manage",
    label: "Front",
    icon: Building2,
    href: "/manage",
    description: "フロント業務管理",
  },
  {
    code: "review",
    label: "Review",
    icon: Star,
    href: "/review",
    description: "口コミ・評価管理",
  },
  {
    code: "reservation",
    label: "Reservation",
    icon: Calendar,
    href: "/reservation",
    description: "予約管理",
  },
  {
    code: "sales",
    label: "Sales",
    icon: Briefcase,
    href: "/sales",
    description: "法人営業・グループ管理",
  },
] as const;

interface Property {
  id: number;
  name: string;
  brand?: string | null;
  address?: string | null;
  star_rating?: number | null;
  total_rooms?: number | null;
}

export function ProductSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [propertyId, setPropertyId] = useProperty();
  const [productRoles, setProductRoles] = useState<Record<string, string> | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [propOpen, setPropOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [propSearch, setPropSearch] = useState("");
  const propRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // SSR/ハイドレーション中は null → サイドバー非表示
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("yl_user") ?? "{}");
      setProductRoles(user.product_roles ?? {});
      setUserName(user.name ?? "");
    } catch {
      setProductRoles({});
    }
  }, []);

  useEffect(() => {
    fetchProperties()
      .then((list) => { if (list && list.length > 0) setProperties(list); })
      .catch(() => {});
  }, []);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (propRef.current && !propRef.current.contains(e.target as Node)) { setPropOpen(false); setPropSearch(""); }
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (productRoles === null) return null;

  const accessibleProducts = PRODUCTS.filter((p) => productRoles[p.code]);
  if (accessibleProducts.length <= 1) return null;

  const currentProperty = properties.find((p) => p.id === propertyId) ?? properties[0];

  const filteredProperties = propSearch.trim()
    ? properties.filter(
        (p) =>
          p.name.toLowerCase().includes(propSearch.toLowerCase()) ||
          (p.address ?? "").toLowerCase().includes(propSearch.toLowerCase()) ||
          (p.brand ?? "").toLowerCase().includes(propSearch.toLowerCase())
      )
    : properties;

  // ユーザーイニシャル（最大2文字）
  const avatarInitials = (() => {
    if (!userName) return "–";
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return userName.slice(0, 2).toUpperCase();
  })();

  return (
    <aside
      className="sticky top-0 h-screen w-12 flex-shrink-0 flex flex-col border-r border-white/10 z-40 bg-gradient-to-b from-brand-navy to-blue-800"
    >
      {/* ヘッダー（h-14 = 56px）分の余白 */}
      <div className="h-14 flex-shrink-0" />

      {/* プロダクトナビゲーション */}
      <nav className="flex flex-col items-center py-3 gap-0.5 flex-1" aria-label="プロダクト切り替え">
        {accessibleProducts.map((product) => {
          const Icon = product.icon;
          const isActive = pathname.startsWith(product.href);

          return (
            <div key={product.code} className="relative group w-full">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full transition-all duration-200"
                style={{
                  height: isActive ? "28px" : "0px",
                  background: "#CA8A04",
                  opacity: isActive ? 1 : 0,
                }}
              />
              <Link
                href={product.href}
                className={`
                  flex items-center justify-center w-12 h-11 transition-all duration-200 rounded-none
                  ${isActive
                    ? "text-white"
                    : "text-white/40 hover:text-white/90 hover:bg-white/10"
                  }
                `}
                aria-label={product.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
              </Link>
              {/* ホバーツールチップ */}
              <div
                className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 z-50 shadow-xl"
                style={{ background: "rgba(15, 23, 42, 0.95)" }}
              >
                <p className="text-white text-xs font-semibold leading-none">{product.label}</p>
                <p className="text-white/50 text-[10px] mt-0.5 leading-none">{product.description}</p>
                <div
                  className="absolute right-full top-1/2 -translate-y-1/2"
                  style={{
                    width: 0, height: 0,
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderRight: "5px solid rgba(15, 23, 42, 0.95)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </nav>

      {/* ボトムセクション：ホテル切り替え + ユーザーメニュー */}
      <div className="flex flex-col items-center pb-3 pt-2 gap-0.5 border-t border-white/10">

        {/* ホテル切り替え */}
        <div className="relative group w-full" ref={propRef}>
          <button
            onClick={() => { setPropOpen((v) => { if (v) setPropSearch(""); return !v; }); setUserOpen(false); }}
            className={`
              flex items-center justify-center w-12 h-11 transition-all duration-200
              ${propOpen ? "text-white bg-white/15" : "text-white/40 hover:text-white/90 hover:bg-white/10"}
            `}
            aria-label="ホテル切り替え"
          >
            <Building2 className="w-5 h-5 flex-shrink-0" />
          </button>

          {/* ホバーツールチップ（ドロップダウン非表示時のみ） */}
          {!propOpen && (
            <div
              className="absolute left-full bottom-0 ml-2 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 z-50 shadow-xl"
              style={{ background: "rgba(15, 23, 42, 0.95)" }}
            >
              <p className="text-white text-xs font-semibold leading-none">
                {currentProperty?.name ?? "ホテル選択"}
              </p>
              {currentProperty?.address && (
                <p className="text-white/50 text-[10px] mt-0.5 leading-none flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {currentProperty.address.replace("東京都", "").split("区")[0]}区
                </p>
              )}
              <div
                className="absolute right-full top-1/2 -translate-y-1/2"
                style={{
                  width: 0, height: 0,
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  borderRight: "5px solid rgba(15, 23, 42, 0.95)",
                }}
              />
            </div>
          )}

          {/* ホテル切り替えドロップダウン（右側・下から上へ展開） */}
          {propOpen && properties.length > 0 && (
            <div className="absolute left-full bottom-0 ml-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 flex flex-col" style={{ maxHeight: "min(420px, calc(100vh - 120px))" }}>

              {/* ヘッダー */}
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">物件を切り替える</p>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {filteredProperties.length}/{properties.length}件
                </span>
              </div>

              {/* 検索バー */}
              <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200 focus-within:border-blue-400 focus-within:bg-white transition-colors">
                  <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={propSearch}
                    onChange={(e) => setPropSearch(e.target.value)}
                    placeholder="ホテル名・住所で絞り込み..."
                    className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none"
                    autoFocus
                  />
                  {propSearch && (
                    <button
                      onClick={() => setPropSearch("")}
                      className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 cursor-pointer"
                      aria-label="検索をクリア"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* スクロール可能なリスト */}
              <div className="overflow-y-auto flex-1">
                {filteredProperties.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Building2 className="w-5 h-5 text-slate-300" />
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      「{propSearch}」に一致する物件がありません
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">別のキーワードで検索してください</p>
                  </div>
                ) : (
                  filteredProperties.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPropertyId(p.id); setPropOpen(false); setPropSearch(""); }}
                      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer ${p.id === propertyId ? "bg-blue-50/60" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${p.id === propertyId ? "bg-blue-100" : "bg-slate-100"}`}>
                        <Building2 className={`w-4 h-4 ${p.id === propertyId ? "text-blue-600" : "text-slate-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold leading-tight truncate ${p.id === propertyId ? "text-blue-700" : "text-slate-700"}`}>
                            {p.name}
                          </span>
                          {p.id === propertyId && (
                            <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded flex-shrink-0">表示中</span>
                          )}
                        </div>
                        {p.address && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-0.5 mt-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />{p.address}
                          </p>
                        )}
                        {p.total_rooms && (
                          <p className="text-[11px] text-slate-400">{p.total_rooms}室</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ユーザーアバター */}
        <div className="relative group w-full" ref={userRef}>
          <button
            onClick={() => { setUserOpen((v) => !v); setPropOpen(false); }}
            className="flex items-center justify-center w-12 h-11 transition-all duration-200"
            aria-label="アカウントメニュー"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 transition-all duration-200 bg-yellow-600 text-brand-navy ${userOpen ? "border-white/60 ring-2 ring-white/30" : "border-white/20 hover:border-white/40 hover:ring-2 hover:ring-white/20"}`}
            >
              {avatarInitials}
            </div>
          </button>

          {/* ホバーツールチップ（ドロップダウン非表示時のみ） */}
          {!userOpen && (
            <div
              className="absolute left-full bottom-0 ml-2 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 z-50 shadow-xl"
              style={{ background: "rgba(15, 23, 42, 0.95)" }}
            >
              <p className="text-white text-xs font-semibold leading-none">{userName || "ユーザー"}</p>
              <p className="text-white/50 text-[10px] mt-0.5 leading-none">YieldLab</p>
              <div
                className="absolute right-full top-1/2 -translate-y-1/2"
                style={{
                  width: 0, height: 0,
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  borderRight: "5px solid rgba(15, 23, 42, 0.95)",
                }}
              />
            </div>
          )}

          {/* ユーザーメニュードロップダウン */}
          {userOpen && (
            <div className="absolute left-full bottom-0 ml-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-700">{userName || "ユーザー"}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">YieldLab</p>
              </div>
              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  設定
                </Link>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  onClick={async () => {
                    setUserOpen(false);
                    await logout();
                    router.replace("/login");
                  }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ログアウト
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
