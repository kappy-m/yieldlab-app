"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  fetchMonthlyOnhand,
  fetchBookingHeatmap,
  type MonthlyOnhandOut,
  type BookingHeatmapOut,
} from "@/lib/api";

function getHeatColor(occ: number): string {
  if (occ === 0) return "bg-gray-50 text-gray-300";
  if (occ < 20) return "bg-blue-100 text-blue-700";
  if (occ < 40) return "bg-blue-200 text-blue-800";
  if (occ < 60) return "bg-blue-400 text-white";
  if (occ < 75) return "bg-green-400 text-white";
  if (occ < 85) return "bg-yellow-400 text-gray-800";
  if (occ < 95) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

function fmt(n: number) {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `¥${Math.round(n / 10_000)}万`;
  return `¥${n.toLocaleString()}`;
}

function changeBadge(pct: number | null | undefined) {
  if (pct == null) return null;
  const color = pct >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
      {pct >= 0 ? "+" : ""}{pct}%
    </span>
  );
}

export function BookingTab({ propertyId }: { propertyId: number }) {
  const [monthly, setMonthly] = useState<MonthlyOnhandOut[]>([]);
  const [heatmap, setHeatmap] = useState<BookingHeatmapOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, h] = await Promise.all([
        fetchMonthlyOnhand(propertyId, 3),
        fetchBookingHeatmap(propertyId, 10),
      ]);
      setMonthly(m);
      setHeatmap(h);
    } catch (e) {
      setError("データの取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <div key={i} className="yl-card h-28 bg-slate-100" />)}
        </div>
        <div className="yl-card h-64 bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-slate-600">{error}</p>
        <button onClick={load} className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700">
          再試行
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 月次サマリーカード */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">月次オンハンドサマリー</h2>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            <RefreshCw className="w-3 h-3" /> 更新
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {monthly.map((m) => (
            <div key={`${m.year}-${m.month}`} className="yl-card p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">{m.label}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${m.is_actual ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-600"}`}>
                  {m.is_actual ? "実績" : "予測"}
                </span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <p className="text-xs text-slate-400">売上</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-base font-bold text-slate-900">{fmt(m.revenue)}</p>
                    {changeBadge(m.revenue_change_pct)}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">稼働率 <span className="font-semibold text-slate-900">{m.occupancy_pct}%</span></span>
                  <span className="text-slate-500">
                    室数 <span className="font-semibold text-slate-900">{m.rooms_sold.toLocaleString()}</span>
                    {changeBadge(m.rooms_change_pct)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ヒートマップ */}
      {heatmap && heatmap.dates.length > 0 && (
        <div className="yl-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">予約ペースヒートマップ（稼働率 %）</h3>
            <p className="text-xs text-slate-400 mt-0.5">各宿泊日に対し、何日前時点で何%の稼働率だったかを示します</p>
          </div>

          <div className="p-5">
            {/* 凡例 */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-xs text-slate-500">稼働率：</span>
              {[
                { label: "0%", cls: "bg-gray-50 text-gray-300" },
                { label: "〜20%", cls: "bg-blue-100 text-blue-700" },
                { label: "〜60%", cls: "bg-blue-400 text-white" },
                { label: "〜75%", cls: "bg-green-400 text-white" },
                { label: "〜85%", cls: "bg-yellow-400 text-gray-800" },
                { label: "〜95%", cls: "bg-orange-400 text-white" },
                { label: "95%+", cls: "bg-red-500 text-white" },
              ].map(({ label, cls }) => (
                <span key={label} className={`text-[10px] px-2 py-0.5 rounded ${cls}`}>{label}</span>
              ))}
            </div>

            <div className="mb-6">
              <p className="text-xs font-medium text-slate-600 mb-2">今年</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full min-w-max">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1 text-slate-400 font-medium min-w-[70px]">宿泊日</th>
                      {heatmap.lead_times.map(lt => (
                        <th key={lt} className="px-2 py-1 text-slate-400 font-medium min-w-[56px] text-center">{lt}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.dates.map((date, di) => (
                      <tr key={date}>
                        <td className="px-2 py-1 font-medium text-slate-600">{date}</td>
                        {heatmap.current_year[di]?.map((occ, li) => (
                          <td key={li} className={`px-2 py-1 text-center rounded mx-0.5 ${getHeatColor(occ)}`}>
                            {occ > 0 ? `${Math.round(occ)}` : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {heatmap.prev_year.some(row => row.some(v => v > 0)) && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">前年同期</p>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full min-w-max">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1 text-slate-300 font-medium min-w-[70px]">宿泊日</th>
                        {heatmap.lead_times.map(lt => (
                          <th key={lt} className="px-2 py-1 text-slate-300 font-medium min-w-[56px] text-center">{lt}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.dates.map((date, di) => (
                        <tr key={date} className="opacity-60">
                          <td className="px-2 py-1 font-medium text-slate-400">{date}</td>
                          {heatmap.prev_year[di]?.map((occ, li) => (
                            <td key={li} className={`px-2 py-1 text-center rounded mx-0.5 ${getHeatColor(occ)}`}>
                              {occ > 0 ? `${Math.round(occ)}` : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
