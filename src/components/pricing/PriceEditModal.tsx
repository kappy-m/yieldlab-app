"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function PriceEditModal({ target, onClose, onSave }: PriceEditModalProps) {
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

  const levelNum = parseInt(level);
  const levelLabel = BAR_OPTIONS.find(o => o.value === level)?.label ?? level;

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <DialogTitle className="text-base font-semibold text-gray-900">価格・在庫編集</DialogTitle>
            <DialogDescription className="text-xs text-gray-400 mt-0.5">
              選択した日付・部屋タイプの価格・在庫・レートランクを編集します
            </DialogDescription>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">価格（円）</label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  step={500}
                  min={0}
                  className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-colors"
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ¥{price.toLocaleString()}
              </div>
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
                className="w-full accent-[#1E3A8A] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>1 最高値</span>
                <span>10 標準</span>
                <span>20 最安値</span>
              </div>
            </div>

            {/* セレクト（精密選択用） */}
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

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
          >
            保存
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
