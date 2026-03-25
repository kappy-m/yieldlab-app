"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LogIn, LogOut, Users, Search, RefreshCw,
  ChevronRight, Star, Phone, Mail, BedDouble,
  Clock, AlertCircle,
} from "lucide-react";
import { fetchGuestStays, updateGuestStayStatus, type GuestStayOut, type GuestStayListOut } from "@/lib/api";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Config maps
// ────────────────────────────────────────────────────────────────────────────

type StayStatus = "expected" | "checked_in" | "checked_out" | "no_show" | "cancelled";

const STATUS_CONFIG: Record<StayStatus, { label: string; color: string; bg: string; border: string }> = {
  expected:    { label: "チェックイン待ち", color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  checked_in:  { label: "チェックイン済",   color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  checked_out: { label: "チェックアウト済", color: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-200" },
  no_show:     { label: "ノーショー",        color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200" },
  cancelled:   { label: "キャンセル",        color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
};

const NATIONALITY_FLAGS: Record<string, string> = {
  JP: "🇯🇵", US: "🇺🇸", CN: "🇨🇳", KR: "🇰🇷", FR: "🇫🇷",
  DE: "🇩🇪", GB: "🇬🇧", AU: "🇦🇺", TW: "🇹🇼", HK: "🇭🇰",
};

type ViewMode = "today" | "checkin" | "checkout" | "inhouse" | "all";
const VIEW_TABS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "today",    label: "今日",                 icon: <Clock className="w-3.5 h-3.5" /> },
  { id: "checkin",  label: "チェックイン",          icon: <LogIn className="w-3.5 h-3.5" /> },
  { id: "checkout", label: "チェックアウト",         icon: <LogOut className="w-3.5 h-3.5" /> },
  { id: "inhouse",  label: "在泊",                 icon: <BedDouble className="w-3.5 h-3.5" /> },
];

// ────────────────────────────────────────────────────────────────────────────
// Guest Detail Panel
// ────────────────────────────────────────────────────────────────────────────

interface DetailPanelProps {
  stay: GuestStayOut | null;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}

function GuestDetailPanel({ stay, onClose, onStatusChange }: DetailPanelProps) {
  const isOpen = stay !== null;
  const status = (stay?.status ?? "expected") as StayStatus;
  const cfg = STATUS_CONFIG[status];

  return (
    <>
      <div
        className={cn("fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {stay && (
          <>
            {/* ヘッダー */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-white font-semibold text-sm">{stay.guest_name}</span>
                  {stay.nationality && (
                    <span className="text-sm" title={stay.nationality}>
                      {NATIONALITY_FLAGS[stay.nationality] ?? stay.nationality}
                    </span>
                  )}
                  {stay.is_repeat && (
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-full font-semibold">
                      リピーター
                    </span>
                  )}
                </div>
                <p className="text-white/60 text-xs">{stay.reservation_no}</p>
              </div>
              <button onClick={onClose} className="text-white/60 hover:text-white p-1 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ステータスバッジ */}
              <div className="px-5 py-4 border-b border-slate-50">
                <span className={cn("text-xs font-semibold px-3 py-1.5 rounded-full border", cfg.color, cfg.bg, cfg.border)}>
                  {cfg.label}
                </span>
              </div>

              {/* 滞在情報 */}
              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">滞在情報</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-400 mb-0.5">チェックイン</p>
                      <p className="text-sm font-semibold text-slate-800">{stay.checkin_date}</p>
                      {stay.checkin_time && <p className="text-xs text-slate-500">{stay.checkin_time.slice(0, 5)}</p>}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-400 mb-0.5">チェックアウト</p>
                      <p className="text-sm font-semibold text-slate-800">{stay.checkout_date}</p>
                      {stay.checkout_time && <p className="text-xs text-slate-500">{stay.checkout_time.slice(0, 5)}</p>}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-400 mb-0.5">宿泊数</p>
                      <p className="text-sm font-semibold text-slate-800">{stay.nights} 泊</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-400 mb-0.5">人数</p>
                      <p className="text-sm font-semibold text-slate-800">{stay.guest_count} 名</p>
                    </div>
                  </div>
                </div>

                {/* 部屋情報 */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">部屋情報</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">部屋番号</span>
                      <span className="font-semibold text-slate-800">{stay.room_number ?? "未割当"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">部屋タイプ</span>
                      <span className="font-medium text-slate-700">{stay.room_type ?? "—"}</span>
                    </div>
                    {stay.floor && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">フロア</span>
                        <span className="font-medium text-slate-700">{stay.floor} F</span>
                      </div>
                    )}
                    {stay.plan_name && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">プラン</span>
                        <span className="font-medium text-slate-700 text-right max-w-[60%]">{stay.plan_name}</span>
                      </div>
                    )}
                    {stay.ota_channel && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">予約チャネル</span>
                        <span className="font-medium text-slate-700">{stay.ota_channel}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 連絡先 */}
                {(stay.guest_email || stay.guest_phone) && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">連絡先</p>
                    <div className="space-y-1.5">
                      {stay.guest_email && (
                        <div className="flex items-center gap-2 text-xs text-slate-700">
                          <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{stay.guest_email}</span>
                        </div>
                      )}
                      {stay.guest_phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{stay.guest_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 特記事項 */}
                {stay.special_requests && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">特記事項</p>
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">{stay.special_requests}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* アクションボタン */}
            {status === "expected" && (
              <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 bg-white">
                <button
                  onClick={() => onStatusChange(stay.id, "checked_in")}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white rounded-xl cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%)" }}
                >
                  <LogIn className="w-4 h-4" />
                  チェックインする
                </button>
              </div>
            )}
            {status === "checked_in" && (
              <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 bg-white">
                <button
                  onClick={() => onStatusChange(stay.id, "checked_out")}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white rounded-xl cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] bg-green-600 hover:bg-green-700"
                >
                  <LogOut className="w-4 h-4" />
                  チェックアウトする
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

interface GuestStayListProps {
  propertyId: number;
}

export function GuestStayList({ propertyId }: GuestStayListProps) {
  const [data, setData] = useState<GuestStayListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("today");
  const [search, setSearch] = useState("");
  const [selectedStay, setSelectedStay] = useState<GuestStayOut | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { view };
      if (search.trim()) params.search = search.trim();
      const result = await fetchGuestStays(propertyId, params);
      setData(result);
    } catch (e) {
      console.error("Failed to fetch guest stays:", e);
    } finally {
      setLoading(false);
    }
  }, [propertyId, view, search, refreshKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (stayId: number, newStatus: string) => {
    try {
      const updated = await updateGuestStayStatus(propertyId, stayId, newStatus);
      setData(prev => prev ? {
        ...prev,
        items: prev.items.map(s => s.id === stayId ? updated : s),
      } : null);
      if (selectedStay?.id === stayId) {
        setSelectedStay(updated);
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* KPIサマリー */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <LogIn className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">本日チェックイン</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{data?.today_checkin ?? "—"}</p>
          <p className="text-xs text-slate-400 mt-0.5">件</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <LogOut className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">本日チェックアウト</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{data?.today_checkout ?? "—"}</p>
          <p className="text-xs text-slate-400 mt-0.5">件</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <BedDouble className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">在泊中</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{data?.today_inhouse ?? "—"}</p>
          <p className="text-xs text-slate-400 mt-0.5">室</p>
        </div>
      </div>

      {/* コントロール */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {/* ビュータブ */}
        <div className="flex items-center gap-0.5 px-3 pt-3 pb-0 border-b border-slate-100">
          {VIEW_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap rounded-t-md",
                view === tab.id
                  ? "text-[#1E3A8A]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              {tab.icon}
              {tab.label}
              <span className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A8A] rounded-t transition-transform duration-200 origin-bottom",
                view === tab.id ? "scale-y-100" : "scale-y-0"
              )} />
            </button>
          ))}
        </div>

        {/* 検索バー */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="ゲスト名・予約番号・部屋番号で検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]/40"
            />
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="更新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* リスト */}
        <div className="divide-y divide-slate-50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded animate-pulse w-32" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-48" />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <Users className="w-8 h-8 text-slate-200" />
              <span className="text-sm">該当するゲストが見つかりません</span>
            </div>
          ) : (
            items.map(stay => {
              const status = stay.status as StayStatus;
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.expected;
              const initials = stay.guest_name.split(/\s/).map(s => s[0] ?? "").join("").slice(0, 2).toUpperCase();

              return (
                <button
                  key={stay.id}
                  onClick={() => setSelectedStay(stay)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  {/* アバター */}
                  <div
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold"
                    style={{ background: "linear-gradient(135deg, #1E3A8A, #1e40af)" }}
                  >
                    {initials}
                  </div>

                  {/* メイン情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-slate-800 truncate">{stay.guest_name}</span>
                      {stay.is_repeat && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                      {stay.nationality && (
                        <span className="text-xs flex-shrink-0">{NATIONALITY_FLAGS[stay.nationality] ?? ""}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span>{stay.reservation_no}</span>
                      {stay.room_number && (
                        <span className="flex items-center gap-0.5">
                          <BedDouble className="w-3 h-3" />
                          {stay.room_number}号室
                        </span>
                      )}
                      <span>{stay.checkin_date} → {stay.checkout_date}</span>
                    </div>
                  </div>

                  {/* ステータスバッジ */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap", cfg.color, cfg.bg, cfg.border)}>
                      {cfg.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-50 text-xs text-slate-400">
            {items.length} 件表示
          </div>
        )}
      </div>

      {/* 詳細パネル */}
      <GuestDetailPanel
        stay={selectedStay}
        onClose={() => setSelectedStay(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
