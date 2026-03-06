"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import {
  fetchCompSet, createCompHotel, updateCompHotel, deleteCompHotel,
  fetchBarLadder, fetchRoomTypes, bulkUpdateBarLadder, syncGridFromBarLadder,
  fetchApprovalSettings, updateApprovalSettings, triggerPipeline,
  PROPERTY_ID,
  type CompSetOut, type BarLadderOut, type RoomTypeOut,
} from "@/lib/api";
import { Plus, Trash2, Edit3, Check, X, Play, ExternalLink, Zap, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "compset" | "barladder" | "approval";

const SCRAPE_MODE_LABELS: Record<string, { label: string; color: string }> = {
  mock: { label: "モック", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  live: { label: "本番", color: "text-green-600 bg-green-50 border-green-200" },
};

function CompSetPanel() {
  const [hotels, setHotels] = useState<CompSetOut[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<CompSetOut>>({});
  const [addForm, setAddForm] = useState({ name: "", expedia_hotel_id: "", expedia_url: "", scrape_mode: "mock" });
  const [showAdd, setShowAdd] = useState(false);
  const [running, setRunning] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState("");

  const load = useCallback(async () => {
    const data = await fetchCompSet(PROPERTY_ID);
    setHotels(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    await createCompHotel(PROPERTY_ID, {
      name: addForm.name,
      expedia_hotel_id: addForm.expedia_hotel_id || undefined,
      expedia_url: addForm.expedia_url || undefined,
      scrape_mode: addForm.scrape_mode,
      sort_order: hotels.length,
    });
    setAddForm({ name: "", expedia_hotel_id: "", expedia_url: "", scrape_mode: "mock" });
    setShowAdd(false);
    await load();
  };

  const handleSaveEdit = async (id: number) => {
    await updateCompHotel(PROPERTY_ID, id, editForm);
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await deleteCompHotel(PROPERTY_ID, id);
    await load();
  };

  const handleRunPipeline = async () => {
    setRunning(true);
    setPipelineMsg("");
    try {
      await triggerPipeline(PROPERTY_ID);
      setPipelineMsg("パイプラインを起動しました。約30秒後に競合価格データが更新されます。");
    } catch {
      setPipelineMsg("エラーが発生しました。");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">競合セット（Comp Set）</h2>
          <p className="text-xs text-gray-400 mt-0.5">Expedia からスクレイピングする競合ホテルを登録します</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunPipeline}
            disabled={running}
            className="flex items-center gap-1.5 text-xs bg-[#7C3AED] text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            <Play className="w-3 h-3" />
            {running ? "実行中..." : "今すぐ実行"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 font-medium"
          >
            <Plus className="w-3 h-3" />
            ホテル追加
          </button>
        </div>
      </div>

      {pipelineMsg && (
        <div className="mb-4 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
          <Zap className="w-3 h-3 inline mr-1" />{pipelineMsg}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-xs text-blue-700">
        <strong>Expedia Hotel IDの調べ方：</strong>
        Expedia.co.jpでホテルページを開き、URLの <code className="bg-blue-100 px-1 rounded">h数字</code> 部分がIDです。
        例: <code className="bg-blue-100 px-1 rounded">expedia.co.jp/h12345678.Hotel-Information</code>
        →  ID は <code className="bg-blue-100 px-1 rounded">12345678</code>
      </div>

      <div className="yl-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">ホテル名</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Expedia ID</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">モード</th>
              <th className="text-center px-4 py-2.5 text-gray-500 font-medium">有効</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel) => (
              <tr key={hotel.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                {editingId === hotel.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.name ?? hotel.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.expedia_hotel_id ?? hotel.expedia_hotel_id ?? ""}
                        onChange={e => setEditForm(f => ({ ...f, expedia_hotel_id: e.target.value }))}
                        placeholder="例: 12345678"
                        className="w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editForm.scrape_mode ?? hotel.scrape_mode}
                        onChange={e => setEditForm(f => ({ ...f, scrape_mode: e.target.value }))}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="mock">モック</option>
                        <option value="live">本番（Expedia）</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={editForm.is_active ?? hotel.is_active}
                        onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-purple-600"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleSaveEdit(hotel.id)} className="text-green-600 hover:text-green-700 p-1">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{hotel.name}</td>
                    <td className="px-4 py-2.5">
                      {hotel.expedia_hotel_id ? (
                        <div className="flex items-center gap-1">
                          <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{hotel.expedia_hotel_id}</code>
                          {hotel.expedia_url && (
                            <a href={hotel.expedia_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", SCRAPE_MODE_LABELS[hotel.scrape_mode]?.color)}>
                        {SCRAPE_MODE_LABELS[hotel.scrape_mode]?.label ?? hotel.scrape_mode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={hotel.is_active ? "text-green-500" : "text-gray-300"}>
                        {hotel.is_active ? "●" : "○"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingId(hotel.id); setEditForm({}); }}
                          className="text-gray-400 hover:text-gray-700 p-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(hotel.id)} className="text-gray-400 hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {hotels.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  競合ホテルが登録されていません。「ホテル追加」から登録してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {showAdd && (
          <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
            <div className="text-xs font-medium text-gray-700 mb-3">新しい競合ホテルを追加</div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">ホテル名 *</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例: セルリアンタワー東急ホテル"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expedia Hotel ID</label>
                <input
                  value={addForm.expedia_hotel_id}
                  onChange={e => setAddForm(f => ({ ...f, expedia_hotel_id: e.target.value }))}
                  placeholder="例: 12345678"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">スクレイプモード</label>
                <select
                  value={addForm.scrape_mode}
                  onChange={e => setAddForm(f => ({ ...f, scrape_mode: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                >
                  <option value="mock">モック（テスト用）</option>
                  <option value="live">本番（Expedia）</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleAdd} className="flex-1 text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-700 font-medium">追加</button>
                <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">キャンセル</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const BAR_LEVELS = ["A", "B", "C", "D", "E"] as const;
type BarLevel = typeof BAR_LEVELS[number];

const BAR_META: Record<BarLevel, { label: string; badge: string; accent: string }> = {
  A: { label: "最高価格帯", badge: "bar-badge-a", accent: "bg-purple-50 text-purple-700 border-purple-200" },
  B: { label: "高価格帯",   badge: "bar-badge-b", accent: "bg-blue-50 text-blue-700 border-blue-200" },
  C: { label: "標準価格帯", badge: "bar-badge-c", accent: "bg-gray-50 text-gray-700 border-gray-200" },
  D: { label: "割引価格帯", badge: "bar-badge-d", accent: "bg-amber-50 text-amber-700 border-amber-200" },
  E: { label: "大幅割引",   badge: "bar-badge-e", accent: "bg-red-50 text-red-700 border-red-200" },
};

// roomTypeId → level → { id, price } のマップを構築するヘルパー
type CellKey = `${number}-${BarLevel}`;
type EditMap = Map<CellKey, { id: number; price: number }>;

function buildEditMap(bars: BarLadderOut[]): EditMap {
  const m = new Map<CellKey, { id: number; price: number }>();
  for (const b of bars) {
    if (b.room_type_id != null) {
      m.set(`${b.room_type_id}-${b.level as BarLevel}`, { id: b.id, price: b.price });
    }
  }
  return m;
}

function BarLadderPanel() {
  const [roomTypes, setRoomTypes] = useState<RoomTypeOut[]>([]);
  // 編集中のセル: key → 編集後の価格文字列
  const [edits, setEdits] = useState<Map<CellKey, string>>(new Map());
  const [editMap, setEditMap] = useState<EditMap>(new Map());
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // バリデーションエラー: roomTypeId → エラーメッセージ
  const [validationErrors, setValidationErrors] = useState<Map<number, string>>(new Map());

  const load = useCallback(async () => {
    const [rts, bars] = await Promise.all([
      fetchRoomTypes(PROPERTY_ID),
      fetchBarLadder(PROPERTY_ID),
    ]);
    setRoomTypes(rts);
    setEditMap(buildEditMap(bars));
    setEdits(new Map());
  }, []);

  useEffect(() => { load(); }, [load]);

  const getDisplayPrice = (rtId: number, level: BarLevel): number | null => {
    const key: CellKey = `${rtId}-${level}`;
    const editVal = edits.get(key);
    if (editVal !== undefined) {
      const n = parseInt(editVal.replace(/,/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    return editMap.get(key)?.price ?? null;
  };

  const handleCellChange = (rtId: number, level: BarLevel, raw: string) => {
    const key: CellKey = `${rtId}-${level}`;
    const newEdits = new Map(edits);
    newEdits.set(key, raw.replace(/[^0-9]/g, ""));
    setEdits(newEdits);
    // バリデーション
    validateRow(rtId, newEdits);
  };

  const validateRow = (rtId: number, currentEdits: Map<CellKey, string>) => {
    const prices = BAR_LEVELS.map(l => {
      const key: CellKey = `${rtId}-${l}`;
      const editVal = currentEdits.get(key);
      if (editVal !== undefined) return parseInt(editVal, 10) || 0;
      return editMap.get(key)?.price ?? 0;
    });
    const errors = new Map(validationErrors);
    for (let i = 0; i < prices.length - 1; i++) {
      if (prices[i] !== 0 && prices[i + 1] !== 0 && prices[i] <= prices[i + 1]) {
        errors.set(rtId, `${BAR_LEVELS[i]}>${BAR_LEVELS[i + 1]} の順序で設定してください（A>B>C>D>E）`);
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
      if (items.length > 0) {
        await bulkUpdateBarLadder(PROPERTY_ID, items);
      }
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
      const result = await syncGridFromBarLadder(PROPERTY_ID);
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

  // 各部屋タイプのレベル間の価格比率をビジュアル化
  const getRatioFromBase = (rtId: number, level: BarLevel): number => {
    const base = getDisplayPrice(rtId, "A");
    const current = getDisplayPrice(rtId, level);
    if (!base || !current || base === 0) return 0;
    return Math.round((current / base) * 100);
  };

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">BARラダー設定</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            セルをクリックして価格を編集できます。A（最高）→ E（最低）の順で設定してください
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={discardEdits}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
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

      {/* フィードバックメッセージ */}
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

      {/* バリデーションエラー */}
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

      {/* 凡例 */}
      <div className="flex items-center gap-3 mb-3">
        {BAR_LEVELS.map(l => (
          <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={BAR_META[l].badge}>{l}</span>
            <span>{BAR_META[l].label}</span>
          </div>
        ))}
      </div>

      {/* グリッド */}
      <div className="yl-card overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-gray-500 font-medium w-44">部屋タイプ</th>
              {BAR_LEVELS.map(l => (
                <th key={l} className="px-3 py-3 min-w-[140px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={BAR_META[l].badge}>{l}</span>
                    <span className="text-[10px] text-gray-400">{BAR_META[l].label}</span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-gray-500 font-medium text-center min-w-[120px]">
                <span className="text-[10px]">E/A 比率</span>
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
                    hasError ? "bg-red-50/40" : rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30",
                  )}
                >
                  <td className="px-5 py-2.5 font-medium text-gray-800 whitespace-nowrap">{rt.name}</td>

                  {BAR_LEVELS.map(level => {
                    const key: CellKey = `${rt.id}-${level}`;
                    const isEditing = edits.has(key);
                    const displayPrice = getDisplayPrice(rt.id, level);
                    const originalPrice = editMap.get(key)?.price ?? null;
                    const isChanged = isEditing && displayPrice !== originalPrice;

                    return (
                      <td key={level} className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">¥</span>
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
                            onChange={e => handleCellChange(rt.id, level, e.target.value)}
                            onFocus={e => {
                              // フォーカス時はカンマなしの数値に切り替え
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
                                const newErrors = new Map(validationErrors);
                                newErrors.delete(rt.id);
                                setValidationErrors(newErrors);
                              }
                            }}
                            className={cn(
                              "w-full pl-6 pr-2 py-1.5 text-right text-xs rounded-lg border transition-all focus:outline-none",
                              isChanged
                                ? "border-purple-400 bg-purple-50 text-purple-800 font-semibold focus:ring-2 focus:ring-purple-300/40"
                                : "border-gray-200 bg-white text-gray-800 focus:border-purple-400 focus:ring-2 focus:ring-purple-300/20"
                            )}
                          />
                          {isChanged && (
                            <div className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-purple-500 rounded-full" />
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* E/A 比率インジケーター */}
                  <td className="px-3 py-2">
                    {(() => {
                      const ratioE = getRatioFromBase(rt.id, "E");
                      const ratioA = getDisplayPrice(rt.id, "A");
                      const priceE = getDisplayPrice(rt.id, "E");
                      if (!ratioA || !priceE) return <span className="text-gray-300 text-center block">—</span>;
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400">割引幅</span>
                            <span className="font-medium text-gray-700">{100 - ratioE}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-400 to-red-400 rounded-full transition-all"
                              style={{ width: `${100 - ratioE}%` }}
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

      {/* 操作ガイド */}
      <div className="mt-3 flex items-start gap-4 text-[11px] text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full" />
          <span>変更済みセル</span>
        </div>
        <span>・セルをクリックして数値を入力 → 「変更を保存」で確定</span>
        <span>・「グリッドに反映」でプライシング画面の価格も更新されます</span>
      </div>
    </div>
  );
}

function ApprovalPanel() {
  const [form, setForm] = useState({ threshold: "1", channel: "email", email: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetchApprovalSettings(PROPERTY_ID).then(s => {
      if (s) {
        setForm({
          threshold: String(s.auto_approve_threshold_levels),
          channel: s.notification_channel,
          email: s.notification_email ?? "",
        });
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateApprovalSettings(PROPERTY_ID, {
        auto_approve_threshold_levels: parseInt(form.threshold),
        notification_channel: form.channel,
        notification_email: form.email || undefined,
      });
      setSaveMsg({ type: "ok", text: "設定を保存しました" });
    } catch {
      setSaveMsg({ type: "err", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  const THRESHOLD_OPTIONS = [
    { value: "0", label: "すべて承認が必要", desc: "AI推奨は全件手動承認" },
    { value: "1", label: "1ランク変動まで自動承認（推奨）", desc: "例: C→B は自動反映" },
    { value: "2", label: "2ランク変動まで自動承認",        desc: "例: C→A も自動反映" },
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">承認設定</h2>
        <p className="text-xs text-gray-400 mt-0.5">自動承認の閾値と通知先を設定します</p>
      </div>
      <div className="yl-card p-6 max-w-lg">
        {saveMsg && (
          <div className={cn(
            "mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-medium",
            saveMsg.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          )}>
            {saveMsg.type === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {saveMsg.text}
          </div>
        )}
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">自動承認の閾値</label>
            <div className="space-y-2">
              {THRESHOLD_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    form.threshold === opt.value
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="threshold"
                    value={opt.value}
                    checked={form.threshold === opt.value}
                    onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                    className="mt-0.5 accent-purple-600"
                  />
                  <div>
                    <div className="text-xs font-medium text-gray-800">{opt.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">承認待ちの通知チャネル</label>
            <select
              value={form.channel}
              onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
            >
              <option value="email">Email</option>
              <option value="slack">Slack（近日対応予定）</option>
              <option value="line">LINE（近日対応予定）</option>
            </select>
          </div>

          {form.channel === "email" && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">通知先メールアドレス</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="rm@yourhotel.com"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              />
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "設定を保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("compset");

  const tabs: { id: Tab; label: string }[] = [
    { id: "compset", label: "競合セット" },
    { id: "barladder", label: "BARラダー" },
    { id: "approval", label: "承認設定" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader propertyId={1} onPropertyChange={() => {}} />
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-gray-900">設定</h1>
          <p className="text-xs text-gray-400 mt-0.5">東京・渋谷ホテル の各種設定を管理します</p>
        </div>

        <div className="flex gap-1 mb-5 border-b border-gray-200 pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "text-[#7C3AED] border-[#7C3AED]"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "compset" && <CompSetPanel />}
        {activeTab === "barladder" && <BarLadderPanel />}
        {activeTab === "approval" && <ApprovalPanel />}
      </div>
    </div>
  );
}
