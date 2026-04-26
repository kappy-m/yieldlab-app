"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X, Bot, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, BarChart2, Activity, Target, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecommendationOut } from "@/lib/api";

// TL-Lincoln互換: 1-20の数値文字列
export type BarLevel = string; // "1"-"20" | "CLOSED"

export interface EditTarget {
  roomType: string;
  date: string;
  price: number;
  stock: number;
  level: BarLevel;
}

interface PriceEditModalProps {
  target: EditTarget | null;
  onClose: () => void;
  onSave: (updated: EditTarget) => void;
  /** AI推奨データ（ある場合のみ渡す） */
  recommendation?: RecommendationOut | null;
}

// 1-20のレベルオプションを生成
const BAR_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  let category: string;
  if (n <= 3) category = "プレミアム";
  else if (n <= 7) category = "ハイシーズン";
  else if (n <= 12) category = "スタンダード";
  else if (n <= 16) category = "ディスカウント";
  else category = "ローレート";
  return { value: String(n), label: `${n} - ${category}` };
});

export function getRankColor(level: string): string {
  const n = parseInt(level);
  if (isNaN(n)) return "bg-slate-100 text-slate-500";
  if (n <= 3) return "bg-violet-100 text-violet-700 border border-violet-200";
  if (n <= 7) return "bg-blue-100 text-blue-700 border border-blue-200";
  if (n <= 12) return "bg-slate-100 text-slate-700 border border-slate-200";
  if (n <= 16) return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-red-100 text-red-700 border border-red-200";
}

// ----------------------------------------------------------------
// シグナルバッジ（v2 エンジンの reason テキストをパース）
// ----------------------------------------------------------------
export type SignalBadgeType = "up" | "down" | "neutral";
export type SignalBadgeIconType = "demand" | "supply" | "pace" | "position" | "hierarchy";

export interface SignalBadge {
  label: string;
  type: SignalBadgeType;
  icon: SignalBadgeIconType;
}

export function parseSignalBadges(reason: string): SignalBadge[] {
  const badges: SignalBadge[] = [];
  if (/需要指数高/.test(reason))           badges.push({ label: "需要↑",   type: "up",      icon: "demand" });
  if (/需要指数低/.test(reason))           badges.push({ label: "需要↓",   type: "down",    icon: "demand" });
  if (/市場圧縮|競合価格が上昇/.test(reason)) badges.push({ label: "供給圧縮", type: "up",   icon: "supply" });
  if (/市場緩和|競合価格が下落/.test(reason)) badges.push({ label: "供給緩和", type: "down", icon: "supply" });
  if (/ペースが理想を上回る/.test(reason))  badges.push({ label: "ペース↑", type: "up",      icon: "pace" });
  if (/ペースが理想を下回る/.test(reason))  badges.push({ label: "ペース↓", type: "down",    icon: "pace" });
  if (/ポジション.*割安/.test(reason))      badges.push({ label: "割安",     type: "up",      icon: "position" });
  if (/ポジション.*割高/.test(reason))      badges.push({ label: "割高",     type: "down",    icon: "position" });
  if (/ヒエラルキー/.test(reason))          badges.push({ label: "制約調整", type: "neutral", icon: "hierarchy" });
  return badges;
}

export function SignalBadgeIcon({ icon, type }: { icon: SignalBadgeIconType; type: SignalBadgeType }) {
  const cls = "w-2.5 h-2.5 flex-shrink-0";
  if (icon === "demand")    return type === "up" ? <TrendingUp className={cls} /> : <TrendingDown className={cls} />;
  if (icon === "supply")    return <BarChart2 className={cls} />;
  if (icon === "pace")      return <Activity className={cls} />;
  if (icon === "position")  return <Target className={cls} />;
  return <Layers className={cls} />;
}

// ----------------------------------------------------------------
// AI推奨インフォパネル
// ----------------------------------------------------------------
function AiReasonPanel({ rec }: { rec: RecommendationOut }) {
  const [expanded, setExpanded] = useState(true);
  const delta = rec.delta_levels;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const priceDiff = rec.recommended_price - rec.current_price;
  const priceDiffPct = rec.current_price > 0
    ? Math.round((priceDiff / rec.current_price) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/80 overflow-hidden">
      {/* ヘッダー行 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-violet-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-violet-800">AI推奨あり</span>
          {/* ランク変化サマリー */}
          <div className="flex items-center gap-1.5 ml-1">
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold", getRankColor(rec.current_bar_level))}>
              {rec.current_bar_level}
            </span>
            <span className="text-[10px] text-violet-500">→</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold ring-1 ring-violet-300", getRankColor(rec.recommended_bar_level))}>
              {rec.recommended_bar_level}
            </span>
            {isUp && <TrendingUp className="w-3 h-3 text-green-500" />}
            {isDown && <TrendingDown className="w-3 h-3 text-red-500" />}
            {!isUp && !isDown && <Minus className="w-3 h-3 text-slate-400" />}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-violet-500" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-500" />}
      </button>

      {/* 詳細（展開時） */}
      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3">
          {/* 価格変更 */}
          <div className="flex items-center gap-3 bg-white/70 rounded-lg px-3 py-2 border border-violet-100">
            <div className="text-center">
              <p className="text-[9px] text-slate-400 mb-0.5">現在価格</p>
              <p className="text-sm font-bold text-slate-700">¥{rec.current_price.toLocaleString()}</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                priceDiff > 0 ? "text-green-700 bg-green-100" : priceDiff < 0 ? "text-red-700 bg-red-100" : "text-slate-500 bg-slate-100"
              )}>
                {priceDiff > 0 ? "+" : ""}{priceDiff.toLocaleString()}円
                <span className="opacity-60">（{priceDiffPct > 0 ? "+" : ""}{priceDiffPct}%）</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                {delta > 0 ? `${delta}ランクUP（価格上昇）` : delta < 0 ? `${Math.abs(delta)}ランクDOWN（価格下降）` : "変化なし"}
              </div>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-violet-500 mb-0.5">推奨価格</p>
              <p className="text-sm font-bold text-violet-700">¥{rec.recommended_price.toLocaleString()}</p>
            </div>
          </div>

          {/* シグナルバッジ（v2エンジンから生成） */}
          {(() => {
            const badges = parseSignalBadges(rec.reason);
            if (badges.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((badge, i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border",
                      badge.type === "up"      && "text-green-700 bg-green-50 border-green-200",
                      badge.type === "down"    && "text-red-700 bg-red-50 border-red-200",
                      badge.type === "neutral" && "text-slate-600 bg-slate-50 border-slate-200",
                    )}
                  >
                    <SignalBadgeIcon icon={badge.icon} type={badge.type} />
                    {badge.label}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* 推奨理由 */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide">推奨理由</p>
            {rec.reason.split("。").filter(Boolean).map((sentence, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-1 h-1 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-700 leading-relaxed">{sentence.trim()}</p>
              </div>
            ))}
          </div>

          {/* 承認要否 */}
          {rec.needs_approval && (
            <div className="flex items-center gap-1.5 text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              変動幅が大きいため手動承認が推奨されます
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// メインモーダル
// ----------------------------------------------------------------
export function PriceEditModal({ target, onClose, onSave, recommendation }: PriceEditModalProps) {
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [level, setLevel] = useState<BarLevel>("10");

  useEffect(() => {
    if (target) {
      setPrice(target.price);
      setStock(target.stock);
      setLevel(target.level);
    }
  }, [target]);

  const handleSave = () => {
    if (!target) return;
    onSave({ ...target, price, stock, level });
    onClose();
  };

  /** AI推奨のランクを適用する */
  const applyAiRecommendation = () => {
    if (!recommendation) return;
    setLevel(recommendation.recommended_bar_level);
    setPrice(recommendation.recommended_price);
  };

  const levelNum = parseInt(level);
  const levelLabel = BAR_OPTIONS.find(o => o.value === level)?.label ?? level;

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 p-0 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <DialogTitle className="text-base font-semibold text-gray-900">価格・在庫編集</DialogTitle>
            <DialogDescription className="text-xs text-gray-400 mt-0.5">
              日付・部屋タイプの価格・在庫・レートランクを編集します
            </DialogDescription>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* AI推奨パネル（ある場合のみ表示） */}
          {recommendation && (
            <div className="space-y-2">
              <AiReasonPanel rec={recommendation} />
              <button
                onClick={applyAiRecommendation}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg py-2 transition-colors cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                AI推奨ランク・価格を適用する
              </button>
            </div>
          )}

          {/* 部屋タイプ / 日付 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">部屋タイプ</label>
              <div className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                {target?.roomType}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">日付</label>
              <div className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                {target?.date}
              </div>
            </div>
          </div>

          {/* 価格 / 在庫 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">価格（円）</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                step={500}
                min={0}
                className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-colors"
              />
              <div className="text-xs text-gray-400 mt-1">¥{price.toLocaleString()}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">在庫数</label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                min={0}
                className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-colors"
              />
            </div>
          </div>

          {/* レートランク */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              レートランク <span className="text-gray-300">（1=最高値 / 20=最安値）</span>
            </label>

            {/* スライダー */}
            <div className="mb-3">
              <input
                type="range"
                min={1}
                max={20}
                value={isNaN(levelNum) ? 10 : levelNum}
                onChange={e => setLevel(e.target.value)}
                className="w-full accent-brand-navy cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>1 最高値</span>
                <span>10 標準</span>
                <span>20 最安値</span>
              </div>
            </div>

            {/* セレクト */}
            <div className="relative">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-colors appearance-none bg-white cursor-pointer"
              >
                {BAR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <span className={cn("text-xs px-2 py-0.5 rounded font-medium", getRankColor(level))}>
                Rank {levelLabel}
              </span>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
