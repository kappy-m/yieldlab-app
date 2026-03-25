"use client";

import { useState, useEffect, useCallback } from "react";
import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { PriceEditModal, type EditTarget, type BarLevel } from "@/components/pricing/PriceEditModal";
import { cn } from "@/lib/utils";
import {
  fetchPricingGrid,
  fetchRecommendations,
  fetchRoomTypes,
  generateRecommendations,
  actOnRecommendation,
  updatePricingCell,
  syncGridFromBarLadder,
  fetchPricingAiSummary,
  getPricingExportUrl,

  type PricingCellOut,
  type RecommendationOut,
  type RoomTypeOut,
  type PricingAiSummaryOut,
} from "@/lib/api";

const barBadgeClass: Record<string, string> = {
  A: "bar-badge-a",
  B: "bar-badge-b",
  C: "bar-badge-c",
  D: "bar-badge-d",
  E: "bar-badge-e",
};

function getDateRange(days = 14): { from: string; to: string; labels: string[] } {
  const today = new Date();
  const labels: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()] ?? "";
    labels.push(`${mm}/${dd}${dow}`);
  }
  const from = today.toISOString().slice(0, 10);
  const toDate = new Date(today);
  toDate.setDate(today.getDate() + days - 1);
  const to = toDate.toISOString().slice(0, 10);
  return { from, to, labels };
}

const RANGE_OPTIONS = [
  { label: "14日", days: 14 },
  { label: "30日", days: 30 },
  { label: "90日", days: 90 },
] as const;

export function PricingTab({ propertyId }: { propertyId: number }) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeOut[]>([]);
  const [grid, setGrid] = useState<PricingCellOut[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationOut[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [aiSummary, setAiSummary] = useState<PricingAiSummaryOut | null>(null);
  const [displayDays, setDisplayDays] = useState<14 | 30 | 90>(30);
  const { from, to, labels } = getDateRange(displayDays);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rts, cells, recs, summary] = await Promise.all([
        fetchRoomTypes(propertyId),
        fetchPricingGrid(propertyId, { date_from: from, date_to: to }),
        fetchRecommendations(propertyId, "pending"),
        fetchPricingAiSummary(propertyId),
      ]);
      setRoomTypes(rts);
      setGrid(cells);
      setRecommendations(recs);
      setAiSummary(summary);
    } catch (e) {
      console.error("Failed to load pricing data", e);
    } finally {
      setLoading(false);
    }
  }, [propertyId, from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const getCell = (roomTypeId: number, dateLabel: string): PricingCellOut | undefined => {
    const today = new Date();
    const labelIdx = labels.indexOf(dateLabel);
    if (labelIdx === -1) return undefined;
    const d = new Date(today);
    d.setDate(today.getDate() + labelIdx);
    const dateStr = d.toISOString().slice(0, 10);
    return grid.find(c => c.room_type_id === roomTypeId && c.target_date === dateStr);
  };

  const openEdit = (rt: RoomTypeOut, dateLabel: string) => {
    const cell = getCell(rt.id, dateLabel);
    if (!cell) return;
    setEditTarget({
      roomType: rt.name,
      date: dateLabel,
      price: cell.price,
      stock: cell.available_rooms,
      level: cell.bar_level as BarLevel,
    });
  };

  const handleSave = async (updated: EditTarget) => {
    const rt = roomTypes.find(r => r.name === updated.roomType);
    if (!rt) return;
    const labelIdx = labels.indexOf(updated.date);
    if (labelIdx === -1) return;
    const today = new Date();
    const d = new Date(today);
    d.setDate(today.getDate() + labelIdx);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const updatedCell = await updatePricingCell(propertyId, rt.id, dateStr, {
        bar_level: updated.level,
        price: updated.price,
        available_rooms: updated.stock,
      });
      setGrid(prev => {
        const idx = prev.findIndex(c => c.room_type_id === rt.id && c.target_date === dateStr);
        if (idx === -1) return [...prev, updatedCell];
        const next = [...prev];
        next[idx] = updatedCell;
        return next;
      });
    } catch (e) {
      console.error("Failed to save pricing cell", e);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const recs = await generateRecommendations(propertyId, 30);
      setRecommendations(recs.filter(r => r.status === "pending"));
    } catch (e) {
      console.error("Failed to generate recommendations", e);
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (recId: number) => {
    try {
      await actOnRecommendation(propertyId, recId, { action: "approved" });
      setRecommendations(prev => prev.filter(r => r.id !== recId));
      await loadData();
    } catch (e) {
      console.error("Failed to approve", e);
    }
  };

  const handleReject = async (recId: number) => {
    try {
      await actOnRecommendation(propertyId, recId, { action: "rejected" });
      setRecommendations(prev => prev.filter(r => r.id !== recId));
    } catch (e) {
      console.error("Failed to reject", e);
    }
  };

  const handleApproveAll = async () => {
    await Promise.all(recommendations.map(r => handleApprove(r.id)));
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const result = await syncGridFromBarLadder(propertyId);
      alert(`BARラダー価格を適用しました（${result.synced_rows}件更新）`);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "適用に失敗しました");
    } finally {
      setApplying(false);
    }
  };

  const handleExport = () => {
    const url = getPricingExportUrl(propertyId, from, to);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pricing_${propertyId}_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pendingCount = recommendations.length;

  return (
    <div>
      <AiSummaryCard
        summary={aiSummary?.summary ?? "価格データを分析中..."}
        bullets={aiSummary?.bullets ?? []}
      />

      <div className="yl-card overflow-hidden mb-5">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">価格・在庫管理（{displayDays}日間）</h3>
            <p className="text-xs text-gray-400">部屋タイプ別の価格・レートランク・在庫数を一覧管理（セルをクリックして編集）</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 期間セレクター */}
            <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.days}
                  onClick={() => setDisplayDays(opt.days)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    displayDays === opt.days
                      ? "bg-white text-gray-800 font-semibold shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={handleExport} className="text-xs border border-gray-200 rounded px-3 py-1 text-gray-600 hover:bg-gray-50">エクスポート</button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs bg-blue-600 text-white rounded px-3 py-1 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "生成中..." : "AI推奨を生成"}
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="text-xs bg-[#EF4444] text-white rounded px-3 py-1 font-medium hover:bg-red-600 disabled:opacity-50"
            >
              {applying ? "適用中..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-500">
          <span>レートランク：</span>
          {(["A", "B", "C", "D", "E"] as BarLevel[]).map((l) => (
            <span key={l} className={barBadgeClass[l]}>
              {l} {l === "A" ? "最高価格" : l === "B" ? "高価格" : l === "C" ? "標準" : l === "D" ? "割引" : "大幅割引"}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-[140px]">部屋タイプ</th>
                  {labels.map((d) => {
                    const isWeekend = d.endsWith("土") || d.endsWith("日");
                    return (
                      <th key={d} className={cn("px-2 py-2 text-center text-gray-500 font-medium min-w-[72px]", isWeekend && "text-red-500")}>
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => (
                  <tr key={rt.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-700 font-medium sticky left-0 bg-white">
                      <div>{rt.name}</div>
                      <div className="text-gray-400">総室数: {rt.total_rooms}</div>
                    </td>
                    {labels.map((dateLabel) => {
                      const cell = getCell(rt.id, dateLabel);
                      const level = (cell?.bar_level ?? "C") as BarLevel;
                      const price = cell?.price ?? 0;
                      const stock = cell?.available_rooms ?? 0;
                      const isAiSuggested = recommendations.some(
                        r => r.room_type_id === rt.id
                      );
                      return (
                        <td
                          key={dateLabel}
                          onClick={() => openEdit(rt, dateLabel)}
                          className={cn(
                            "px-2 py-2 text-center cursor-pointer hover:bg-blue-50 transition-colors",
                            isAiSuggested && "bg-green-50/50"
                          )}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-800 font-medium">¥{Math.floor(price / 1000)}K</span>
                              <span className={barBadgeClass[level]}>{level}</span>
                            </div>
                            <span className={cn("text-gray-400", stock <= 5 && "text-orange-500 font-medium")}>残{stock}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">※ セルをクリックすると価格・在庫・レートランクを編集できます。変更後は「Apply」ボタンで一斉反映してください。</p>
        </div>
      </div>

      <div className="yl-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI提案変更内容</h3>
            <p className="text-xs text-gray-400">ルールエンジンが提案している価格調整（承認待ち: {pendingCount}件）</p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{pendingCount}件の変更提案</span>
            )}
            <button
              onClick={handleApproveAll}
              disabled={pendingCount === 0}
              className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-700 font-medium disabled:opacity-40"
            >
              一括承認
            </button>
          </div>
        </div>

        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            <p>承認待ちの提案はありません</p>
            <button onClick={handleGenerate} className="mt-2 text-xs text-blue-600 hover:underline">
              AI推奨を生成する
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={rec.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 mt-0.5">{i + 1}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">{rec.room_type_name}</span>
                        <span className="text-sm text-gray-500">{rec.target_date}</span>
                        <span className={barBadgeClass[rec.current_bar_level]}>{rec.current_bar_level}</span>
                        <span className="text-xs text-gray-400">→</span>
                        <span className={barBadgeClass[rec.recommended_bar_level]}>{rec.recommended_bar_level}</span>
                        {rec.needs_approval && (
                          <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded font-medium">要承認</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">¥{rec.current_price.toLocaleString()}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium text-blue-600">¥{rec.recommended_price.toLocaleString()}</span>
                        <span className="ml-2 text-gray-400">
                          ({rec.delta_levels > 0 ? "+" : ""}{rec.delta_levels}ランク)
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{rec.reason}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleReject(rec.id)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">却下</button>
                    <button onClick={() => handleApprove(rec.id)} className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 font-medium">承認</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PriceEditModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
      />
    </div>
  );
}
