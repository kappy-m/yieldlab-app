"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, CheckCircle2, RefreshCw, Download, ChevronDown } from "lucide-react";
import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { PriceEditModal, type EditTarget, getRankColor } from "@/components/pricing/PriceEditModal";
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

// ----------------------------------------------------------------
// セル状態の定義
//   ai      : AIが変更を提案中（未承認）
//   user    : 現セッションでユーザーが手動変更した
//   approved: AI提案を承認済み
//   default : BARラダーから自動計算されたデフォルト値
// ----------------------------------------------------------------
type CellState = "ai" | "user" | "approved" | "default";

const CELL_STATE_META: Record<CellState, {
  dotColor: string;
  bgClass: string;
  badgeLabel: string;
  badgeClass: string;
}> = {
  ai: {
    dotColor: "bg-violet-500",
    bgClass: "bg-violet-50/60",
    badgeLabel: "AI提案",
    badgeClass: "text-violet-700 bg-violet-100 border border-violet-200",
  },
  user: {
    dotColor: "bg-orange-400",
    bgClass: "bg-orange-50/50",
    badgeLabel: "手動変更",
    badgeClass: "text-orange-700 bg-orange-100 border border-orange-200",
  },
  approved: {
    dotColor: "bg-green-500",
    bgClass: "bg-green-50/40",
    badgeLabel: "承認済",
    badgeClass: "text-green-700 bg-green-100 border border-green-200",
  },
  default: {
    dotColor: "",
    bgClass: "",
    badgeLabel: "",
    badgeClass: "",
  },
};

// ----------------------------------------------------------------
// 日付ラベル生成
// ----------------------------------------------------------------
function getDateRange(days = 14): { from: string; to: string; labels: string[]; dates: string[] } {
  const today = new Date();
  const labels: string[] = [];
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()] ?? "";
    labels.push(`${mm}/${dd}${dow}`);
    dates.push(d.toISOString().slice(0, 10));
  }
  return { from: dates[0]!, to: dates[dates.length - 1]!, labels, dates };
}

const RANGE_OPTIONS = [
  { label: "14日", days: 14 },
  { label: "30日", days: 30 },
  { label: "90日", days: 90 },
] as const;

// ----------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------
export function PricingTab({ propertyId }: { propertyId: number }) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeOut[]>([]);
  const [grid, setGrid] = useState<PricingCellOut[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationOut[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [aiSummary, setAiSummary] = useState<PricingAiSummaryOut | null>(null);
  const [displayDays, setDisplayDays] = useState<14 | 30 | 90>(30);
  const [showRecPanel, setShowRecPanel] = useState(false);

  // セル状態追跡: "rtId_date" → CellState
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(new Map());
  // 承認済みセルのセット
  const [approvedCells] = useState<Set<string>>(new Set());

  const { from, to, labels, dates } = getDateRange(displayDays);

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
      setAiSummary(summary);

      // pendingが0件のときは自動生成
      if (recs.length === 0) {
        try {
          const generated = await generateRecommendations(propertyId, displayDays);
          setRecommendations(generated.filter(r => r.status === "pending"));
        } catch {
          setRecommendations([]);
        }
      } else {
        setRecommendations(recs);
      }
    } catch (e) {
      console.error("Failed to load pricing data", e);
    } finally {
      setLoading(false);
    }
  }, [propertyId, from, to, displayDays]);

  useEffect(() => { loadData(); }, [loadData]);

  // AI推奨マップ: "rtId_date" → RecommendationOut
  const recMap = new Map(
    recommendations.map(r => [`${r.room_type_id}_${r.target_date}`, r])
  );

  const getCell = (roomTypeId: number, dateStr: string): PricingCellOut | undefined =>
    grid.find(c => c.room_type_id === roomTypeId && c.target_date === dateStr);

  const getCellState = (roomTypeId: number, dateStr: string): CellState => {
    const key = `${roomTypeId}_${dateStr}`;
    const userState = cellStates.get(key);
    if (userState) return userState;
    if (approvedCells.has(key)) return "approved";
    if (recMap.has(key)) return "ai";
    return "default";
  };

  const openEdit = (rt: RoomTypeOut, dateStr: string, label: string) => {
    const cell = getCell(rt.id, dateStr);
    if (!cell) return;
    setEditTarget({
      roomType: rt.name,
      date: label,
      price: cell.price,
      stock: cell.available_rooms,
      level: cell.bar_level,
    });
  };

  const handleSave = async (updated: EditTarget) => {
    const rt = roomTypes.find(r => r.name === updated.roomType);
    if (!rt) return;
    const labelIdx = labels.indexOf(updated.date);
    if (labelIdx === -1) return;
    const dateStr = dates[labelIdx];
    if (!dateStr) return;

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
      // ユーザー手動変更として記録
      const key = `${rt.id}_${dateStr}`;
      setCellStates(prev => new Map(prev).set(key, "user"));
    } catch (e) {
      console.error("Failed to save pricing cell", e);
    }
  };

  const handleApprove = async (recId: number, rec: RecommendationOut) => {
    try {
      await actOnRecommendation(propertyId, recId, { action: "approved" });
      setRecommendations(prev => prev.filter(r => r.id !== recId));
      // 承認済みとしてセル状態を更新
      const key = `${rec.room_type_id}_${rec.target_date}`;
      setCellStates(prev => new Map(prev).set(key, "approved"));
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
    await Promise.all(recommendations.map(r => handleApprove(r.id, r)));
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

  const handleRefreshRecs = async () => {
    try {
      const generated = await generateRecommendations(propertyId, displayDays);
      setRecommendations(generated.filter(r => r.status === "pending"));
    } catch (e) {
      console.error("Failed to refresh recommendations", e);
    }
  };

  const pendingCount = recommendations.length;

  return (
    <div>
      <AiSummaryCard
        summary={aiSummary?.summary ?? "価格データを分析中..."}
        bullets={aiSummary?.bullets ?? []}
      />

      {/* ================================================================
          価格グリッドカード
      ================================================================ */}
      <div className="yl-card overflow-hidden mb-5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              価格・在庫管理（{displayDays}日間）
            </h3>
            <p className="text-xs text-gray-400">
              セルをクリックして編集。セルの状態は右上のドットで確認できます
            </p>
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
            <button onClick={handleExport} className="flex items-center gap-1 text-xs border border-gray-200 rounded px-2.5 py-1 text-gray-600 hover:bg-gray-50">
              <Download className="w-3 h-3" /> CSV
            </button>
            <button
              onClick={handleRefreshRecs}
              className="flex items-center gap-1.5 text-xs bg-violet-600 text-white rounded px-3 py-1 font-medium hover:bg-violet-700"
            >
              <Bot className="w-3 h-3" /> AI推奨を更新
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="text-xs bg-[#1E3A8A] text-white rounded px-3 py-1 font-medium hover:bg-[#1e3070] disabled:opacity-50"
            >
              {applying ? "適用中..." : "Apply"}
            </button>
          </div>
        </div>

        {/* セル状態凡例 */}
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className="font-medium">セル状態：</span>
          {(Object.entries(CELL_STATE_META) as [CellState, typeof CELL_STATE_META[CellState]][])
            .filter(([key]) => key !== "default")
            .map(([key, meta]) => (
              <div key={key} className="flex items-center gap-1">
                <div className={cn("w-2 h-2 rounded-full", meta.dotColor)} />
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", meta.badgeClass)}>
                  {meta.badgeLabel}
                </span>
              </div>
            ))}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <span className="text-[10px] text-slate-400">デフォルト</span>
          </div>
          <span className="ml-2 text-[10px] text-slate-400">
            ランク：1=最高値 / 20=最安値（TL-Lincoln互換）
          </span>
        </div>

        {/* グリッド本体 */}
        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-[160px] z-10">
                    部屋タイプ
                  </th>
                  {labels.map((d, i) => {
                    const isWeekend = d.endsWith("土") || d.endsWith("日");
                    const hasRec = recommendations.some(r => r.target_date === dates[i]);
                    return (
                      <th key={d} className={cn(
                        "px-1.5 py-2 text-center text-gray-500 font-medium min-w-[72px]",
                        isWeekend && "text-red-500",
                      )}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{d}</span>
                          {hasRec && (
                            <div className="w-1 h-1 rounded-full bg-violet-400" title="AI提案あり" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => (
                  <tr key={rt.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-700 font-medium sticky left-0 bg-white z-10">
                      <div>{rt.name}</div>
                      <div className="text-gray-400">総室数: {rt.total_rooms}</div>
                    </td>
                    {dates.map((dateStr, i) => {
                      const cell = getCell(rt.id, dateStr);
                      const level = cell?.bar_level ?? "10";
                      const price = cell?.price ?? 0;
                      const stock = cell?.available_rooms ?? 0;
                      const state = getCellState(rt.id, dateStr);
                      const rec = recMap.get(`${rt.id}_${dateStr}`);
                      const meta = CELL_STATE_META[state];

                      return (
                        <td
                          key={dateStr}
                          onClick={() => openEdit(rt, dateStr, labels[i]!)}
                          className={cn(
                            "px-1.5 py-1.5 text-center cursor-pointer hover:ring-2 hover:ring-inset hover:ring-blue-200 transition-all relative",
                            meta.bgClass,
                          )}
                        >
                          {/* 状態ドット（右上角） */}
                          {state !== "default" && (
                            <div
                              className={cn(
                                "absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full",
                                meta.dotColor,
                              )}
                              title={meta.badgeLabel}
                            />
                          )}

                          <div className="flex flex-col items-center gap-0.5">
                            {/* ランク番号バッジ */}
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-bold leading-none",
                              getRankColor(level),
                            )}>
                              {level}
                            </span>
                            {/* 価格 */}
                            <span className="text-gray-800 font-medium text-[11px]">
                              ¥{Math.floor(price / 1000)}K
                            </span>
                            {/* 在庫 */}
                            <span className={cn(
                              "text-[10px]",
                              stock <= 3 ? "text-red-500 font-semibold" :
                              stock <= 5 ? "text-orange-500 font-medium" :
                              "text-gray-400"
                            )}>
                              残{stock}
                            </span>
                            {/* AI提案の場合：推奨値を小さく表示 */}
                            {rec && state === "ai" && (
                              <span className="text-[9px] text-violet-600 leading-none">
                                → {rec.recommended_bar_level}
                              </span>
                            )}
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

        <div className="px-5 py-2 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            ※ セルをクリックすると価格・在庫・ランクを編集できます。変更後は「Apply」で一斉反映。
          </p>
          {pendingCount > 0 && (
            <span className="text-xs text-violet-600 font-medium">
              <Bot className="w-3 h-3 inline mr-0.5" />
              {pendingCount}件のAI提案あり
            </span>
          )}
        </div>
      </div>

      {/* ================================================================
          AI提案パネル（折りたたみ）
      ================================================================ */}
      <div className="yl-card overflow-hidden">
        <button
          onClick={() => setShowRecPanel(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-gray-900">AI提案変更内容</h3>
            {pendingCount > 0 && (
              <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                {pendingCount}件
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showRecPanel && pendingCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleApproveAll(); }}
                className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-700 font-medium"
              >
                一括承認
              </button>
            )}
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", showRecPanel && "rotate-180")} />
          </div>
        </button>

        {showRecPanel && (
          <div className="border-t border-gray-100 px-5 py-4">
            {pendingCount === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>承認待ちの提案はありません</p>
                <button onClick={handleRefreshRecs} className="mt-2 text-xs text-violet-600 hover:underline flex items-center gap-1 mx-auto">
                  <RefreshCw className="w-3 h-3" />AI推奨を再生成
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recommendations.map((rec, i) => (
                  <div key={rec.id} className="border border-gray-200 rounded-xl p-3.5 hover:border-violet-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-700 flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{rec.room_type_name}</span>
                            <span className="text-xs text-gray-500">{rec.target_date}</span>
                            <div className="flex items-center gap-1">
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold", getRankColor(rec.current_bar_level))}>
                                {rec.current_bar_level}
                              </span>
                              <span className="text-[10px] text-gray-400">→</span>
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold", getRankColor(rec.recommended_bar_level))}>
                                {rec.recommended_bar_level}
                              </span>
                            </div>
                            {rec.needs_approval && (
                              <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded font-medium border border-orange-200">
                                要承認
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mb-0.5">
                            <span className="font-medium">¥{rec.current_price.toLocaleString()}</span>
                            <span className="mx-1">→</span>
                            <span className="font-medium text-violet-600">¥{rec.recommended_price.toLocaleString()}</span>
                            <span className="ml-2 text-gray-400">
                              ({rec.delta_levels > 0 ? "+" : ""}{rec.delta_levels}ランク)
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">{rec.reason}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleReject(rec.id)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-transparent hover:border-gray-200 rounded transition-colors"
                        >
                          却下
                        </button>
                        <button
                          onClick={() => handleApprove(rec.id, rec)}
                          className="flex items-center gap-1 text-xs bg-violet-600 text-white rounded px-2.5 py-1.5 hover:bg-violet-700 font-medium"
                        >
                          <CheckCircle2 className="w-3 h-3" />承認
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
