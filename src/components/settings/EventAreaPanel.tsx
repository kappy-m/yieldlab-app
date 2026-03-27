"use client";

import { useState } from "react";
import { updatePropertySettingsFull } from "@/lib/api";

export function EventAreaPanel({ propertyId }: { propertyId: number }) {
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
