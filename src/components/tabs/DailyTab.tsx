"use client";

import { useEffect, useState, useCallback } from "react";
import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { KpiCard } from "@/components/shared/KpiCard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Calendar, RefreshCw } from "lucide-react";
import { PROPERTY_ID } from "@/lib/api";

// ブッキングカーブ（デモ用固定データ）
const curveData = [
  { days: "90", 今年: 2, 昨年同期: 3, 理想ライン: 5 },
  { days: "60", 今年: 8, 昨年同期: 7, 理想ライン: 12 },
  { days: "45", 今年: 18, 昨年同期: 16, 理想ライン: 22 },
  { days: "30", 今年: 35, 昨年同期: 32, 理想ライン: 40 },
  { days: "21", 今年: 48, 昨年同期: 44, 理想ライン: 55 },
  { days: "14", 今年: 62, 昨年同期: 58, 理想ライン: 68 },
  { days: "7",  今年: 75, 昨年同期: 70, 理想ライン: 80 },
  { days: "3",  今年: 83, 昨年同期: 78, 理想ライン: 87 },
  { days: "1",  今年: 88, 昨年同期: 82, 理想ライン: 91 },
  { days: "0",  今年: 89, 昨年同期: 84, 理想ライン: 92 },
];

// 季節・日付に応じたイベントを返す
function getSeasonalEvents(date: Date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const events: { name: string; date: string; impact: string }[] = [];

  if (m === 3) {
    if (d <= 14) events.push({ name: "ホワイトデー需要期", date: "3/14 都内全域", impact: "影響中" });
    if (d >= 20) events.push({ name: "春分の日・連休", date: `3/20〜21 東京`, impact: "影響大" });
    events.push({ name: "春休み・花見シーズン", date: "3月下旬〜4月初旬", impact: "影響大" });
  } else if (m === 4) {
    events.push({ name: "ゴールデンウィーク前哨戦", date: "4/26〜 東京全域", impact: "影響大" });
    events.push({ name: "お花見シーズン", date: "4月上旬 上野・新宿御苑", impact: "影響中" });
  } else if (m === 5) {
    events.push({ name: "ゴールデンウィーク", date: "5/3〜6 東京全域", impact: "影響大" });
  } else if (m >= 6 && m <= 8) {
    events.push({ name: "夏季繁忙期", date: `${m}月 東京全域`, impact: "影響大" });
    events.push({ name: "花火大会シーズン", date: "7〜8月 隅田川ほか", impact: "影響中" });
  } else if (m === 10) {
    events.push({ name: "東京国際映画祭", date: "10月下旬 六本木", impact: "影響中" });
    events.push({ name: "ハロウィン需要", date: "10/31 渋谷周辺", impact: "影響中" });
  } else if (m === 12) {
    events.push({ name: "年末需要・忘年会シーズン", date: "12月全般 都内全域", impact: "影響大" });
  } else {
    events.push({ name: "都内ビジネス需要（通常期）", date: `${m}月 都内全域`, impact: "影響中" });
  }
  return events.slice(0, 2);
}

// 日付シードで安定したKPI乱数を生成（同日は同じ数値）
function seededKpi(date: Date) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const r = (n: number) => ((seed * 9301 + n * 49297 + 233995) % 233280) / 233280;
  const dow = date.getDay(); // 0=日, 6=土
  const isWeekend = dow === 0 || dow === 6;
  const baseOcc = isWeekend ? 87 : 79;

  const occupancy = Math.round(baseOcc + r(1) * 10 - 3);
  const totalRooms = 120;
  const occupiedRooms = Math.round(totalRooms * occupancy / 100);
  const newBookings = Math.round(30 + r(2) * 30);
  const cancels = Math.round(1 + r(3) * 5);
  const avgRate = Math.round(12000 + r(4) * 8000);
  const revenue = Math.round(occupiedRooms * avgRate / 10000) / 100; // 万円
  const changeOcc = Math.round((r(5) * 12 - 4) * 10) / 10;
  const changeBookings = Math.round((r(6) * 20 - 6) * 10) / 10;
  const changeRevenue = Math.round((r(7) * 15 - 5) * 10) / 10;

  return { occupancy, newBookings, cancels, revenue, changeOcc, changeBookings, changeRevenue };
}

// 競合データからAIサマリーを生成
function generateAiSummary(
  kpi: ReturnType<typeof seededKpi>,
  compAvg: number | null,
  ourAvgPrice: number,
  date: Date
): { summary: string; bullets: string[] } {
  const m = date.getMonth() + 1;
  const seasonLabel = m <= 3 ? "春需要期" : m <= 6 ? "初夏需要期" : m <= 9 ? "夏季繁忙期" : "秋冬需要期";
  const occTrend = kpi.changeOcc >= 0 ? `+${kpi.changeOcc}%上回る好調` : `${kpi.changeOcc}%下回る`;
  const priceDiff = compAvg ? Math.round(((ourAvgPrice - compAvg) / compAvg) * 100) : null;

  const summary = compAvg
    ? `稼働率${kpi.occupancy}%（前日比${occTrend}）を記録。競合平均価格¥${compAvg.toLocaleString()}に対し当館の平均単価は¥${ourAvgPrice.toLocaleString()}（${priceDiff! >= 0 ? "+" : ""}${priceDiff}%）。${seasonLabel}に向けたポジショニング最適化を推奨します。`
    : `稼働率${kpi.occupancy}%（前日比${occTrend}）を記録。新規予約${kpi.newBookings}室を獲得し、${seasonLabel}に向けて順調なペースで推移しています。`;

  const bullets: string[] = [];

  if (kpi.occupancy >= 85) {
    bullets.push(`稼働率${kpi.occupancy}%は高水準。今後7〜14日のBARレベルをC→Bへ1段階引き上げ、RevPAR最大化を狙う機会です`);
  } else {
    bullets.push(`稼働率${kpi.occupancy}%はやや伸び悩み。近隣イベント需要を取り込むため、週末価格の見直しを推奨します`);
  }

  if (compAvg && priceDiff !== null) {
    if (priceDiff < -10) {
      bullets.push(`競合比${Math.abs(priceDiff)}%安く設定されており、値上げ余地あり。スタンダードルームのBARレベル引き上げを検討してください`);
    } else if (priceDiff > 15) {
      bullets.push(`競合比${priceDiff}%高い価格帯。稼働率が低下傾向なら、一部日程の価格調整を検討してください`);
    } else {
      bullets.push(`競合との価格差は${priceDiff >= 0 ? "+" : ""}${priceDiff}%で適正水準。現状の価格戦略を維持してください`);
    }
  }

  bullets.push(`現在の予約ペースは昨年同期比${kpi.changeBookings >= 0 ? "+" : ""}${kpi.changeBookings}%で推移。このまま維持すれば月次目標達成の見込みです`);

  return { summary, bullets };
}

interface CompAvg {
  target_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
}

interface PricingRow {
  price: number;
  bar_level: string;
}

export function DailyTab() {
  const today = new Date();
  const todayLabel = today.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const kpi = seededKpi(today);
  const events = getSeasonalEvents(today);

  const [compAvgs, setCompAvgs] = useState<CompAvg[]>([]);
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8400";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, priceRes] = await Promise.all([
        fetch(`${BASE}/properties/${PROPERTY_ID}/competitor/averages`),
        fetch(`${BASE}/properties/${PROPERTY_ID}/pricing/?days=14`),
      ]);
      if (compRes.ok) setCompAvgs(await compRes.json());
      if (priceRes.ok) setPricingRows(await priceRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [BASE]);

  useEffect(() => { load(); }, [load]);

  // 今日の競合平均と当館平均単価を計算
  const todayStr = today.toISOString().slice(0, 10);
  const todayComp = compAvgs.find(c => c.target_date === todayStr);
  const compAvgPrice = todayComp ? Math.round(todayComp.avg_price) : null;
  const ourAvgPrice = pricingRows.length > 0
    ? Math.round(pricingRows.filter(r => r.bar_level !== "E").reduce((s, r) => s + r.price, 0) / pricingRows.filter(r => r.bar_level !== "E").length)
    : 14000;

  // 競合価格変動アラート（上位3社）
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const yestStr = yesterday.toISOString().slice(0, 10);
  const yesterdayComp = compAvgs.find(c => c.target_date === yestStr);
  const compAlerts = todayComp ? [
    {
      name: "渋谷区内競合ホテル（平均）",
      price: `¥${Math.round(todayComp.avg_price).toLocaleString()}`,
      change: yesterdayComp
        ? `${((todayComp.avg_price - yesterdayComp.avg_price) / yesterdayComp.avg_price * 100) >= 0 ? "+" : ""}${Math.round((todayComp.avg_price - yesterdayComp.avg_price) / yesterdayComp.avg_price * 100)}%`
        : "+0%",
      up: yesterdayComp ? todayComp.avg_price >= yesterdayComp.avg_price : true,
    },
    {
      name: "エリア最安値ホテル",
      price: `¥${todayComp.min_price.toLocaleString()}`,
      change: "-",
      up: false,
    },
    {
      name: "エリア最高値ホテル",
      price: `¥${todayComp.max_price.toLocaleString()}`,
      change: "-",
      up: true,
    },
  ] : [
    { name: "競合データ取得中...", price: "—", change: "—", up: false },
  ];

  const { summary, bullets } = generateAiSummary(kpi, compAvgPrice, ourAvgPrice, today);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">デイリーダッシュボード</h2>
          <p className="text-xs text-gray-400">{todayLabel}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          更新
        </button>
      </div>

      <AiSummaryCard summary={summary} bullets={bullets} />

      <div className="yl-card p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">前日実績サマリー</h3>
        <div className="flex gap-3">
          <KpiCard
            label="新規予約"
            value={String(kpi.newBookings)}
            unit="室"
            change={`${kpi.changeBookings >= 0 ? "+" : ""}${kpi.changeBookings}%`}
            changePositive={kpi.changeBookings >= 0}
            accentColor="blue"
            detail
          />
          <KpiCard label="キャンセル" value={String(kpi.cancels)} unit="室" accentColor="red" detail />
          <KpiCard
            label="売上"
            value={`¥${kpi.revenue}万`}
            change={`${kpi.changeRevenue >= 0 ? "+" : ""}${kpi.changeRevenue}%`}
            changePositive={kpi.changeRevenue >= 0}
            accentColor="green"
            detail
          />
          <KpiCard
            label="稼働率"
            value={String(kpi.occupancy)}
            unit="%"
            change={`${kpi.changeOcc >= 0 ? "+" : ""}${kpi.changeOcc}%`}
            changePositive={kpi.changeOcc >= 0}
            accentColor="purple"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="yl-card p-5 flex-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">ブッキングカーブ（今後30日間）</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="days" tick={{ fontSize: 11, fill: "#9CA3AF" }} label={{ value: "泊日までの日数", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9CA3AF" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} domain={[0, 100]} tickFormatter={(v) => `${v}`} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="今年" stroke="#2563EB" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="昨年同期" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="理想ライン" stroke="#10B981" strokeWidth={1.5} strokeDasharray="2 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="w-72 flex flex-col gap-4">
          {/* 競合価格変動アラート（APIデータ連動） */}
          <div className="yl-card p-4 flex-1">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-800">競合価格アラート</h3>
              <span className="text-xs text-gray-400 ml-1">本日</span>
            </div>
            <div className="space-y-2.5">
              {compAlerts.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-xs font-medium text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.price}</div>
                  </div>
                  {item.change !== "-" && (
                    <span className={`text-xs font-bold text-white rounded px-2 py-0.5 flex items-center gap-0.5 ${item.up ? "bg-orange-500" : "bg-blue-500"}`}>
                      {item.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {item.change}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* イベント検出（日付ベースで動的生成） */}
          <div className="yl-card p-4 flex-1">
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">需要影響イベント</h3>
              <span className="text-xs text-gray-400 ml-1">今後30日</span>
            </div>
            <div className="space-y-2.5">
              {events.map((ev) => (
                <div key={ev.name} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-blue-600">{ev.name}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${ev.impact === "影響大" ? "text-purple-600 bg-purple-50" : "text-blue-600 bg-blue-50"}`}>
                      {ev.impact}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{ev.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
