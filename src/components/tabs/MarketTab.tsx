"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Calendar, TrendingUp, AlertTriangle, RefreshCw, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchMarketEvents, type MarketEventOut } from "@/lib/api";
import { Skeleton, SkeletonEventCards } from "@/components/shared/Skeleton";

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const SEEN_KEY = (propertyId: number) => `yl_seen_events_${propertyId}`;

const IMPACT_BADGE: Record<string, string> = {
  "影響大": "text-green-700 bg-green-50 border border-green-200",
  "影響中": "text-yellow-700 bg-yellow-50 border border-yellow-200",
  "影響小": "text-gray-500 bg-gray-50 border border-gray-200",
};

const IMPACT_DOT: Record<string, string> = {
  "影響大": "bg-green-500",
  "影響中": "bg-yellow-400",
  "影響小": "bg-slate-300",
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  holiday:  { label: "祝日",   cls: "text-red-600 bg-red-50 border border-red-200" },
  seasonal: { label: "季節需要", cls: "text-blue-600 bg-blue-50 border border-blue-200" },
};

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------
function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()] ?? ""})`;
  return start === end ? fmt(s) : `${fmt(s)} 〜 ${fmt(e)}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  const month = parseInt(m ?? "1");
  const MONTHS_JA = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  return `${y}年 ${MONTHS_JA[(month - 1) % 12]}`;
}

// ----------------------------------------------------------------
// イベントカード
// ----------------------------------------------------------------
function EventCard({ ev, isNew }: { ev: MarketEventOut; isNew: boolean }) {
  const days = daysUntil(ev.date_start);
  const dateLabel = formatDateRange(ev.date_start, ev.date_end);
  const src = SOURCE_BADGE[ev.source] ?? SOURCE_BADGE.seasonal!;
  const isOngoing = days < 0;
  const isUrgent = !isOngoing && days <= 14;

  return (
    <div className={cn(
      "px-5 py-4 hover:bg-gray-50/50 transition-colors relative",
      isNew && "bg-amber-50/40",
    )}>
      {/* NEW帯 */}
      {isNew && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l-none" />
      )}
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div className="text-xl w-8 flex-shrink-0 flex items-center justify-center mt-0.5">
          {ev.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">{ev.name}</span>
              {isNew && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-white">
                  <Sparkles className="w-2.5 h-2.5" /> NEW
                </span>
              )}
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", src.cls)}>
                {src.label}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5", IMPACT_DOT[ev.impact])} />
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", IMPACT_BADGE[ev.impact])}>
                {ev.impact}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-1.5 flex-wrap">
            <span>{dateLabel}</span>
            {ev.venue !== "国民の祝日" && <span className="text-gray-400">{ev.venue}</span>}
            <span className={cn(
              "font-medium",
              isOngoing ? "text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200" :
              isUrgent ? "text-red-500" :
              days <= 30 ? "text-orange-500" : "text-slate-400"
            )}>
              {isOngoing ? "開催中" : days === 0 ? "本日" : `あと${days}日`}
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{ev.desc}</p>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// 月グループ（折りたたみ）
// ----------------------------------------------------------------
function MonthGroup({
  monthKey, events, newIds, defaultExpanded,
}: {
  monthKey: string;
  events: MarketEventOut[];
  newIds: Set<string>;
  defaultExpanded: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const newCount = events.filter(e => newIds.has(e.id)).length;
  const bigCount = events.filter(e => e.impact === "影響大").length;
  const isCurrentMonth = monthKey === getMonthKey(new Date().toISOString().slice(0, 10));

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className={cn(
            "text-sm font-semibold",
            isCurrentMonth ? "text-blue-600" : "text-slate-800"
          )}>
            {formatMonthLabel(monthKey)}
            {isCurrentMonth && (
              <span className="ml-2 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">今月</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">{events.length}件</span>
            {bigCount > 0 && (
              <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                影響大 {bigCount}件
              </span>
            )}
            {newCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-white">
                <Sparkles className="w-2.5 h-2.5" /> NEW {newCount}
              </span>
            )}
          </div>
        </div>
        {/* ミニインパクトバー */}
        <div className="flex items-center gap-0.5">
          {events.slice(0, 8).map((ev) => (
            <div
              key={ev.id}
              className={cn("w-2 h-4 rounded-full opacity-70", IMPACT_DOT[ev.impact])}
              title={ev.name}
            />
          ))}
          {events.length > 8 && (
            <span className="text-[10px] text-slate-400 ml-0.5">+{events.length - 8}</span>
          )}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-50">
          {events.map(ev => (
            <EventCard key={ev.id} ev={ev} isNew={newIds.has(ev.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------
export function MarketTab({ propertyId }: { propertyId: number }) {
  const [events, setEvents] = useState<MarketEventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [filterImpact, setFilterImpact] = useState<string>("all");
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMarketEvents(propertyId, 180);
      setEvents(data);
      setLastUpdated(new Date().toLocaleString("ja-JP", {
        month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
      }));

      // NEWイベント判定: 前回記録していないIDを「新規発見」とみなす
          const currentIds = data.map(e => e.id);
      try {
        const stored = localStorage.getItem(SEEN_KEY(propertyId));
        if (stored) {
          const seenIds = new Set<string>(JSON.parse(stored) as string[]);
          const newIds = new Set<string>(currentIds.filter(id => !seenIds.has(id)));
          setNewEventIds(newIds);
        } else {
          // 初回: 全件を既読として保存（次回以降にNEWを検出）
          setNewEventIds(new Set());
        }
        // 現在のIDセットを保存
        localStorage.setItem(SEEN_KEY(propertyId), JSON.stringify(currentIds));
      } catch { /* localStorage未対応環境では無視 */ }
    } catch (e) {
      console.error("Market events fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    filterImpact === "all" ? events : events.filter(e => e.impact === filterImpact),
    [events, filterImpact]
  );

  // 月別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, MarketEventOut[]>();
    for (const ev of filtered) {
      const key = getMonthKey(ev.date_start);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const bigCount = events.filter(e => e.impact === "影響大").length;
  const medCount = events.filter(e => e.impact === "影響中").length;
  const holidayCount = events.filter(e => e.source === "holiday").length;
  const newCount = newEventIds.size;

  // 直近14日以内の高インパクトイベント
  const urgent = events.filter(e => e.impact === "影響大" && daysUntil(e.date_start) >= 0 && daysUntil(e.date_start) <= 14);

  // 現在月のキー
  const currentMonthKey = getMonthKey(new Date().toISOString().slice(0, 10));

  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="yl-card px-4 py-3 min-w-[120px] space-y-1.5">
              <Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        <div className="yl-card p-5 space-y-2">
          <Skeleton className="h-3.5 w-28 mb-4" /><SkeletonEventCards count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          祝日・季節イベント・需要トレンド（今後180日間）{lastUpdated && `　最終更新: ${lastUpdated}`}
        </p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />更新
        </button>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="yl-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">祝日・連休</div>
            <div className="text-2xl font-bold text-gray-900">{holidayCount}<span className="text-sm font-normal text-gray-400 ml-1">件</span></div>
          </div>
        </div>
        <div className="yl-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">影響大イベント</div>
            <div className="text-2xl font-bold text-green-600">{bigCount}<span className="text-sm font-normal text-gray-400 ml-1">件</span></div>
          </div>
        </div>
        <div className="yl-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">影響中イベント</div>
            <div className="text-2xl font-bold text-yellow-600">{medCount}<span className="text-sm font-normal text-gray-400 ml-1">件</span></div>
          </div>
        </div>
        {/* NEWイベントカード */}
        <div className={cn(
          "yl-card p-4 flex items-center gap-3 transition-all",
          newCount > 0 ? "border-amber-200 bg-amber-50/50" : ""
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            newCount > 0 ? "bg-amber-100" : "bg-slate-50"
          )}>
            <Sparkles className={cn("w-5 h-5", newCount > 0 ? "text-amber-500" : "text-slate-300")} />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">新規発見</div>
            <div className={cn("text-2xl font-bold", newCount > 0 ? "text-amber-500" : "text-gray-300")}>
              {newCount}<span className="text-sm font-normal text-gray-400 ml-1">件</span>
            </div>
          </div>
        </div>
      </div>

      {/* 直近アラート */}
      {urgent.length > 0 && (
        <div className="yl-card p-4 border-l-4 border-green-400 bg-green-50/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">直近14日の高インパクトイベント</span>
          </div>
          <div className="space-y-1">
            {urgent.map(ev => {
              const days = daysUntil(ev.date_start);
              return (
                <div key={ev.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{ev.icon} {ev.name}
                    {newEventIds.has(ev.id) && (
                      <span className="ml-1.5 text-[9px] font-bold bg-amber-400 text-white px-1 py-0.5 rounded">NEW</span>
                    )}
                  </span>
                  <span className="text-green-600 font-medium text-xs">
                    {days === 0 ? "本日" : `あと${days}日`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* フィルター + イベントリスト（月別グループ） */}
      <div className="yl-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">周辺イベント・需要カレンダー</h3>
            <span className="text-xs font-normal text-gray-400">今後180日間 · {events.length}件</span>
          </div>
          {/* フィルター */}
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {["all", "影響大", "影響中", "影響小"].map(f => (
              <button
                key={f}
                onClick={() => setFilterImpact(f)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  filterImpact === f
                    ? "bg-white text-slate-800 font-semibold shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {f === "all" ? "すべて" : f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            該当するイベントがありません
          </div>
        ) : (
          <div>
            {grouped.map(([monthKey, monthEvents]) => (
              <MonthGroup
                key={monthKey}
                monthKey={monthKey}
                events={monthEvents}
                newIds={newEventIds}
                defaultExpanded={monthKey === currentMonthKey}
              />
            ))}
          </div>
        )}

        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] text-slate-400">
            祝日データ: 内閣府「国民の祝日」準拠 　季節イベント: エリア需要パターン
            {newCount > 0 && (
              <span className="ml-3 text-amber-500 font-medium">
                ★ 前回読み込み時から{newCount}件の新規イベントを検出
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
