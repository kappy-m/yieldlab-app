"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchCompSet, createCompHotel, updateCompHotel, deleteCompHotel,
  triggerPipeline,
  type CompSetOut,
} from "@/lib/api";
import { Plus, Trash2, Edit3, Check, X, Play, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SCRAPE_MODE_LABELS: Record<string, { label: string; color: string }> = {
  mock:    { label: "モック",   color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  live:    { label: "本番",     color: "text-green-600 bg-green-50 border-green-200" },
  rakuten: { label: "楽天LIVE", color: "text-red-600 bg-red-50 border-red-200" },
};

export function CompSetPanel({ propertyId }: { propertyId: number }) {
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
