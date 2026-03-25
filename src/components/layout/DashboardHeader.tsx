"use client";

import { Building2, Star, MapPin, ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchProperties, logout } from "@/lib/api";

const PRODUCT_LABELS: Record<string, string> = {
  yield: "manage",
  manage: "front",
  review: "review",
  reservation: "reservation",
};

interface Property {
  id: number;
  name: string;
  brand?: string | null;
  address?: string | null;
  star_rating?: number | null;
  total_rooms?: number | null;
}

interface DashboardHeaderProps {
  propertyId: number;
  onPropertyChange: (id: number) => void;
}

export function DashboardHeader({ propertyId, onPropertyChange }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [properties, setProperties] = useState<Property[]>([]);
  const [open, setOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string>("");

  // 現在のプロダクトラベルをパスから取得
  const currentProductLabel = (() => {
    const segment = pathname.split("/")[1] ?? "";
    return PRODUCT_LABELS[segment] ?? "manage";
  })();

  // ユーザー名からイニシャルを生成（最大2文字）
  const avatarInitials = (() => {
    if (!userName) return "–";
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return userName.slice(0, 2).toUpperCase();
  })();

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("yl_user") ?? "{}");
      setUserName(user.name ?? "");
    } catch { /* no-op */ }
  }, []);

  useEffect(() => {
    fetchProperties().then((list) => {
      if (list && list.length > 0) setProperties(list);
    }).catch(() => {});
  }, []);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = properties.find(p => p.id === propertyId) ?? properties[0];

  return (
    <header
      className="sticky top-0 z-50 border-b border-slate-200/80"
      style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%)" }}
    >
      <div className="px-6 py-0 flex items-center justify-between h-14">
        {/* ロゴ（クリックでYieldへ） */}
        <Link href="/yield" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20 group-hover:bg-white/20 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 18L9 6L15 14L19 8L21 18H3Z" fill="#CA8A04" stroke="#CA8A04" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-semibold text-base tracking-tight leading-none">Yieldlab</span>
            <span className="text-sm font-light leading-none" style={{ color: "#CA8A04" }}>{currentProductLabel}</span>
          </div>
        </Link>

        {/* 右側：プロパティスイッチャー + アバター */}
        <div className="flex items-center gap-3">

          {/* プロパティスイッチャー */}
          {current && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2.5 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                <div className="flex flex-col leading-tight text-left">
                  <span className="text-white text-xs font-medium">{current.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {current.address && (
                      <span className="text-white/50 text-[10px] flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {current.address.replace("東京都", "").split("区")[0]}区
                      </span>
                    )}
                    {current.star_rating && (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: current.star_rating }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-current" style={{ color: "#CA8A04" }} />
                        ))}
                      </span>
                    )}
                    {current.total_rooms && (
                      <span className="text-white/50 text-[10px]">{current.total_rooms}室</span>
                    )}
                  </div>
                </div>
                {properties.length > 1 && (
                  <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
                )}
              </button>

              {/* ドロップダウン */}
              {open && properties.length > 1 && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">物件を切り替える</p>
                  </div>
                  {properties.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { onPropertyChange(p.id); setOpen(false); }}
                      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer ${p.id === propertyId ? "bg-blue-50/60" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${p.id === propertyId ? "bg-blue-100" : "bg-slate-100"}`}>
                        <Building2 className={`w-4 h-4 ${p.id === propertyId ? "text-blue-600" : "text-slate-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold leading-tight ${p.id === propertyId ? "text-blue-700" : "text-slate-700"}`}>
                            {p.name}
                          </span>
                          {p.id === propertyId && (
                            <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded flex-shrink-0">表示中</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.address && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />{p.address}
                            </span>
                          )}
                        </div>
                        {p.total_rooms && (
                          <span className="text-[11px] text-slate-400">{p.total_rooms}室</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* アバター（アカウントメニュー） */}
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setAvatarOpen(v => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border border-white/20 hover:ring-2 hover:ring-white/30 transition-all cursor-pointer"
              style={{ background: "#CA8A04", color: "#1E3A8A" }}
            >
              {avatarInitials}
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">{userName || "ユーザー"}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">YieldLab</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    設定
                  </Link>
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    onClick={async () => {
                      setAvatarOpen(false);
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
      </div>
    </header>
  );
}
