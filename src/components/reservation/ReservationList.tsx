"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, List, Search, ChevronLeft, ChevronRight,
  ChevronRight as ChevronRightIcon, Users, Clock,
} from "lucide-react";
import { fetchReservations, type ReservationOut, type ReservationListOut } from "@/lib/api";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

type ResStatus = "confirmed" | "pending" | "cancelled" | "no_show" | "modified";

const STATUS_CONFIG: Record<ResStatus, { label: string; color: string; bg: string; border: string }> = {
  confirmed: { label: "確定",      color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  pending:   { label: "仮予約",    color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  cancelled: { label: "キャンセル", color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200" },
  no_show:   { label: "ノーショー", color: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-200" },
  modified:  { label: "変更済み",  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
};

const OTA_COLORS: Record<string, string> = {
  "楽天トラベル": "bg-rose-50 text-rose-700 border-rose-200",
  "Expedia":     "bg-blue-50 text-blue-700 border-blue-200",
  "Booking.com": "bg-sky-50 text-sky-700 border-sky-200",
  "自社サイト":  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "じゃらん":   "bg-orange-50 text-orange-700 border-orange-200",
  "一休.com":   "bg-purple-50 text-purple-700 border-purple-200",
  "直電":       "bg-slate-50 text-slate-600 border-slate-200",
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ────────────────────────────────────────────────────────────────────────────
// Calendar View
// ────────────────────────────────────────────────────────────────────────────

interface CalendarProps {
  year: number;
  month: number;
  monthlyCounts: Record<string, number>;
  onDayClick: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

function ReservationCalendar({ year, month, monthlyCounts, onDayClick, onMonthChange }: CalendarProps) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay(); // 0=日
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const cells: (null | number)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // 6週分になるようにパディング
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-slate-800">
          {year}年 {month}月
        </h3>
        <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn(
            "text-center text-[10px] font-semibold py-1",
            i === 0 ? "text-rose-500" : i === 6 ? "text-blue-500" : "text-slate-400"
          )}>
            {d}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = monthlyCounts[dateStr] ?? 0;
          const isToday = dateStr === todayStr;
          const dow = idx % 7;

          return (
            <button
              key={dateStr}
              onClick={() => count > 0 && onDayClick(dateStr)}
              className={cn(
                "relative flex flex-col items-center py-1.5 rounded-lg transition-colors",
                count > 0 ? "cursor-pointer hover:bg-blue-50" : "cursor-default",
                isToday ? "bg-brand-navy/10 font-bold" : ""
              )}
            >
              <span className={cn(
                "text-xs",
                isToday ? "text-brand-navy font-bold" :
                dow === 0 ? "text-rose-500" :
                dow === 6 ? "text-blue-500" :
                "text-slate-700"
              )}>
                {day}
              </span>
              {count > 0 && (
                <span className="mt-0.5 text-[10px] font-semibold text-brand-navy bg-blue-50 rounded-full px-1 min-w-[18px] text-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

interface ReservationListProps {
  propertyId: number;
}

export function ReservationList({ propertyId }: ReservationListProps) {
  const now = new Date();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [data, setData] = useState<ReservationListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReservationOut | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        month: `${calYear}-${String(calMonth).padStart(2, "0")}`,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      const result = await fetchReservations(propertyId, params);
      setData(result);
    } catch (e) {
      console.error("Failed to fetch reservations:", e);
    } finally {
      setLoading(false);
    }
  }, [propertyId, calYear, calMonth, search, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDayClick = (date: string) => {
    // カレンダー日付クリック → リストビューに切り替えて検索
    setSearch(date);
    setViewMode("list");
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* ビュー切り替え */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <button
            onClick={() => setViewMode("list")}
            className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
              viewMode === "list" ? "bg-brand-navy text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <List className="w-3.5 h-3.5" />
            リスト
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
              viewMode === "calendar" ? "bg-brand-navy text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            カレンダー
          </button>
        </div>

        {/* 検索 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="ゲスト名・予約番号で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy/40"
          />
        </div>

        {/* ステータスフィルタ */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="py-2 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 cursor-pointer"
        >
          <option value="all">全ステータス</option>
          <option value="confirmed">確定</option>
          <option value="pending">仮予約</option>
          <option value="cancelled">キャンセル</option>
        </select>
      </div>

      {viewMode === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <ReservationCalendar
              year={calYear}
              month={calMonth}
              monthlyCounts={data?.monthly_counts ?? {}}
              onDayClick={handleDayClick}
              onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
            />
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">
                  {calYear}年{calMonth}月 — {items.length}件の予約
                </p>
              </div>
              <ReservationTable items={items.slice(0, 15)} loading={loading} onSelect={setSelected} />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              {calYear}年{calMonth}月 — {loading ? "..." : `${data?.total ?? 0}件`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); } else setCalMonth(m => m - 1); }}
                className="p-1 hover:bg-slate-100 rounded cursor-pointer text-slate-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => { if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); } else setCalMonth(m => m + 1); }}
                className="p-1 hover:bg-slate-100 rounded cursor-pointer text-slate-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <ReservationTable items={items} loading={loading} onSelect={setSelected} />
        </div>
      )}

      {/* 詳細パネル（簡易版） */}
      {selected && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelected(null)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-gradient-to-br from-brand-navy to-blue-800">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{selected.guest_name}</p>
                <p className="text-white/60 text-xs">{selected.reservation_no}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/60 hover:text-white p-1 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 mb-0.5">チェックイン</p>
                  <p className="text-sm font-semibold text-slate-800">{selected.checkin_date}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 mb-0.5">チェックアウト</p>
                  <p className="text-sm font-semibold text-slate-800">{selected.checkout_date}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 mb-0.5">宿泊数</p>
                  <p className="text-sm font-semibold text-slate-800">{selected.nights} 泊</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 mb-0.5">人数</p>
                  <p className="text-sm font-semibold text-slate-800">{selected.guest_count} 名</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                {selected.room_type && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">部屋タイプ</span>
                    <span className="font-medium text-slate-700">{selected.room_type}</span>
                  </div>
                )}
                {selected.plan_name && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">プラン</span>
                    <span className="font-medium text-slate-700 text-right">{selected.plan_name}</span>
                  </div>
                )}
                {selected.total_amount && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">合計金額</span>
                    <span className="font-semibold text-slate-800">
                      ¥{selected.total_amount.toLocaleString()}
                    </span>
                  </div>
                )}
                {selected.ota_channel && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">チャネル</span>
                    <span className="font-medium text-slate-700">{selected.ota_channel}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">予約日</span>
                  <span className="font-medium text-slate-700">{selected.booking_date}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Table sub-component
// ────────────────────────────────────────────────────────────────────────────

function ReservationTable({
  items, loading, onSelect,
}: {
  items: ReservationOut[];
  loading: boolean;
  onSelect: (r: ReservationOut) => void;
}) {
  if (loading) {
    return (
      <div className="divide-y divide-slate-50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-slate-100 rounded animate-pulse w-40" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
        <Calendar className="w-8 h-8 text-slate-200" />
        <span className="text-sm">予約が見つかりません</span>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-50">
      {items.map(res => {
        const st = (res.status as ResStatus) ?? "confirmed";
        const stCfg = STATUS_CONFIG[st] ?? STATUS_CONFIG.confirmed;
        const otaClass = OTA_COLORS[res.ota_channel ?? ""] ?? "bg-slate-50 text-slate-600 border-slate-200";

        return (
          <button
            key={res.id}
            onClick={() => onSelect(res)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 text-left cursor-pointer transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">{res.guest_name}</span>
                {res.ota_channel && (
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", otaClass)}>
                    {res.ota_channel}
                  </span>
                )}
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", stCfg.color, stCfg.bg, stCfg.border)}>
                  {stCfg.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {res.checkin_date} → {res.checkout_date}（{res.nights}泊）
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {res.guest_count}名
                </span>
                {res.total_amount && (
                  <span className="font-medium text-slate-600">
                    ¥{res.total_amount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-slate-300 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
