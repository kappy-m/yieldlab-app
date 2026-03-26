"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown, Eye, EyeOff, CalendarDays } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  fetchMonthlyOnhand,
  fetchBookingHeatmap,
  type MonthlyOnhandOut,
  type BookingHeatmapOut,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
const LINE_PALETTE = [
  "#1E3A8A", "#0891B2", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#DB2777", "#065F46", "#92400E", "#0F766E",
  "#1D4ED8", "#0E7490", "#047857", "#B45309", "#B91C1C",
  "#6D28D9", "#BE185D", "#064E3B", "#78350F", "#134E4A",
  "#1E40AF", "#155E75", "#166534", "#854D0E", "#991B1B",
  "#5B21B6", "#9D174D", "#014737", "#451A03", "#022C22",
];

function fmt(n: number) {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `¥${Math.round(n / 10_000)}万`;
  return `¥${n.toLocaleString()}`;
}

// ----------------------------------------------------------------
// カスタムツールチップ
// ----------------------------------------------------------------
interface TooltipPayload { name: string; value: number; color: string; }
interface CustomTooltipProps { active?: boolean; payload?: TooltipPayload[]; label?: string; }

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].filter(p => p.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[180px]">
      <p className="text-xs font-semibold text-slate-700 mb-2 border-b border-slate-100 pb-1.5">{label}</p>
      {sorted.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-slate-600">{entry.name}</span>
          </div>
          <span className="text-xs font-semibold text-slate-900">{Math.round(entry.value)}%</span>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// ピックアップサマリーテーブル
// ----------------------------------------------------------------
function PickupTable({ heatmap, visibleDates }: { heatmap: BookingHeatmapOut; visibleDates: Set<string> }) {
  const ltLen = heatmap.lead_times.length;
  if (ltLen < 2) return null;
  const latestIdx = ltLen - 1;
  const prevIdx = ltLen - 2;

  const rows = heatmap.dates
    .filter(d => visibleDates.has(d))
    .map((date, di) => {
      const latest = heatmap.current_year[di]?.[latestIdx] ?? 0;
      const prev = heatmap.current_year[di]?.[prevIdx] ?? 0;
      const pickup = latest - prev;
      const prevYearLatest = heatmap.prev_year[di]?.[latestIdx] ?? 0;
      const diff = latest - prevYearLatest;
      return { date, latest, pickup, prevYearLatest, diff };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="yl-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">直近ピックアップ（週次速報）</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {heatmap.lead_times[prevIdx]} → {heatmap.lead_times[latestIdx]} の間に積み上がった稼働率
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-5 py-2.5 text-slate-500 font-medium">宿泊日</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">現在稼働率</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">週間ピックアップ</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">前年同期差</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-2.5 font-medium text-slate-700">{row.date}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full",
                          row.latest >= 85 ? "bg-red-400" :
                          row.latest >= 70 ? "bg-orange-400" :
                          row.latest >= 50 ? "bg-green-400" : "bg-blue-400"
                        )}
                        style={{ width: `${Math.min(row.latest, 100)}%` }}
                      />
                    </div>
                    <span className="font-semibold text-slate-900 w-10 text-right">{Math.round(row.latest)}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={cn("inline-flex items-center gap-0.5 font-semibold",
                    row.pickup > 0 ? "text-green-600" : row.pickup < 0 ? "text-red-500" : "text-slate-400"
                  )}>
                    {row.pickup > 0 ? <TrendingUp className="w-3 h-3" /> : row.pickup < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                    {row.pickup > 0 ? "+" : ""}{Math.round(row.pickup)}pt
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={cn("text-xs font-medium",
                    row.diff > 5 ? "text-green-600" : row.diff < -5 ? "text-red-500" : "text-slate-500"
                  )}>
                    {row.diff > 0 ? "+" : ""}{Math.round(row.diff)}pt
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// 180日稼働見通しカレンダー（月別ヒートマップ）
// ----------------------------------------------------------------
function OccupancyForecastCalendar({ monthly }: { monthly: MonthlyOnhandOut[] }) {

  return (
    <div className="yl-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-0.5">
          <CalendarDays className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">180日 稼働見通しカレンダー</h3>
        </div>
        <p className="text-xs text-slate-400">月次の稼働率予測。赤が高稼働（要注意）、青が低稼働（価格調整余地あり）</p>
      </div>
      <div className="px-5 py-5">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {monthly.map((m) => {
            const occ = m.occupancy_pct;
            const color =
              occ >= 85 ? "bg-red-400" :
              occ >= 70 ? "bg-orange-400" :
              occ >= 55 ? "bg-green-400" :
              occ >= 40 ? "bg-blue-400" : "bg-slate-200";
            const textColor =
              occ >= 85 ? "text-red-600" :
              occ >= 70 ? "text-orange-600" :
              occ >= 55 ? "text-green-600" :
              occ >= 40 ? "text-blue-600" : "text-slate-400";

            // 表示用: 0-100%にクランプ（256%超など異常値対応）
            const displayBarPct = Math.min(occ, 100);

            return (
              <div key={`${m.year}-${m.month}`} className="flex flex-col gap-2">
                {/* 月ラベル（固定高さでカラム揃え） */}
                <div className="h-10 flex flex-col justify-end items-center">
                  <p className="text-[10px] text-slate-400 leading-tight">{m.year}</p>
                  <p className="text-xs font-semibold text-slate-700">{m.month}月</p>
                  {m.is_actual
                    ? <span className="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded mt-0.5">実績</span>
                    : <span className="text-[9px] text-transparent px-1 py-0.5 mt-0.5 select-none">-</span>
                  }
                </div>
                {/* バー（absolute bottom-0 で底揃え） */}
                <div className="w-full h-16 bg-slate-100 rounded-lg overflow-hidden relative">
                  <div
                    className={cn("absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-300", color)}
                    style={{ height: `${Math.max(displayBarPct, 6)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("text-xs font-bold relative z-10", textColor)}>{occ}%</span>
                  </div>
                </div>
                {/* 売上 */}
                <p className="text-[10px] text-slate-500 text-center">
                  {fmt(m.revenue)}
                  {m.revenue_change_pct != null && (
                    <span className={cn("ml-0.5", m.revenue_change_pct >= 0 ? "text-green-500" : "text-red-500")}>
                      {m.revenue_change_pct >= 0 ? "↑" : "↓"}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex-wrap">
          {[
            { color: "bg-red-400", label: "85%以上（高稼働）" },
            { color: "bg-orange-400", label: "70-84%（良好）" },
            { color: "bg-green-400", label: "55-69%（標準）" },
            { color: "bg-blue-400", label: "40-54%（余裕あり）" },
            { color: "bg-slate-200", label: "40%未満（要対応）" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-sm", item.color)} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------
type DayRange = 14 | 30;

export function BookingTab({ propertyId }: { propertyId: number }) {
  const [monthly, setMonthly] = useState<MonthlyOnhandOut[]>([]);
  const [heatmap, setHeatmap] = useState<BookingHeatmapOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayRange, setDayRange] = useState<DayRange>(14);
  const [showPrevYear, setShowPrevYear] = useState(false);
  const [visibleDates, setVisibleDates] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, h] = await Promise.all([
        fetchMonthlyOnhand(propertyId, 6), // 180日 = 6ヶ月
        fetchBookingHeatmap(propertyId, dayRange),
      ]);
      setMonthly(m);
      setHeatmap(h);
      setVisibleDates(new Set(h.dates));
    } catch (e) {
      setError("データの取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [propertyId, dayRange]);

  useEffect(() => { load(); }, [load]);

  // ヒートマップ→折れ線グラフ用データ変換
  const chartData = useMemo(() => {
    if (!heatmap) return [];
    return heatmap.lead_times.map((lt, li) => {
      const point: Record<string, number | string> = { lt };
      heatmap.dates.forEach((date, di) => {
        if (visibleDates.has(date)) {
          point[date] = heatmap.current_year[di]?.[li] ?? 0;
          if (showPrevYear) {
            point[`${date}★前年`] = heatmap.prev_year[di]?.[li] ?? 0;
          }
        }
      });
      return point;
    });
  }, [heatmap, visibleDates, showPrevYear]);

  const toggleDate = (date: string) => {
    setVisibleDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) { if (next.size > 1) next.delete(date); }
      else next.add(date);
      return next;
    });
  };

  const toggleAllDates = () => {
    if (!heatmap) return;
    if (visibleDates.size === heatmap.dates.length) setVisibleDates(new Set([heatmap.dates[0] ?? ""]));
    else setVisibleDates(new Set(heatmap.dates));
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="yl-card h-80 bg-slate-100" />
        <div className="yl-card h-48 bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-slate-600">{error}</p>
        <button onClick={load} className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 cursor-pointer">
          再試行
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ================================================================
          Section 1: 180日稼働見通しカレンダー（上部に移動）
      ================================================================ */}
      <OccupancyForecastCalendar monthly={monthly} />

      {/* ================================================================
          Section 2: ブッキングカーブ（直近30日）
      ================================================================ */}
      {heatmap && heatmap.dates.length > 0 && (
        <div className="yl-card overflow-hidden">
          {/* ヘッダー */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">ブッキングカーブ（直近{dayRange}日）</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  宿泊日ごとに何日前から予約が積み上がっているか表示。価格戦略の精度向上に活用できます
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 日数レンジ */}
                <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                  {([14, 30] as DayRange[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setDayRange(d)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        dayRange === d
                          ? "bg-white text-slate-800 font-semibold shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {d}日
                    </button>
                  ))}
                </div>
                {/* 前年比較トグル */}
                <button
                  onClick={() => setShowPrevYear(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer",
                    showPrevYear
                      ? "bg-slate-900 text-white border-slate-900"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  )}
                >
                  {showPrevYear ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  前年比較
                </button>
                <button onClick={load} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 日付フィルター */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                onClick={toggleAllDates}
                className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
              >
                {visibleDates.size === heatmap.dates.length ? "全解除" : "全選択"}
              </button>
              {heatmap.dates.map((date, di) => {
                const isVisible = visibleDates.has(date);
                const color = LINE_PALETTE[di % LINE_PALETTE.length];
                return (
                  <button
                    key={date}
                    onClick={() => toggleDate(date)}
                    className={cn(
                      "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer",
                      isVisible ? "text-white border-transparent" : "border-slate-200 text-slate-400 bg-white hover:border-slate-300"
                    )}
                    style={isVisible ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    {date}
                  </button>
                );
              })}
            </div>
          </div>

          {/* チャート本体 */}
          <div className="px-5 py-5">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="lt" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={38} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={80} stroke="#fbbf24" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: "80%", position: "insideTopRight", fontSize: 10, fill: "#d97706" }} />
                <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} />
                {heatmap.dates.map((date, di) => {
                  if (!visibleDates.has(date)) return null;
                  const color = LINE_PALETTE[di % LINE_PALETTE.length];
                  return [
                    <Line key={date} type="monotone" dataKey={date} stroke={color} strokeWidth={2}
                      dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} name={date} />,
                    showPrevYear && (
                      <Line key={`${date}_prev`} type="monotone" dataKey={`${date}★前年`} stroke={color}
                        strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={`${date}（前年）`} opacity={0.45} />
                    ),
                  ];
                })}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-slate-400" />今年（実線）</div>
              {showPrevYear && <div className="flex items-center gap-1"><div className="w-4 h-0.5" style={{ borderTop: "2px dashed #94a3b8" }} />前年（点線）</div>}
              <div className="flex items-center gap-1"><div className="w-4 h-0.5" style={{ borderTop: "2px dashed #fbbf24" }} />80%ライン</div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          Section 3: ピックアップサマリー
      ================================================================ */}
      {heatmap && heatmap.dates.length > 0 && (
        <PickupTable heatmap={heatmap} visibleDates={visibleDates} />
      )}
    </div>
  );
}
