"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { AlertCircle, Save } from "lucide-react";
import { fetchBudget, upsertBudget, fetchCostSummary, type BudgetTargetOut, type CostSummaryOut } from "@/lib/api";

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `¥${n.toLocaleString()}`;
}

function pctBadge(rate: number | null | undefined) {
  if (rate == null) return null;
  const color = rate >= 100 ? "bg-green-100 text-green-700" : rate >= 90 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{rate}%</span>;
}

export function BudgetTab({ propertyId }: { propertyId: number }) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [budgets, setBudgets] = useState<BudgetTargetOut[]>([]);
  const [summaries, setSummaries] = useState<CostSummaryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<BudgetTargetOut>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, s] = await Promise.all([
        fetchBudget(propertyId, year),
        fetchCostSummary(propertyId, 6),
      ]);
      setBudgets(b);
      setSummaries(s);
    } catch (e) {
      setError("データの取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [propertyId, year]);

  useEffect(() => { load(); }, [load]);

  const getBudget = (month: number) => budgets.find(b => b.month === month);
  const getSummary = (month: number) => summaries.find(s => s.month === month && s.year === year);

  const startEdit = (month: number) => {
    const b = getBudget(month);
    setEditingMonth(month);
    setEditValues(b ?? { year, month });
  };

  const handleSave = async () => {
    if (editingMonth == null) return;
    try {
      await upsertBudget(propertyId, {
        year,
        month: editingMonth,
        target_occupancy: editValues.target_occupancy ?? null,
        target_adr: editValues.target_adr ?? null,
        target_revpar: editValues.target_revpar ?? null,
        target_revenue: editValues.target_revenue ?? null,
      });
      setEditingMonth(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    }
  };

  // チャートデータ（予算 vs 実績）
  const chartData = MONTHS.map((label, i) => {
    const month = i + 1;
    const b = getBudget(month);
    const s = getSummary(month);
    return {
      name: label,
      予算売上: b?.target_revenue ?? null,
      実績売上: s?.total_revenue ?? null,
      予算稼働率: b?.target_occupancy ?? null,
      実績稼働率: s?.avg_occupancy ?? null,
    };
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-slate-400">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-600">{error}</p>
        <button onClick={load} className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg">再試行</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">予算管理</h2>
          <p className="text-xs text-slate-400 mt-0.5">月次 KPI 目標を設定し、実績と比較します</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="text-xs border border-slate-200 rounded px-2 py-1.5"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map(y => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
      </div>

      {/* 売上チャート */}
      <div className="yl-card p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">月別売上 予算 vs 実績</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
            <Tooltip formatter={(v: number | string | undefined) => v != null ? `¥${Number(v).toLocaleString()}` : "—"} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="予算売上" stroke="#94a3b8" strokeDasharray="5 5" dot={false} connectNulls />
            <Line type="monotone" dataKey="実績売上" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 月別テーブル */}
      <div className="yl-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">月別 KPI 目標 / 実績</h3>
          <p className="text-xs text-slate-400 mt-0.5">各月のセルをクリックして予算目標を入力できます</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 min-w-[60px]">月</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500 min-w-[120px]">売上（予算/実績）</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">稼働率（予算/実績）</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">ADR（予算/実績）</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">RevPAR（予算/実績）</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((label, i) => {
                const month = i + 1;
                const b = getBudget(month);
                const s = getSummary(month);
                const isEditing = editingMonth === month;
                const _isPast = year < currentYear || (year === currentYear && month < today.getMonth() + 1); void _isPast;

                return (
                  <tr key={month} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {label}
                        {year === currentYear && month === today.getMonth() + 1 && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">当月</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number" min={0} placeholder="目標売上"
                          value={editValues.target_revenue ?? ""}
                          onChange={(e) => setEditValues(v => ({ ...v, target_revenue: e.target.value ? Number(e.target.value) : null }))}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-28 text-right"
                        />
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-slate-400">{fmt(b?.target_revenue)}</div>
                          <div className="font-medium text-slate-900">{s ? fmt(s.total_revenue) : "—"}</div>
                          {s && b?.target_revenue && pctBadge(Math.round(s.total_revenue / b.target_revenue * 100))}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number" min={0} max={100} step={0.1} placeholder="目標稼働率%"
                          value={editValues.target_occupancy ?? ""}
                          onChange={(e) => setEditValues(v => ({ ...v, target_occupancy: e.target.value ? Number(e.target.value) : null }))}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-24 text-right"
                        />
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-slate-400">{b?.target_occupancy != null ? `${b.target_occupancy}%` : "—"}</div>
                          <div className="font-medium text-slate-900">{s ? `${s.avg_occupancy}%` : "—"}</div>
                          {s && b?.target_occupancy && pctBadge(Math.round(s.avg_occupancy / b.target_occupancy * 100))}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number" min={0} placeholder="目標ADR"
                          value={editValues.target_adr ?? ""}
                          onChange={(e) => setEditValues(v => ({ ...v, target_adr: e.target.value ? Number(e.target.value) : null }))}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-24 text-right"
                        />
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-slate-400">{fmt(b?.target_adr)}</div>
                          <div className="font-medium text-slate-900">{s ? fmt(s.avg_adr) : "—"}</div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number" min={0} placeholder="目標RevPAR"
                          value={editValues.target_revpar ?? ""}
                          onChange={(e) => setEditValues(v => ({ ...v, target_revpar: e.target.value ? Number(e.target.value) : null }))}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-24 text-right"
                        />
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-slate-400">{fmt(b?.target_revpar)}</div>
                          <div className="font-medium text-slate-900">
                            {s ? fmt(Math.round(s.avg_adr * s.avg_occupancy / 100)) : "—"}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <button onClick={handleSave} className="p-1.5 bg-slate-900 text-white rounded hover:bg-slate-700">
                          <Save className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => startEdit(month)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
                        >
                          編集
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
