"use client";

import { useState } from "react";
import { Building2, Check, CheckCircle2, RefreshCw } from "lucide-react";
import { updatePropertySettings } from "@/lib/api";

export function OwnRakutenNoPanel({ propertyId }: { propertyId: number }) {
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
    <div className="yl-card p-4 mb-5 border-brand-navy/20 bg-blue-50/30">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-brand-navy" />
        <h4 className="text-sm font-semibold text-slate-800">自社 楽天トラベル ホテル番号</h4>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        設定すると、評価モニターの radar / 散布図チャートとレビューカードに自社データが追加されます。<br />
        楽天トラベルのホテルページ URL（<code className="bg-slate-100 px-1 rounded">travel.rakuten.co.jp/HOTEL/
        <span className="font-bold text-brand-navy">XXXXX</span>/</code>）の数字部分を入力してください。
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="例: 149481"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-navy text-white text-sm rounded-lg hover:bg-brand-navy/90 transition-colors cursor-pointer disabled:opacity-50"
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
