"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, Plus, Pencil, Trash2, Save, X, AlertCircle,
} from "lucide-react";
import {
  fetchCosts, createCost, updateCost, deleteCost, fetchCostSummary,
  type CostSettingOut, type CostSummaryOut,
} from "@/lib/api";

const COST_CATEGORIES = ["人件費", "光熱費", "リネン・アメニティ", "OTA手数料", "その他"];

function fmt(n: number) {
  return `¥${n.toLocaleString()}`;
}

export function CostTab({ propertyId }: { propertyId: number }) {
  const [costs, setCosts] = useState<CostSettingOut[]>([]);
  const [summary, setSummary] = useState<CostSummaryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規追加フォーム
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState(COST_CATEGORIES[0]);
  const [newPerRoom, setNewPerRoom] = useState(0);
  const [newFixed, setNewFixed] = useState(0);

  // 編集中
  const [editId, setEditId] = useState<number | null>(null);
  const [editPerRoom, setEditPerRoom] = useState(0);
  const [editFixed, setEditFixed] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([
        fetchCosts(propertyId),
        fetchCostSummary(propertyId, 3),
      ]);
      setCosts(c);
      setSummary(s);
    } catch (e) {
      setError("データの取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await createCost(propertyId, {
        cost_category: newCategory,
        amount_per_room_night: newPerRoom,
        fixed_monthly: newFixed,
      });
      setShowAddForm(false);
      setNewPerRoom(0);
      setNewFixed(0);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "追加に失敗しました");
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateCost(propertyId, id, {
        amount_per_room_night: editPerRoom,
        fixed_monthly: editFixed,
      });
      setEditId(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新に失敗しました");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このコスト設定を削除しますか？")) return;
    try {
      await deleteCost(propertyId, id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  // 最新月のサマリー
  const latestSummary = summary[0];

  // チャートデータ（月別 売上 vs コスト）
  const chartData = summary.slice().reverse().map((s) => ({
    name: `${s.month}月`,
    売上: s.total_revenue,
    コスト: s.total_cost,
    GOP: s.total_revenue - s.total_cost,
  }));

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
      {/* KPI カード */}
      {latestSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "売上", value: fmt(latestSummary.total_revenue), sub: `${latestSummary.year}年${latestSummary.month}月`, icon: "💰" },
            { label: "総コスト", value: fmt(latestSummary.total_cost), sub: `変動費 + 固定費`, icon: "💸" },
            { label: "GOP", value: fmt(latestSummary.total_revenue - latestSummary.total_cost), sub: "売上 - 総コスト", icon: "📈" },
            { label: "GOPPAR", value: fmt(latestSummary.goppar), sub: "1室1泊あたり粗利", icon: "🏨" },
          ].map((kpi) => (
            <div key={kpi.label} className="yl-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{kpi.icon}</span>
                <span className="text-xs text-slate-500">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{kpi.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* 月別チャート */}
      {chartData.length > 0 && (
        <div className="yl-card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">月別 売上・コスト・GOP比較</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={24} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip formatter={(v) => `¥${Number(v).toLocaleString()}`} />
              <Bar dataKey="売上" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="コスト" fill="#f87171" radius={[3, 3, 0, 0]} />
              <Bar dataKey="GOP" fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* コスト設定テーブル */}
      <div className="yl-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">コスト設定</h3>
            <p className="text-xs text-slate-400 mt-0.5">物件の費用カテゴリを登録し、GOPPAR 算出に使用します</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700"
          >
            <Plus className="w-3 h-3" /> 追加
          </button>
        </div>

        {showAddForm && (
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-500 mb-1">カテゴリ</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5"
                >
                  {COST_CATEGORIES.filter(c => !costs.some(cost => cost.cost_category === c)).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">変動費（円/室泊）</label>
                <input
                  type="number" min={0} value={newPerRoom}
                  onChange={(e) => setNewPerRoom(Number(e.target.value))}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 w-28"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">固定費（円/月）</label>
                <input
                  type="number" min={0} value={newFixed}
                  onChange={(e) => setNewFixed(Number(e.target.value))}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 w-28"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded">
                  <Save className="w-3 h-3" />
                </button>
                <button onClick={() => setShowAddForm(false)} className="text-xs border border-slate-200 px-3 py-1.5 rounded">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {costs.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            コスト設定がありません。「追加」ボタンから登録してください。
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-2.5 font-medium text-slate-500">カテゴリ</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">変動費（円/室泊）</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500">固定費（円/月）</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-700">{cost.cost_category}</td>
                  <td className="px-4 py-3 text-right">
                    {editId === cost.id ? (
                      <input
                        type="number" min={0} value={editPerRoom}
                        onChange={(e) => setEditPerRoom(Number(e.target.value))}
                        className="text-xs border border-slate-200 rounded px-2 py-1 w-24 text-right"
                      />
                    ) : (
                      <span className="text-slate-900">{cost.amount_per_room_night.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editId === cost.id ? (
                      <input
                        type="number" min={0} value={editFixed}
                        onChange={(e) => setEditFixed(Number(e.target.value))}
                        className="text-xs border border-slate-200 rounded px-2 py-1 w-28 text-right"
                      />
                    ) : (
                      <span className="text-slate-900">{cost.fixed_monthly.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {editId === cost.id ? (
                        <>
                          <button onClick={() => handleUpdate(cost.id)} className="p-1 hover:bg-green-50 rounded text-green-600"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditId(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditId(cost.id); setEditPerRoom(cost.amount_per_room_night); setEditFixed(cost.fixed_monthly); }}
                            className="p-1 hover:bg-blue-50 rounded text-blue-500"
                          ><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(cost.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td className="px-5 py-2.5 text-xs font-semibold text-slate-700">合計</td>
                <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">
                  {costs.reduce((s, c) => s + c.amount_per_room_night, 0).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">
                  {costs.reduce((s, c) => s + c.fixed_monthly, 0).toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
