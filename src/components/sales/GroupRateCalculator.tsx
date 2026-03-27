"use client";

import { useState } from "react";
import { Calculator, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Rule-based rate calculation logic
// (将来的にはML/AIベースのアルゴリズムへの置換ポイント)
// ────────────────────────────────────────────────────────────────────────────

function getLeadTimeDiscount(leadDays: number): { label: string; rate: number } {
  if (leadDays >= 90) return { label: "90日以上前 (-15%)", rate: 0.15 };
  if (leadDays >= 60) return { label: "60日以上前 (-10%)", rate: 0.10 };
  if (leadDays >= 30) return { label: "30日以上前 (-5%)",  rate: 0.05 };
  return { label: "30日未満 (0%)", rate: 0 };
}

function getVolumeDiscount(rooms: number): { label: string; rate: number } {
  if (rooms >= 40) return { label: "40室以上 (-12%)", rate: 0.12 };
  if (rooms >= 20) return { label: "20室以上 (-8%)",  rate: 0.08 };
  if (rooms >= 10) return { label: "10室以上 (-5%)",  rate: 0.05 };
  return { label: "10室未満 (0%)", rate: 0 };
}

function getSeasonMultiplier(monthStr: number): { label: string; multiplier: number } {
  if ([3, 4, 5, 9, 10, 11].includes(monthStr)) return { label: "繁忙期 (×1.10)", multiplier: 1.10 };
  if ([1, 2, 7, 8].includes(monthStr))         return { label: "閑散期 (×0.88)", multiplier: 0.88 };
  return { label: "通常期 (×1.00)", multiplier: 1.00 };
}

// モックのベースレート（月/部屋タイプ別の平均単価）
const BASE_RATES: Record<string, number> = {
  standard: 22_000,
  superior: 32_000,
  deluxe:   45_000,
  suite:    90_000,
};

// ────────────────────────────────────────────────────────────────────────────
// Calculation result
// ────────────────────────────────────────────────────────────────────────────

interface CalcResult {
  baseRate: number;
  leadTimeDiscount: { label: string; rate: number };
  volumeDiscount: { label: string; rate: number };
  seasonMultiplier: { label: string; multiplier: number };
  recommendedRate: number;
  totalEstimate: number;
  rooms: number;
  nights: number;
}

function RateResult({ result }: { result: CalcResult }) {
  const [showBreakdown, setShowBreakdown] = useState(true);

  const afterLead   = result.baseRate * (1 - result.leadTimeDiscount.rate);
  const afterVolume = afterLead * (1 - result.volumeDiscount.rate);
  const final       = afterVolume * result.seasonMultiplier.multiplier;

  return (
    <div className="rounded-xl border border-[#1E3A8A]/20 bg-blue-50/40 p-5 space-y-4">
      {/* 推奨レート */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">推奨グループレート（1室/泊）</p>
          <p className="text-3xl font-bold text-[#1E3A8A]">
            ¥{Math.round(result.recommendedRate).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            ベースレート ¥{result.baseRate.toLocaleString()} からの調整
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">合計見積もり</p>
          <p className="text-xl font-bold text-slate-700">
            ¥{result.totalEstimate.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{result.rooms}室 × {result.nights}泊</p>
        </div>
      </div>

      {/* 割引率まとめ */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "リードタイム割引", value: `-${(result.leadTimeDiscount.rate * 100).toFixed(0)}%`, sub: result.leadTimeDiscount.label, color: "bg-green-50 border-green-100 text-green-700" },
          { label: "ボリューム割引",   value: `-${(result.volumeDiscount.rate * 100).toFixed(0)}%`,  sub: result.volumeDiscount.label,   color: "bg-blue-50 border-blue-100 text-blue-700" },
          { label: "季節係数",         value: `×${result.seasonMultiplier.multiplier.toFixed(2)}`, sub: result.seasonMultiplier.label, color: "bg-amber-50 border-amber-100 text-amber-700" },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-lg border p-2.5 text-center", item.color)}>
            <p className="text-lg font-bold">{item.value}</p>
            <p className="text-[10px] mt-0.5 opacity-80">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* 計算内訳（展開/折りたたみ） */}
      <div>
        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          計算内訳を{showBreakdown ? "閉じる" : "確認する"}
        </button>

        {showBreakdown && (
          <div className="mt-3 bg-white rounded-lg border border-slate-100 p-3 space-y-2 text-xs">
            {[
              { step: "ベースレート",               value: result.baseRate, note: "部屋タイプ・月の平均単価" },
              { step: "リードタイム割引適用後",       value: afterLead,      note: result.leadTimeDiscount.label },
              { step: "ボリューム割引適用後",         value: afterVolume,    note: result.volumeDiscount.label },
              { step: "季節係数適用後（推奨レート）", value: final,          note: result.seasonMultiplier.label },
            ].map((row, i) => (
              <div key={row.step} className={cn("flex items-center justify-between py-1.5", i < 3 && "border-b border-slate-50")}>
                <span className={cn("text-slate-500", i === 3 && "font-semibold text-slate-700")}>{row.step}</span>
                <div className="text-right">
                  <span className={cn("font-medium", i === 3 ? "text-[#1E3A8A] text-sm" : "text-slate-700")}>
                    ¥{Math.round(row.value).toLocaleString()}
                  </span>
                  <span className="text-slate-400 ml-2">{row.note}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400">
        ※ このレートはルールベースの自動算出です。最終的な提示レートは営業担当が判断してください。
        将来的にはMLモデルによる動的価格算出に置き換え予定です。
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

const ROOM_TYPE_OPTIONS = [
  { value: "standard", label: "スタンダード" },
  { value: "superior", label: "スーペリア" },
  { value: "deluxe",   label: "デラックス" },
  { value: "suite",    label: "スイート" },
];

export function GroupRateCalculator() {
  const [checkIn, setCheckIn]     = useState("");
  const [nights, setNights]       = useState<number>(2);
  const [rooms, setRooms]         = useState<number>(20);
  const [roomType, setRoomType]   = useState<string>("standard");
  const [result, setResult]       = useState<CalcResult | null>(null);

  const handleCalc = () => {
    if (!checkIn || nights < 1 || rooms < 1) return;

    const today     = new Date();
    const checkinDate = new Date(checkIn);
    const leadDays  = Math.max(0, Math.floor((checkinDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const month     = checkinDate.getMonth() + 1;

    const baseRate          = BASE_RATES[roomType] ?? 22_000;
    const leadTimeDiscount  = getLeadTimeDiscount(leadDays);
    const volumeDiscount    = getVolumeDiscount(rooms);
    const seasonMultiplier  = getSeasonMultiplier(month);

    const recommended = baseRate
      * (1 - leadTimeDiscount.rate)
      * (1 - volumeDiscount.rate)
      * seasonMultiplier.multiplier;

    setResult({
      baseRate,
      leadTimeDiscount,
      volumeDiscount,
      seasonMultiplier,
      recommendedRate: recommended,
      totalEstimate: Math.round(recommended) * rooms * nights,
      rooms,
      nights,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-0.5">グループレート算出</h3>
        <p className="text-xs text-slate-400">リードタイム・ボリューム・季節の3軸で推奨レートを自動算出します</p>
      </div>

      {/* 入力フォーム */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">チェックイン日</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">宿泊数</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-xs text-slate-400">泊</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">客室数</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-xs text-slate-400">室</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">部屋タイプ</label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
            >
              {ROOM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleCalc}
          disabled={!checkIn}
          className={cn(
            "w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
            checkIn ? "bg-[#1E3A8A] text-white hover:bg-[#1e3070] cursor-pointer" : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
        >
          <Calculator className="w-4 h-4" />
          推奨レートを算出する
        </button>
      </div>

      {/* ヒント */}
      {!result && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-600 space-y-1">
            <p>算出ロジック: <strong>ベースレート × (1 - リードタイム割引) × (1 - ボリューム割引) × 季節係数</strong></p>
            <p>団体予約は通常のプライシングアルゴリズムの対象外期間（90日以上先）が多いため、このルールベース算出を使用します。</p>
          </div>
        </div>
      )}

      {result && <RateResult result={result} />}
    </div>
  );
}
