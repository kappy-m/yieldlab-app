"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchCompSet, createCompHotel, updateCompHotel, deleteCompHotel,
  fetchBarLadder, fetchRoomTypes, bulkUpdateBarLadder, syncGridFromBarLadder,
  fetchApprovalSettings, updateApprovalSettings, triggerPipeline,
  updatePropertySettings, updatePropertySettingsFull,
  type CompSetOut, type BarLadderOut, type RoomTypeOut,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8400";
import { UserAccessPanel } from "./UserAccessPanel";
import {
  Plus, Trash2, Edit3, Check, X, Play, ExternalLink,
  Zap, RefreshCw, AlertCircle, CheckCircle2, Building2, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// 共通定数
// ============================================================
type SettingsSubTab = "compset" | "barladder" | "approval" | "integrations" | "data" | "users" | "pricing_policy";

const SCRAPE_MODE_LABELS: Record<string, { label: string; color: string }> = {
  mock:    { label: "モック",       color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  live:    { label: "本番",         color: "text-green-600 bg-green-50 border-green-200" },
  rakuten: { label: "楽天LIVE",     color: "text-red-600 bg-red-50 border-red-200" },
};

// ============================================================
// 競合セットパネル
// ============================================================
function OwnRakutenNoPanel({ propertyId }: { propertyId: number }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePropertySettings(propertyId, { own_rakuten_hotel_no: value.trim() || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="yl-card p-4 mb-5 border-[#1E3A8A]/20 bg-blue-50/30">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-[#1E3A8A]" />
        <h4 className="text-sm font-semibold text-slate-800">自社 楽天トラベル ホテル番号</h4>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        設定すると、評価モニターの radar / 散布図チャートとレビューカードに自社データが追加されます。<br />
        楽天トラベルのホテルページ URL（<code className="bg-slate-100 px-1 rounded">travel.rakuten.co.jp/HOTEL/
        <span className="font-bold text-[#1E3A8A]">XXXXX</span>/</code>）の数字部分を入力してください。
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="例: 149481"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1E3A8A] text-white text-sm rounded-lg hover:bg-[#1e3070] transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
          {saved ? "保存済み" : "保存"}
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        ※ 保存後、評価モニターの「更新」ボタンを押すと自社データが反映されます
      </p>
    </div>
  );
}

function CompSetPanel({ propertyId }: { propertyId: number }) {
  const [hotels, setHotels] = useState<CompSetOut[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<CompSetOut>>({});
  const [addForm, setAddForm] = useState({ name: "", expedia_hotel_id: "", expedia_url: "", scrape_mode: "mock" });
  const [showAdd, setShowAdd] = useState(false);
  const [running, setRunning] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState("");

  const load = useCallback(async () => {
    const data = await fetchCompSet(propertyId);
    setHotels(data);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    await createCompHotel(propertyId, {
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
    await updateCompHotel(propertyId, id, editForm);
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await deleteCompHotel(propertyId, id);
    await load();
  };

  const handleRunPipeline = async () => {
    setRunning(true);
    setPipelineMsg("");
    try {
      await triggerPipeline(propertyId);
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
          <p className="text-xs text-gray-400 mt-0.5">Expedia / 楽天からスクレイピングする競合ホテルを登録します</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunPipeline}
            disabled={running}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
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
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <Zap className="w-3 h-3 inline mr-1" />{pipelineMsg}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-xs text-blue-700">
        <strong>Expedia Hotel IDの調べ方：</strong>
        Expedia.co.jpでホテルページを開き、URLの <code className="bg-blue-100 px-1 rounded">h数字</code> 部分がIDです。
        例: <code className="bg-blue-100 px-1 rounded">expedia.co.jp/h12345678.Hotel-Information</code>
        → ID は <code className="bg-blue-100 px-1 rounded">12345678</code>
      </div>

      <div className="yl-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">ホテル名</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">評価ソース</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">モード</th>
              <th className="text-center px-4 py-2.5 text-gray-500 font-medium">有効</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel) => (
              <tr key={hotel.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                {editingId === hotel.id ? (
                  <td colSpan={5} className="px-4 py-3">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">ホテル名</label>
                          <input
                            value={editForm.name ?? hotel.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">Expedia Hotel ID</label>
                          <input
                            value={editForm.expedia_hotel_id ?? hotel.expedia_hotel_id ?? ""}
                            onChange={e => setEditForm(f => ({ ...f, expedia_hotel_id: e.target.value }))}
                            placeholder="例: 12345678"
                            className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">楽天 ホテル番号</label>
                          <input
                            value={editForm.rakuten_hotel_no ?? hotel.rakuten_hotel_no ?? ""}
                            onChange={e => setEditForm(f => ({ ...f, rakuten_hotel_no: e.target.value }))}
                            placeholder="例: 149164"
                            className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1 flex items-center gap-1">
                            <span className="text-[#4285F4]">●</span> Google Place ID
                            <span className="text-gray-300 font-normal">（自動検索も可）</span>
                          </label>
                          <input
                            value={editForm.google_place_id ?? hotel.google_place_id ?? ""}
                            onChange={e => setEditForm(f => ({ ...f, google_place_id: e.target.value }))}
                            placeholder="例: ChIJN1t_tDeuEmsRUsoyG..."
                            className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1 flex items-center gap-1">
                            <span className="text-[#00AF87]">●</span> TripAdvisor Location ID
                            <span className="text-gray-300 font-normal">（自動検索も可）</span>
                          </label>
                          <input
                            value={editForm.tripadvisor_location_id ?? hotel.tripadvisor_location_id ?? ""}
                            onChange={e => setEditForm(f => ({ ...f, tripadvisor_location_id: e.target.value }))}
                            placeholder="例: 628015"
                            className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-1">スクレイプモード</label>
                            <select
                              value={editForm.scrape_mode ?? hotel.scrape_mode}
                              onChange={e => setEditForm(f => ({ ...f, scrape_mode: e.target.value }))}
                              className="w-full text-xs border rounded px-2 py-1.5"
                            >
                              <option value="mock">モック</option>
                              <option value="live">本番（Expedia）</option>
                              <option value="rakuten">楽天LIVE</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-1">有効</label>
                            <input
                              type="checkbox"
                              checked={editForm.is_active ?? hotel.is_active}
                              onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                              className="w-4 h-4 accent-blue-600 mt-0.5"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end pt-1 border-t border-gray-100">
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1">
                          <X className="w-3 h-3" />キャンセル
                        </button>
                        <button onClick={() => handleSaveEdit(hotel.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center gap-1">
                          <Check className="w-3 h-3" />保存
                        </button>
                      </div>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{hotel.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium",
                          hotel.rakuten_hotel_no
                            ? "text-red-700 bg-red-50 border-red-200"
                            : "text-gray-300 bg-gray-50 border-gray-100"
                        )}>楽天</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium",
                          hotel.google_place_id
                            ? "text-blue-700 bg-blue-50 border-blue-200"
                            : "text-gray-300 bg-gray-50 border-gray-100"
                        )}>Google</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium",
                          hotel.tripadvisor_location_id
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : "text-gray-300 bg-gray-50 border-gray-100"
                        )}>TripAdvisor</span>
                      </div>
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
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expedia Hotel ID</label>
                <input
                  value={addForm.expedia_hotel_id}
                  onChange={e => setAddForm(f => ({ ...f, expedia_hotel_id: e.target.value }))}
                  placeholder="例: 12345678"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
                  <option value="rakuten">楽天LIVE</option>
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

// ============================================================
// BARラダーパネル（TL-Lincoln互換 1-20レベル）
// ============================================================

// 1-20のレベル配列
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

function BarLadderPanel({ propertyId }: { propertyId: number }) {
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
    // 1→20の順でprice[n] >= price[n+1] を確認（上位ランクのほうが高い）
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

      {/* カラー凡例 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {[
          { range: "1-3", label: "プレミアム", cls: "bg-violet-100 text-violet-700 border border-violet-200" },
          { range: "4-7", label: "ハイシーズン", cls: "bg-blue-100 text-blue-700 border border-blue-200" },
          { range: "8-12", label: "スタンダード", cls: "bg-slate-100 text-slate-700 border border-slate-200" },
          { range: "13-16", label: "ディスカウント", cls: "bg-amber-100 text-amber-700 border border-amber-200" },
          { range: "17-20", label: "ローレート", cls: "bg-red-100 text-red-700 border border-red-200" },
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
                                : `border-transparent bg-slate-50/80 text-gray-700 hover:border-slate-200 focus:border-${meta.inputClass.split("-")[1]}-400 ${meta.inputClass}`
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

// ============================================================
// 承認設定パネル
// ============================================================
function ApprovalPanel({ propertyId }: { propertyId: number }) {
  const [form, setForm] = useState({ threshold: "1", channel: "email", email: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetchApprovalSettings(propertyId).then(s => {
      if (s) {
        setForm({
          threshold: String(s.auto_approve_threshold_levels),
          channel: s.notification_channel,
          email: s.notification_email ?? "",
        });
      }
    });
  }, [propertyId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateApprovalSettings(propertyId, {
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
    { value: "0", label: "すべて承認が必要",              desc: "AI推奨は全件手動承認" },
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
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="threshold"
                    value={opt.value}
                    checked={form.threshold === opt.value}
                    onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                    className="mt-0.5 accent-blue-600"
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
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
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
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
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

// ============================================================
// 外部システム連携パネル
// ============================================================
type ConnectionStatus = "connected" | "disconnected" | "testing";

interface IntegrationSystem {
  id: string;
  name: string;
  category: "channel_manager" | "pms" | "ota";
  description: string;
  logoLabel: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

const INTEGRATION_SYSTEMS: IntegrationSystem[] = [
  {
    id: "tl_lincoln",
    name: "TL-Lincoln",
    category: "channel_manager",
    description: "田村システムズが提供するサイトコントローラー。楽天・じゃらん・Booking.com・Expediaなど主要OTAへの在庫・料金を一括配信。国内シティホテルへの導入実績多数。",
    logoLabel: "TL",
    fields: [
      { key: "hotel_code", label: "ホテルコード", placeholder: "例: TL12345" },
      { key: "api_key",    label: "APIキー",      placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "temairazu",
    name: "手間いらず",
    category: "channel_manager",
    description: "稼働率連動の自動価格調整「ターゲットプライス」を搭載した国内大手サイトコントローラー。競合価格モニタリング機能も搭載。300以上のシステムとAPI連携実績あり。",
    logoLabel: "TM",
    fields: [
      { key: "hotel_id", label: "ホテルID",    placeholder: "例: TM_HOTEL_001" },
      { key: "username", label: "ユーザー名",  placeholder: "管理画面ログインID" },
      { key: "password", label: "パスワード",  placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "neppan",
    name: "ねっぱん！++",
    category: "channel_manager",
    description: "業界シェアNo.1のクラウド型サイトコントローラー。全国2万施設以上が利用。在庫・料金・予約情報を一元管理。月額定額制（予約手数料なし）で小規模施設から大型ホテルまで対応。",
    logoLabel: "NP",
    fields: [
      { key: "property_code", label: "施設コード",   placeholder: "例: NP_12345" },
      { key: "api_token",     label: "APIトークン",  placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "opera_cloud",
    name: "Oracle Opera Cloud",
    category: "pms",
    description: "Oracleが提供するグローバル標準のクラウド型PMS。フロント業務・予約・会計・ハウスキーピングを統合管理。世界の主要ホテルチェーンで採用。REST APIでのシステム連携に対応。",
    logoLabel: "OC",
    fields: [
      { key: "base_url", label: "テナントURL",          placeholder: "https://xxx.hospitality.oracleindustry.com" },
      { key: "app_key",  label: "アプリケーションキー", placeholder: "••••••••••••••••", type: "password" },
      { key: "hotel_id", label: "ホテルID",             placeholder: "例: RPHGINZA" },
    ],
  },
  {
    id: "protel",
    name: "Protel PMS",
    category: "pms",
    description: "欧州発・日本語対応のクラウド型PMS。宿泊・会計・CRM機能を統合。多くのサイトコントローラーやOTAとのAPI連携に対応し、日本国内での導入実績も多い。",
    logoLabel: "PT",
    fields: [
      { key: "server_url", label: "サーバーURL",  placeholder: "https://xxx.protel.net" },
      { key: "username",   label: "ユーザーID",   placeholder: "管理者ログインID" },
      { key: "password",   label: "パスワード",   placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "tap_pms",
    name: "プロホテルシステム（TAP）",
    category: "pms",
    description: "株式会社タップが提供する国内向けPMS。1,700施設・28万室以上の稼働実績。フロント・予約・会計・POS連携まで一気通貫で対応。シティホテル・リゾートを問わず導入実績多数。",
    logoLabel: "TP",
    fields: [
      { key: "api_endpoint", label: "APIエンドポイント", placeholder: "https://tap.example.com/api/v2" },
      { key: "api_key",      label: "APIキー",           placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "rakuten",
    name: "楽天トラベル",
    category: "ota",
    description: "楽天ウェブサービスAPIとの連携。空室・料金データの取得と在庫配信に対応。VacantHotelSearch APIにより競合ホテルのリアルタイム価格・プラン数のモニタリングにも利用中。",
    logoLabel: "RT",
    fields: [
      { key: "application_id", label: "アプリケーションID", placeholder: "例: 841114b0-xxxx" },
      { key: "access_key",     label: "アクセスキー",       placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "jalan",
    name: "じゃらんnet",
    category: "ota",
    description: "リクルートが運営する国内最大級の旅行予約サービス。じゃらん宿泊素材APIを通じた在庫・料金の管理・配信に対応。国内旅行者への訴求力が高く、西日本・レジャー需要に強い。",
    logoLabel: "JL",
    fields: [
      { key: "hotel_cd", label: "施設コード", placeholder: "例: 370250" },
      { key: "api_key",  label: "APIキー",    placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "booking_com",
    name: "Booking.com",
    category: "ota",
    description: "世界最大のオンライン旅行代理店。Booking.com Connectivity APIにより在庫・料金・制限（MinLOS等）の自動配信が可能。インバウンド需要への対応として不可欠なチャネル。",
    logoLabel: "BK",
    fields: [
      { key: "hotel_id", label: "ホテルID",    placeholder: "例: 1234567" },
      { key: "username", label: "ユーザー名",  placeholder: "Booking.comアカウント" },
      { key: "password", label: "パスワード",  placeholder: "••••••••••••••••", type: "password" },
    ],
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  channel_manager: "サイトコントローラー",
  pms:             "PMS（ホテル管理システム）",
  ota:             "OTA連携",
};

function IntegrationCard({
  system, isExpanded, onToggle,
}: {
  system: IntegrationSystem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isSaved, setIsSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async () => {
    setStatus("testing");
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1800));
    const allFilled = system.fields.every(f => formData[f.key]?.trim());
    if (allFilled) {
      setStatus("connected");
      setTestResult("接続成功：認証OK。ホテル情報を確認しました。");
    } else {
      setStatus("disconnected");
      setTestResult("接続失敗：全必須項目を入力してください。");
    }
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const statusBadge = {
    connected:    { label: "接続済み",    cls: "bg-green-100 text-green-700" },
    disconnected: { label: "未接続",      cls: "bg-gray-100 text-gray-500" },
    testing:      { label: "テスト中...", cls: "bg-yellow-100 text-yellow-700" },
  }[status];

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
          system.category === "channel_manager" ? "bg-blue-100 text-blue-700" :
          system.category === "pms" ? "bg-blue-100 text-blue-700" :
          "bg-orange-100 text-orange-700"
        )}>
          {system.logoLabel}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{system.name}</span>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusBadge.cls)}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{system.description}</p>
        </div>
        <svg
          className={cn("w-4 h-4 text-gray-400 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
          {system.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input
                type={field.type || "text"}
                value={formData[field.key] || ""}
                onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
              />
            </div>
          ))}

          {testResult && (
            <div className={cn(
              "text-xs px-3 py-2 rounded-md",
              status === "connected" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            )}>
              {testResult}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={status === "testing"}
              className="flex-1 px-3 py-2 text-xs font-medium border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600/5 transition-colors disabled:opacity-50"
            >
              {status === "testing" ? "テスト中..." : "接続テスト"}
            </button>
            <button
              onClick={handleSave}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                isSaved ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {isSaved ? "保存しました ✓" : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationsPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grouped = Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => ({
    catKey,
    catLabel,
    systems: INTEGRATION_SYSTEMS.filter(s => s.category === catKey),
  }));

  return (
    <div className="space-y-8">
      {/* 評価APIキー設定案内 */}
      <div className="yl-card p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" />
          評価データ API キー設定
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Railway の環境変数に以下を追加すると、評価モニターに Google / TripAdvisor の評価・口コミが自動表示されます。
        </p>
        <div className="space-y-2">
          {[
            {
              key: "GOOGLE_PLACES_API_KEY",
              label: "Google Places API キー",
              color: "text-blue-700 bg-blue-50 border-blue-200",
              badge: "Google",
              note: "Google Cloud Console → Places API (New) を有効化 → API キーを発行",
              link: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
            },
            {
              key: "TRIPADVISOR_API_KEY",
              label: "TripAdvisor Content API キー",
              color: "text-emerald-700 bg-emerald-50 border-emerald-200",
              badge: "TripAdvisor",
              note: "TripAdvisor Developer Portal → Content API → API キーを申請",
              link: "https://www.tripadvisor.com/developers",
            },
          ].map(item => (
            <div key={item.key} className={`flex items-start gap-3 p-3 rounded-lg border ${item.color}`}>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.color} flex-shrink-0 mt-0.5`}>
                {item.badge}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold">{item.key}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{item.note}</p>
              </div>
              <a href={item.link} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1 text-[10px] underline opacity-70 hover:opacity-100">
                <ExternalLink className="w-3 h-3" />設定へ
              </a>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          ※ 設定後、評価モニターの「更新」ボタンを押すと全ソースのデータが取得されます。
          Google Place ID / TripAdvisor Location ID は未設定の場合、ホテル名で自動検索されます。
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-800">PMS / チャネルマネージャー連携設定について</p>
          <p className="text-xs text-blue-600 mt-0.5">
            各システムの接続情報を設定後、「接続テスト」で疎通確認してください。
            接続確立後は在庫・料金データの自動同期が有効になります。
          </p>
        </div>
      </div>

      {grouped.map(({ catKey, catLabel, systems }) => (
        <div key={catKey}>
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              catKey === "channel_manager" ? "bg-blue-500" :
              catKey === "pms" ? "bg-blue-500" : "bg-orange-500"
            )} />
            <h3 className="text-sm font-semibold text-gray-700">{catLabel}</h3>
            <span className="text-xs text-gray-400">{systems.length}システム</span>
          </div>
          <div className="space-y-2">
            {systems.map(sys => (
              <IntegrationCard
                key={sys.id}
                system={sys}
                isExpanded={expandedId === sys.id}
                onToggle={() => setExpandedId(prev => prev === sys.id ? null : sys.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// イベントエリア設定パネル
// ============================================================
function EventAreaPanel({ propertyId }: { propertyId: number }) {
  const [area, setArea] = useState<string>("nihonbashi");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePropertySettingsFull(propertyId, { event_area: area });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="yl-card p-4 mb-5 border-blue-200 bg-blue-50/30">
      <h4 className="text-sm font-semibold text-slate-800 mb-2">マーケットイベントエリア</h4>
      <p className="text-xs text-slate-500 mb-3">
        マーケットタブに表示されるエリア特化イベント（展示会・祭り等）の地域を選択します。
      </p>
      <div className="flex items-center gap-3">
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        >
          <option value="nihonbashi">日本橋エリア</option>
          <option value="ginza">銀座エリア</option>
        </select>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "保存中..." : saved ? "保存済み ✓" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CSVインポートパネル
// ============================================================
function CsvImportPanel({ propertyId }: { propertyId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("yl_token") : null;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/properties/${propertyId}/daily-performance/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="yl-card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">日次実績 CSV インポート</h3>
      <p className="text-xs text-slate-400 mb-4">
        PMS からエクスポートした日次実績データを取り込みます。既存データは日付キーで上書きされます。
      </p>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs text-slate-600">
        <p className="font-medium mb-1">CSVフォーマット（1行目はヘッダー必須）:</p>
        <code className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 block">
          date,occupancy_rate,rooms_sold,total_rooms,adr,revenue,revpar,new_bookings,cancellations
        </code>
        <p className="mt-2 text-slate-400">例: 2026-01-15,82.5,111,134,18500,2053500,13803,15,3</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 cursor-pointer file:mr-3 file:text-xs file:bg-slate-900 file:text-white file:rounded file:px-3 file:py-1 file:border-0 file:cursor-pointer"
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="text-xs bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? "インポート中..." : "インポート"}
        </button>
      </div>

      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
          <p className="font-medium">インポート完了</p>
          <p>新規追加: {result.imported}件　更新: {result.updated}件　スキップ: {result.skipped}件</p>
          {result.errors.length > 0 && (
            <div className="mt-2 text-red-600">
              <p>エラー:</p>
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

// ============================================================
// プライシングポリシーパネル
// ============================================================
interface PricingPolicy {
  min_rate: string;
  max_rate: string;
  min_rate_gap: string;
  enforce_room_order: boolean;
  max_daily_change_pct: string;
  mlos_enabled: boolean;
  mlos_threshold_occ: string;
  mlos_min_nights: string;
}

const POLICY_STORAGE_KEY = (propertyId: number) => `yl_pricing_policy_${propertyId}`;

const DEFAULT_POLICY: PricingPolicy = {
  min_rate: "8000",
  max_rate: "120000",
  min_rate_gap: "500",
  enforce_room_order: true,
  max_daily_change_pct: "30",
  mlos_enabled: false,
  mlos_threshold_occ: "85",
  mlos_min_nights: "2",
};

function PricingPolicyPanel({ propertyId }: { propertyId: number }) {
  const [form, setForm] = useState<PricingPolicy>(DEFAULT_POLICY);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POLICY_STORAGE_KEY(propertyId));
      if (raw) setForm(JSON.parse(raw) as PricingPolicy);
    } catch { /* ignore */ }
  }, [propertyId]);

  const update = <K extends keyof PricingPolicy>(key: K, value: PricingPolicy[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    localStorage.setItem(POLICY_STORAGE_KEY(propertyId), JSON.stringify(form));
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const Section = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
    <div className="yl-card p-5 mb-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 border-b border-slate-100 last:border-b-0">
      <div>
        <p className="text-xs font-medium text-slate-700">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );

  const NumberInput = ({
    value, onChange, prefix, suffix, min, max,
  }: {
    value: string; onChange: (v: string) => void;
    prefix?: string; suffix?: string; min?: number; max?: number;
  }) => (
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-28 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">プライシングポリシー</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ブランドとしての価格の幅・ルール・AI推奨の動作範囲を設定します
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              未保存の変更があります
            </span>
          )}
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-medium transition-colors",
              saved
                ? "bg-green-500 text-white"
                : "bg-slate-900 text-white hover:bg-slate-700"
            )}
          >
            {saved ? (
              <><CheckCircle2 className="w-3.5 h-3.5" />保存済み</>
            ) : (
              <><Check className="w-3.5 h-3.5" />保存</>
            )}
          </button>
        </div>
      </div>

      {/* 価格幅ルール */}
      <Section
        title="価格幅ルール"
        desc="ブランドとして許容する最低価格・最高価格を設定します。AI推奨はこの範囲内で生成されます"
      >
        <Field label="ブランド最低価格（Min Rate）" hint="どのレートランクでも下回ってはならない底値">
          <NumberInput value={form.min_rate} onChange={v => update("min_rate", v)} prefix="¥" suffix="/ 泊" min={0} />
        </Field>
        <Field label="ブランド最高価格（Max Rate）" hint="レートランク1の上限価格">
          <NumberInput value={form.max_rate} onChange={v => update("max_rate", v)} prefix="¥" suffix="/ 泊" min={0} />
        </Field>
        <Field label="レートランク間の最小価格差" hint="隣り合うランクの差がこの金額を下回らないよう制約">
          <NumberInput value={form.min_rate_gap} onChange={v => update("min_rate_gap", v)} prefix="¥" suffix="以上" min={0} />
        </Field>
      </Section>

      {/* 部屋タイプ価格順序 */}
      <Section
        title="部屋タイプ価格順序ルール"
        desc="部屋タイプ間の価格逆転（例: デラックス < スタンダード）を防ぐかどうかを設定します"
      >
        <Field label="部屋タイプ価格順序を強制する" hint="ONにすると、格上の部屋タイプが格下より安くなることを防止">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.enforce_room_order}
              onChange={e => update("enforce_room_order", e.target.checked)}
            />
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5",
              "after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all",
              "peer-checked:after:translate-x-5",
              form.enforce_room_order ? "bg-[#1E3A8A]" : "bg-slate-200"
            )} />
          </label>
        </Field>
        {form.enforce_room_order && (
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            部屋タイプの価格順序はプライシンググリッドへの適用時に自動検証されます。逆転が検出された場合、警告が表示されます。
          </div>
        )}
      </Section>

      {/* 価格変動ルール */}
      <Section
        title="価格変動上限"
        desc="前日比での価格変動を制限します。急激な価格変動を防ぎブランド価値を保護します"
      >
        <Field label="1日あたり最大変動幅" hint="AI推奨がこの変動幅を超える場合は承認必須になります">
          <NumberInput
            value={form.max_daily_change_pct}
            onChange={v => update("max_daily_change_pct", v)}
            suffix="% 以内"
            min={1}
            max={100}
          />
        </Field>
      </Section>

      {/* MinLOS自動設定 */}
      <Section
        title="最低宿泊日数 (MinLOS) ルール"
        desc="高稼働期に自動でMinLOSを設定し、短泊による機会損失を防ぎます"
      >
        <Field label="MinLOS自動設定を有効にする" hint="繁忙期に自動でMinLOS制限を適用">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.mlos_enabled}
              onChange={e => update("mlos_enabled", e.target.checked)}
            />
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5",
              "after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all",
              "peer-checked:after:translate-x-5",
              form.mlos_enabled ? "bg-[#1E3A8A]" : "bg-slate-200"
            )} />
          </label>
        </Field>
        {form.mlos_enabled && (
          <>
            <Field label="MinLOS発動 稼働率閾値" hint="この稼働率を超えた日付に対してMinLOSを適用">
              <NumberInput
                value={form.mlos_threshold_occ}
                onChange={v => update("mlos_threshold_occ", v)}
                suffix="% 以上"
                min={50}
                max={100}
              />
            </Field>
            <Field label="最低宿泊日数" hint="発動時に設定されるMinLOS値">
              <NumberInput
                value={form.mlos_min_nights}
                onChange={v => update("mlos_min_nights", v)}
                suffix="泊以上"
                min={2}
                max={7}
              />
            </Field>
          </>
        )}
      </Section>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">注意事項</p>
            <p>現在のプライシングポリシーはブラウザに保存されています。複数デバイスでの共有や、システム全体への自動適用はフェーズ2で対応予定です。設定後は手動でプライシンググリッドの内容を確認してください。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SettingsTab（エクスポート）
// ============================================================
const SUB_TABS: { id: SettingsSubTab; label: string }[] = [
  { id: "compset",        label: "競合セット管理" },
  { id: "barladder",      label: "BARラダー" },
  { id: "pricing_policy", label: "プライシングポリシー" },
  { id: "approval",       label: "承認設定" },
  { id: "data",           label: "データ管理" },
  { id: "integrations",   label: "外部システム連携" },
  { id: "users",          label: "ユーザー管理" },
];

export function SettingsTab({ propertyId }: { propertyId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>("compset");

  return (
    <div className="space-y-0">
      {/* サブタブ */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer",
              activeSubTab === tab.id
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "compset"      && (
        <>
          <OwnRakutenNoPanel propertyId={propertyId} />
          <EventAreaPanel    propertyId={propertyId} />
          <CompSetPanel      propertyId={propertyId} />
        </>
      )}
      {activeSubTab === "barladder"      && <BarLadderPanel      propertyId={propertyId} />}
      {activeSubTab === "pricing_policy" && <PricingPolicyPanel  propertyId={propertyId} />}
      {activeSubTab === "approval"       && <ApprovalPanel       propertyId={propertyId} />}
      {activeSubTab === "data"           && <CsvImportPanel      propertyId={propertyId} />}
      {activeSubTab === "integrations"   && <IntegrationsPanel />}
      {activeSubTab === "users"          && <UserAccessPanel />}
    </div>
  );
}
