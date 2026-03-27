"use client";

import { useState } from "react";

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function CsvImportPanel({ propertyId }: { propertyId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // BFF プロキシ経由（HttpOnly Cookie の yl_token で認証）
      const res = await fetch(`/api/proxy/properties/${propertyId}/daily-performance/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const data = await res.json() as ImportResult;
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
