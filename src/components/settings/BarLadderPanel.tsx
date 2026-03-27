"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchBarLadder, fetchRoomTypes, bulkUpdateBarLadder, syncGridFromBarLadder,
  type BarLadderOut, type RoomTypeOut,
} from "@/lib/api";
import { Check, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BAR_LEVELS_20 = Array.from({ length: 20 }, (_, i) => String(i + 1));

function getBarLevelMeta(level: string): { label: string; headerClass: string; inputClass: string } {
  const n = parseInt(level);
  if (n <= 3) return {
    label: "プレミアム",
    headerClass: "bg-violet-50 text-violet-700",
    inputClass: "border-violet-200 focus:ring-violet-300/40",
  };
  if (n <= 7) return {
    label: "ハイシーズン",
    headerClass: "bg-blue-50 text-blue-700",
    inputClass: "border-blue-200 focus:ring-blue-300/40",
  };
  if (n <= 12) return {
    label: "スタンダード",
    headerClass: "bg-slate-50 text-slate-600",
    inputClass: "border-slate-200 focus:ring-slate-300/40",
  };
  if (n <= 16) return {
    label: "ディスカウント",
    headerClass: "bg-amber-50 text-amber-700",
    inputClass: "border-amber-200 focus:ring-amber-300/40",
  };
  return {
    label: "ローレート",
    headerClass: "bg-red-50 text-red-600",
    inputClass: "border-red-200 focus:ring-red-300/40",
  };
}

type CellKey = `${number}-${string}`;
type EditMap = Map<CellKey, { id: number; price: number }>;

function buildEditMap(bars: BarLadderOut[]): EditMap {
  const m = new Map<CellKey, { id: number; price: number }>();
  for (const b of bars) {
    if (b.room_type_id != null) {
      m.set(`${b.room_type_id}-${b.level}`, { id: b.id, price: b.price });
    }
  }
  return m;
}

export function BarLadderPanel({ propertyId }: { propertyId: number }) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeOut[]>([]);
  const [edits, setEdits] = useState<Map<CellKey, string>>(new Map());
  const [editMap, setEditMap] = useState<EditMap>(new Map());
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Map<number, string>>(new Map());

  const load = useCallback(async () => {
    const [rts, bars] = await Promise.all([
      fetchRoomTypes(propertyId),
      fetchBarLadder(propertyId),
    ]);
    setRoomTypes(rts);
    setEditMap(buildEditMap(bars));
    setEdits(new Map());
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const getDisplayPrice = (rtId: number, level: string): number | null => {
    const key: CellKey = `${rtId}-${level}`;
    const editVal = edits.get(key);
    if (editVal !== undefined) {
      const n = parseInt(editVal.replace(/,/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    return editMap.get(key)?.price ?? null;
  };

  const handleCellChange = (rtId: number, level: string, raw: string) => {
    const key: CellKey = `${rtId}-${level}`;
    const newEdits = new Map(edits);
    newEdits.set(key, raw.replace(/[^0-9]/g, ""));
    setEdits(newEdits);
    validateRow(rtId, newEdits);
  };

  const validateRow = (rtId: number, currentEdits: Map<CellKey, string>) => {
    const prices = BAR_LEVELS_20.map(l => {
      const key: CellKey = `${rtId}-${l}`;
      const editVal = currentEdits.get(key);
      if (editVal !== undefined) return parseInt(editVal, 10) || 0;
      return editMap.get(key)?.price ?? 0;
    });
    const errors = new Map(validationErrors);
    for (let i = 0; i < prices.length - 1; i++) {
      if (prices[i]! !== 0 && prices[i + 1]! !== 0 && prices[i]! < prices[i + 1]!) {
        errors.set(rtId, `Rank ${i + 1} の価格は Rank ${i + 2} 以上にしてください（上位ランクほど高価格）`);
        setValidationErrors(errors);
        return;
      }
    }
    errors.delete(rtId);
    setValidationErrors(errors);
  };

  const isDirty = edits.size > 0;

  const handleSaveAll = async () => {
    if (validationErrors.size > 0) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const items: { id: number; price: number }[] = [];
      for (const [key, rawVal] of Array.from(edits.entries())) {
        const entry = editMap.get(key);
        if (!entry) continue;
        const price = parseInt(rawVal, 10);
        if (isNaN(price) || price <= 0) continue;
        items.push({ id: entry.id, price });
      }
      if (items.length > 0) await bulkUpdateBarLadder(propertyId, items);
      await load();
      setSaveMsg({ type: "ok", text: `${items.length}件を保存しました` });
    } catch {
      setSaveMsg({ type: "err", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncGrid = async () => {
    setSyncing(true);
    setSaveMsg(null);
    try {
      const result = await syncGridFromBarLadder(propertyId);
      setSaveMsg({ type: "ok", text: result.message });
    } catch {
      setSaveMsg({ type: "err", text: "グリッド同期に失敗しました" });
    } finally {
      setSyncing(false);
    }
  };

  const discardEdits = () => {
    setEdits(new Map());
    setValidationErrors(new Map());
    setSaveMsg(null);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">BARラダー設定</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            TL-Lincolnなどのレートランクをそのまま入力。Rank 1=最高値 / Rank 20=最安値
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button onClick={discardEdits} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
              変更を破棄
            </button>
          )}
          <button
            onClick={handleSyncGrid}
            disabled={syncing || isDirty}
            title={isDirty ? "先に変更を保存してください" : "BARラダーの価格をプライシンググリッドに反映"}
            className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 font-medium"
          >
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
            グリッドに反映
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!isDirty || saving || validationErrors.size > 0}
            className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40 font-medium"
          >
            <Check className="w-3 h-3" />
            {saving ? "保存中..." : `変更を保存${isDirty ? ` (${edits.size}件)` : ""}`}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={cn(
          "mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-medium",
          saveMsg.type === "ok"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        )}>
          {saveMsg.type === "ok"
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          {saveMsg.text}
        </div>
      )}

      {validationErrors.size > 0 && (
        <div className="mb-4 space-y-1">
          {Array.from(validationErrors.entries()).map(([rtId, msg]) => {
            const rt = roomTypes.find(r => r.id === rtId);
            return (
              <div key={rtId} className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{rt?.name}</strong>: {msg}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {[
          { range: "1-3",   label: "プレミアム",    cls: "bg-violet-100 text-violet-700 border border-violet-200" },
          { range: "4-7",   label: "ハイシーズン",  cls: "bg-blue-100 text-blue-700 border border-blue-200" },
          { range: "8-12",  label: "スタンダード",  cls: "bg-slate-100 text-slate-700 border border-slate-200" },
          { range: "13-16", label: "ディスカウント", cls: "bg-amber-100 text-amber-700 border border-amber-200" },
          { range: "17-20", label: "ローレート",    cls: "bg-red-100 text-red-700 border border-red-200" },
        ].map(item => (
          <span key={item.range} className={cn("text-[10px] px-2 py-0.5 rounded font-medium", item.cls)}>
            {item.range}: {item.label}
          </span>
        ))}
      </div>

      <div className="yl-card overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 z-10 min-w-[160px]">
                部屋タイプ
              </th>
              {BAR_LEVELS_20.map(l => {
                const meta = getBarLevelMeta(l);
                return (
                  <th key={l} className={cn("px-2 py-2 min-w-[90px] text-center", meta.headerClass)}>
                    <div className="font-bold text-xs">{l}</div>
                    <div className="text-[9px] opacity-70">{meta.label}</div>
                  </th>
                );
              })}
              <th className="px-3 py-3 text-gray-400 font-medium text-center min-w-[100px]">
                <span className="text-[10px]">20/1 割引率</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt, rowIdx) => {
              const hasError = validationErrors.has(rt.id);
              return (
                <tr
                  key={rt.id}
                  className={cn(
                    "border-b border-gray-50 transition-colors",
                    hasError ? "bg-red-50/40" : rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/20",
                  )}
                >
                  <td className="px-4 py-2 font-medium text-gray-800 sticky left-0 bg-inherit z-10 whitespace-nowrap">
                    {rt.name}
                  </td>
                  {BAR_LEVELS_20.map(level => {
                    const key: CellKey = `${rt.id}-${level}`;
                    const isEditing = edits.has(key);
                    const displayPrice = getDisplayPrice(rt.id, level);
                    const originalPrice = editMap.get(key)?.price ?? null;
                    const isChanged = isEditing && displayPrice !== originalPrice;
                    const meta = getBarLevelMeta(level);

                    return (
                      <td key={level} className="px-1.5 py-1.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">¥</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              isEditing
                                ? edits.get(key) ?? ""
                                : displayPrice != null
                                  ? displayPrice.toLocaleString()
                                  : ""
                            }
                            placeholder="—"
                            onChange={e => handleCellChange(rt.id, level, e.target.value)}
                            onFocus={e => {
                              if (!edits.has(key) && displayPrice != null) {
                                const newEdits = new Map(edits);
                                newEdits.set(key, String(displayPrice));
                                setEdits(newEdits);
                              }
                              e.target.select();
                            }}
                            onBlur={e => {
                              const val = e.target.value;
                              if (val === "" || val === String(originalPrice)) {
                                const newEdits = new Map(edits);
                                newEdits.delete(key);
                                setEdits(newEdits);
                              }
                            }}
                            className={cn(
                              "w-full pl-5 pr-1 py-1 text-right text-[11px] rounded border transition-all focus:outline-none focus:ring-2",
                              isChanged
                                ? "border-blue-400 bg-blue-50 text-blue-800 font-semibold focus:ring-blue-300/40"
                                : `border-transparent bg-slate-50/80 text-gray-700 hover:border-slate-200 ${meta.inputClass}`
                            )}
                          />
                          {isChanged && (
                            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2">
                    {(() => {
                      const priceTop = getDisplayPrice(rt.id, "1");
                      const priceBot = getDisplayPrice(rt.id, "20");
                      if (!priceTop || !priceBot || priceTop === 0) return <span className="text-gray-300 text-center block text-[10px]">—</span>;
                      const ratio = Math.round((priceBot / priceTop) * 100);
                      const discount = 100 - ratio;
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400">▼{discount}%</span>
                            <span className="font-medium text-gray-700">{ratio}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-400 to-red-400 rounded-full transition-all"
                              style={{ width: `${discount}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-400 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <span>変更済みセル</span>
        </div>
        <span>・セルをクリックして金額を入力 → 「変更を保存」で確定</span>
        <span>・「グリッドに反映」でプライシングタブの価格が更新されます</span>
      </div>
    </div>
  );
}
