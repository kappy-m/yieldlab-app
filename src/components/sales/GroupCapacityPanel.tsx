"use client";

import { useState } from "react";
import { Calendar, BedDouble, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types & mock availability data
// ────────────────────────────────────────────────────────────────────────────

interface DayAvailability {
  date: string;
  available: number;
  total: number;
}

// 各日付の残室数（モックデータ）
const AVAILABILITY_MAP: Record<string, number> = {
  "2026-04-01": 45, "2026-04-02": 42, "2026-04-03": 38, "2026-04-04": 30,
  "2026-04-05": 28, "2026-04-06": 22, "2026-04-07": 35, "2026-04-08": 48,
  "2026-04-09": 50, "2026-04-10": 55, "2026-04-11": 40, "2026-04-12": 38,
  "2026-04-13": 25, "2026-04-14": 18, "2026-04-15": 52, "2026-04-16": 60,
  "2026-04-17": 62, "2026-04-18": 58, "2026-04-19": 45, "2026-04-20": 30,
  "2026-04-21": 22, "2026-04-22": 42, "2026-04-23": 55, "2026-04-24": 58,
  "2026-04-25": 50, "2026-04-26": 42, "2026-04-27": 35, "2026-04-28": 15,
  "2026-04-29": 10, "2026-04-30": 8,
  "2026-05-01": 5,  "2026-05-02": 3,  "2026-05-03": 2,  "2026-05-04": 4,
  "2026-05-05": 6,  "2026-05-06": 20, "2026-05-07": 35, "2026-05-08": 45,
  "2026-05-09": 48, "2026-05-10": 50,
};
const TOTAL_ROOMS = 120;

function getAvailability(dateStr: string): number {
  return AVAILABILITY_MAP[dateStr] ?? 80;
}

function dateRange(startStr: string, nights: number): string[] {
  const dates: string[] = [];
  const start = new Date(startStr);
  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ────────────────────────────────────────────────────────────────────────────
// Result display
// ────────────────────────────────────────────────────────────────────────────

interface CheckResult {
  feasible: boolean;
  minAvailable: number;
  requiredRooms: number;
  dates: DayAvailability[];
  bottleneckDates: string[];
}

function CapacityResult({ result }: { result: CheckResult }) {
  return (
    <div className={cn(
      "rounded-xl border p-5 space-y-4",
      result.feasible ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
    )}>
      {/* 判定 */}
      <div className="flex items-center gap-3">
        {result.feasible
          ? <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
          : <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
        }
        <div>
          <p className={cn("text-lg font-bold", result.feasible ? "text-green-700" : "text-red-700")}>
            {result.feasible ? "受入可能" : "受入不可"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {result.feasible
              ? `全宿泊日程で ${result.requiredRooms}室の空室を確認しました（最小余裕 ${result.minAvailable - result.requiredRooms}室）`
              : `${result.bottleneckDates.length}日でキャパシティ不足（必要: ${result.requiredRooms}室 / 最小残室: ${result.minAvailable}室）`
            }
          </p>
        </div>
      </div>

      {/* 日付別残室テーブル */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-3 py-2 text-slate-500 font-medium">日付</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">残室数</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">必要室数</th>
              <th className="text-right px-3 py-2 text-slate-500 font-medium">余裕</th>
              <th className="text-center px-3 py-2 text-slate-500 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {result.dates.map((d) => {
              const margin = d.available - result.requiredRooms;
              const ok = margin >= 0;
              return (
                <tr key={d.date} className={cn("border-b border-slate-50", !ok && "bg-red-50/60")}>
                  <td className="px-3 py-2 text-slate-700 font-medium">{d.date}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{d.available}室</td>
                  <td className="px-3 py-2 text-right text-slate-600">{result.requiredRooms}室</td>
                  <td className={cn("px-3 py-2 text-right font-medium", ok ? "text-green-600" : "text-red-600")}>
                    {ok ? `+${margin}` : margin}室
                  </td>
                  <td className="px-3 py-2 text-center">
                    {ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!result.feasible && result.bottleneckDates.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700">ボトルネック日程</p>
            <p className="text-xs text-amber-600 mt-0.5">{result.bottleneckDates.join("、")} — 日程変更または客室調整を検討してください</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

export function GroupCapacityPanel() {
  const [checkIn, setCheckIn]         = useState("");
  const [nights, setNights]           = useState<number>(2);
  const [requiredRooms, setRequired]  = useState<number>(20);
  const [result, setResult]           = useState<CheckResult | null>(null);

  const handleCheck = () => {
    if (!checkIn || nights < 1 || requiredRooms < 1) return;
    const dates = dateRange(checkIn, nights);
    const dayData: DayAvailability[] = dates.map((d) => ({
      date: d,
      available: getAvailability(d),
      total: TOTAL_ROOMS,
    }));
    const minAvailable = Math.min(...dayData.map((d) => d.available));
    const feasible = minAvailable >= requiredRooms;
    const bottleneckDates = dayData.filter((d) => d.available < requiredRooms).map((d) => d.date);

    setResult({ feasible, minAvailable, requiredRooms, dates: dayData, bottleneckDates });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-0.5">キャパシティチェッカー</h3>
        <p className="text-xs text-slate-400">宿泊日程と必要室数を入力して、受入可否をリアルタイムで確認します</p>
      </div>

      {/* 入力フォーム */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              <Calendar className="w-3 h-3 inline mr-1" />チェックイン日
            </label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              <Calendar className="w-3 h-3 inline mr-1" />宿泊数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-xs text-slate-400 flex-shrink-0">泊</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              <BedDouble className="w-3 h-3 inline mr-1" />必要客室数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={120}
                value={requiredRooms}
                onChange={(e) => setRequired(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-xs text-slate-400 flex-shrink-0">室</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleCheck}
          disabled={!checkIn}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
            checkIn ? "bg-brand-navy text-white hover:bg-brand-navy/90" : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
        >
          受入可否を確認する
        </button>
      </div>

      {/* ヒント */}
      {!result && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-600">
            チェックイン日・宿泊数・必要室数を入力してください。全宿泊日程で残室数と比較し、受入可否を自動判定します。
          </p>
        </div>
      )}

      {result && <CapacityResult result={result} />}
    </div>
  );
}
