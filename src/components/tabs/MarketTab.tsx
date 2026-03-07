"use client";

import { useEffect, useState, useMemo } from "react";
import { Calendar, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchMarketEvents, type MarketEventOut } from "@/lib/api";
import { Skeleton, SkeletonEventCards } from "@/components/shared/Skeleton";

const IMPACT_BADGE: Record<string, string> = {
  "影響大": "text-green-700 bg-green-50 border border-green-200",
  "影響中": "text-yellow-700 bg-yellow-50 border border-yellow-200",
  "影響小": "text-gray-500 bg-gray-50 border border-gray-200",
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  holiday: { label: "祝日", cls: "text-red-600 bg-red-50 border border-red-200" },
  seasonal: { label: "季節需要", cls: "text-blue-600 bg-blue-50 border border-blue-200" },
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
  return start === end ? fmt(s) : `${fmt(s)}〜${fmt(e)}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function MarketTab({ propertyId }: { propertyId: number }) {
  const [events, setEvents] = useState<MarketEventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [filterImpact, setFilterImpact] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchMarketEvents(propertyId, 90);
      setEvents(data);
      setLastUpdated(new Date().toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error("Market events fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    filterImpact === "all" ? events : events.filter(e => e.impact === filterImpact),
    [events, filterImpact]
  );

  const bigCount = events.filter(e => e.impact === "影響大").length;
  const medCount = events.filter(e => e.impact === "影響中").length;
  const holidayCount = events.filter(e => e.source === "holiday").length;

  // 直近7日以内の高インパクトイベント
  const urgent = events.filter(e => e.impact === "影響大" && daysUntil(e.date_start) <= 14);

  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        {/* KPIバッジ */}
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="yl-card px-4 py-3 min-w-[120px] space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        {/* アラート */}
        <div className="yl-card p-4 space-y-2">
          <Skeleton className="h-3.5 w-32 mb-3" />
          <SkeletonEventCards count={2} />
        </div>
        {/* イベントリスト */}
        <div className="yl-card p-5 space-y-2">
          <Skeleton className="h-3.5 w-28 mb-4" />
          <SkeletonEventCards count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 mt-0.5">
            祝日・季節イベント・需要トレンド（今後90日間）{lastUpdated && `　最終更新: ${lastUpdated}`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          更新
        </button>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-3 gap-4">
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
                  <span className="text-slate-700">{ev.icon} {ev.name}</span>
                  <span className="text-green-600 font-medium text-xs">
                    {days <= 0 ? "開催中" : `あと${days}日`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* フィルター + イベントリスト */}
      <div className="yl-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            周辺イベント・需要カレンダー
            <span className="text-xs font-normal text-gray-400 ml-2">今後90日間</span>
          </h3>
          {/* フィルター */}
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
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
          <div className="divide-y divide-gray-50">
            {filtered.map((ev) => {
              const days = daysUntil(ev.date_start);
              const dateLabel = formatDateRange(ev.date_start, ev.date_end);
              const src = SOURCE_BADGE[ev.source] ?? SOURCE_BADGE.seasonal;

              return (
                <div key={ev.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* アイコン */}
                    <div className="text-2xl w-9 flex-shrink-0 flex items-center justify-center mt-0.5">
                      {ev.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{ev.name}</span>
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", src.cls)}>
                            {src.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", IMPACT_BADGE[ev.impact])}>
                            {ev.impact}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-1.5">
                        <span>📅 {dateLabel}</span>
                        {ev.venue !== "国民の祝日" && <span>📍 {ev.venue}</span>}
                        <span className={cn(
                          "font-medium",
                          days < 0 ? "text-slate-400" : days <= 7 ? "text-red-500" : days <= 30 ? "text-orange-500" : "text-slate-400"
                        )}>
                          {days < 0 ? "開催中" : days === 0 ? "本日" : `あと${days}日`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{ev.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] text-slate-400">
            祝日データ: holidays-jp.github.io（内閣府「国民の祝日」準拠）　季節イベント: 日本橋エリア需要パターン
          </p>
        </div>
      </div>
    </div>
  );
}
