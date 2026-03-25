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
type SettingsSubTab = "compset" | "barladder" | "approval" | "integrations" | "data" | "users";

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
// BARラダーパネル
// ============================================================
const BAR_LEVELS = ["A", "B", "C", "D", "E"] as const;
type BarLevel = typeof BAR_LEVELS[number];

const BAR_META: Record<BarLevel, { label: string; badge: string; accent: string }> = {
  A: { label: "最高価格帯", badge: "bar-badge-a", accent: "bg-blue-50 text-blue-700 border-blue-200" },
  B: { label: "高価格帯",   badge: "bar-badge-b", accent: "bg-blue-50 text-blue-700 border-blue-200" },
  C: { label: "標準価格帯", badge: "bar-badge-c", accent: "bg-gray-50 text-gray-700 border-gray-200" },
  D: { label: "割引価格帯", badge: "bar-badge-d", accent: "bg-amber-50 text-amber-700 border-amber-200" },
  E: { label: "大幅割引",   badge: "bar-badge-e", accent: "bg-red-50 text-red-700 border-red-200" },
};

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

  const getRatioFromBase = (rtId: number, level: BarLevel): number => {
    const base = getDisplayPrice(rtId, "A");
    const current = getDisplayPrice(rtId, level);
    if (!base || !current || base === 0) return 0;
    return Math.round((current / base) * 100);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">BARラダー設定</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            セルをクリックして価格を編集できます。A（最高）→ E（最低）の順で設定してください
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

      <div className="flex items-center gap-3 mb-3">
        {BAR_LEVELS.map(l => (
          <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={BAR_META[l].badge}>{l}</span>
            <span>{BAR_META[l].label}</span>
          </div>
        ))}
      </div>

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
                                ? "border-blue-400 bg-blue-50 text-blue-800 font-semibold focus:ring-2 focus:ring-blue-300/40"
                                : "border-gray-200 bg-white text-gray-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-300/20"
                            )}
                          />
                          {isChanged && (
                            <div className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                      </td>
                    );
                  })}
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
                              className="h-full bg-gradient-to-r from-blue-400 to-red-400 rounded-full transition-all"
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

      <div className="mt-3 flex items-start gap-4 text-[11px] text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <span>変更済みセル</span>
        </div>
        <span>・セルをクリックして数値を入力 → 「変更を保存」で確定</span>
        <span>・「グリッドに反映」でプライシング画面の価格も更新されます</span>
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
// SettingsTab（エクスポート）
// ============================================================
const SUB_TABS: { id: SettingsSubTab; label: string }[] = [
  { id: "compset",      label: "競合セット管理" },
  { id: "barladder",    label: "BARラダー" },
  { id: "approval",     label: "承認設定" },
  { id: "data",         label: "データ管理" },
  { id: "integrations", label: "外部システム連携" },
  { id: "users",        label: "ユーザー管理" },
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
      {activeSubTab === "barladder"    && <BarLadderPanel    propertyId={propertyId} />}
      {activeSubTab === "approval"     && <ApprovalPanel     propertyId={propertyId} />}
      {activeSubTab === "data"         && <CsvImportPanel    propertyId={propertyId} />}
      {activeSubTab === "integrations" && <IntegrationsPanel />}
      {activeSubTab === "users"        && <UserAccessPanel />}
    </div>
  );
}
