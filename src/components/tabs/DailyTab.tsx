"use client";

import { useEffect, useState, useCallback } from "react";
import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { KpiCard } from "@/components/shared/KpiCard";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Calendar, RefreshCw } from "lucide-react";
import {
  fetchDailySummary,
  fetchCompetitorAverages,
  fetchPricingGrid,
  fetchMarketEvents,
  type DailySummaryOut,
  type CompetitorAvgOut,
  type PricingCellOut,
  type MarketEventOut,
} from "@/lib/api";

// ブッキングカーブ（サンプルデータ）
const curveData = [
  { days: "90", 今年: 2,  昨年同期: 3,  理想ライン: 5  },
  { days: "60", 今年: 8,  昨年同期: 7,  理想ライン: 12 },
  { days: "45", 今年: 18, 昨年同期: 16, 理想ライン: 22 },
  { days: "30", 今年: 35, 昨年同期: 32, 理想ライン: 40 },
  { days: "21", 今年: 48, 昨年同期: 44, 理想ライン: 55 },
  { days: "14", 今年: 62, 昨年同期: 58, 理想ライン: 68 },
  { days: "7",  今年: 75, 昨年同期: 70, 理想ライン: 80 },
  { days: "3",  今年: 83, 昨年同期: 78, 理想ライン: 87 },
  { days: "1",  今年: 88, 昨年同期: 82, 理想ライン: 91 },
  { days: "0",  今年: 89, 昨年同期: 84, 理想ライン: 92 },
];

// 実データからAIサマリーを生成
function generateAiSummary(
  summary: DailySummaryOut,
  compAvgPrice: number | null,
  ourAvgPrice: number,
  date: Date,
): { summary: string; bullets: string[] } {
  const m = date.getMonth() + 1;
  const seasonLabel =
    m <= 3 ? "春需要期" : m <= 6 ? "初夏需要期" : m <= 9 ? "夏季繁忙期" : "秋冬需要期";

  const latest = summary.latest;
  const occ = latest?.occupancy_rate ?? 0;
  const occChange = summary.occ_change;
  const occTrend = occChange !== null
    ? (occChange >= 0 ? `+${occChange}pt上回る好調` : `${occChange}pt下回る`)
    : "データ取得中";

  const priceDiff = compAvgPrice
    ? Math.round(((ourAvgPrice - compAvgPrice) / compAvgPrice) * 100)
    : null;

  const text = compAvgPrice
    ? `稼働率${occ}%（前日比${occTrend}）を記録。競合平均価格¥${compAvgPrice.toLocaleString()}に対し当館の平均単価は¥${ourAvgPrice.toLocaleString()}（${priceDiff! >= 0 ? "+" : ""}${priceDiff}%）。${seasonLabel}に向けたポジショニング最適化を推奨します。`
    : `稼働率${occ}%（前日比${occTrend}）を記録。新規予約${latest?.new_bookings ?? "—"}室を獲得し、${seasonLabel}に向けて推移中です。`;

  const bullets: string[] = [];

  if (occ >= 85) {
    bullets.push(`稼働率${occ}%は高水準。今後7〜14日のBARレベルをC→Bへ1段階引き上げ、RevPAR最大化を狙う機会です`);
  } else {
    bullets.push(`稼働率${occ}%はやや伸び悩み。近隣イベント需要を取り込むため、週末価格の見直しを推奨します`);
  }

  if (priceDiff !== null) {
    if (priceDiff < -10) {
      bullets.push(`競合比${Math.abs(priceDiff)}%安く設定されており、値上げ余地あり。スタンダードルームのBARレベル引き上げを検討してください`);
    } else if (priceDiff > 15) {
      bullets.push(`競合比${priceDiff}%高い価格帯。稼働率が低下傾向なら、一部日程の価格調整を検討してください`);
    } else {
      bullets.push(`競合との価格差は${priceDiff >= 0 ? "+" : ""}${priceDiff}%で適正水準。現状の価格戦略を維持してください`);
    }
  }

  const bkChange = summary.new_bookings_change_pct;
  if (bkChange !== null) {
    bullets.push(`新規予約は前日比${bkChange >= 0 ? "+" : ""}${bkChange}%で推移。このまま維持すれば月次目標達成の見込みです`);
  }

  return { summary: text, bullets };
}

export function DailyTab({ propertyId }: { propertyId: number }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayLabel = today.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const [perfSummary, setPerfSummary] = useState<DailySummaryOut | null>(null);
  const [compAvgs, setCompAvgs] = useState<CompetitorAvgOut[]>([]);
  const [pricingRows, setPricingRows] = useState<PricingCellOut[]>([]);
  const [events, setEvents] = useState<MarketEventOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dateTo = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const [perfRes, compRes, priceRes, eventsRes] = await Promise.allSettled([
        fetchDailySummary(propertyId),
        fetchCompetitorAverages(propertyId, { date_from: todayStr, date_to: dateTo }),
        fetchPricingGrid(propertyId, { date_from: todayStr, date_to: dateTo }),
        fetchMarketEvents(propertyId, 30),
      ]);
      if (perfRes.status === "fulfilled")   setPerfSummary(perfRes.value);
      if (compRes.status === "fulfilled")   setCompAvgs(compRes.value);
      if (priceRes.status === "fulfilled")  setPricingRows(priceRes.value);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value);
    } finally {
      setLoading(false);
    }
  }, [propertyId, todayStr]);

  useEffect(() => { load(); }, [load]);

  // 今日の競合平均
  const todayComp = compAvgs.find(c => c.target_date === todayStr);
  const compAvgPrice = todayComp ? Math.round(todayComp.avg_price) : null;

  // 自社平均単価（プライシンググリッドの最安値以外の平均）
  const ourAvgPrice = pricingRows.length > 0
    ? Math.round(
        pricingRows.filter(r => r.bar_level !== "E").reduce((s, r) => s + r.price, 0) /
        Math.max(1, pricingRows.filter(r => r.bar_level !== "E").length)
      )
    : 0;

  // 競合価格変動アラート
  const yestStr = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const yesterdayComp = compAvgs.find(c => c.target_date === yestStr);
  const compAlerts = todayComp
    ? [
        {
          name: "競合ホテル（平均）",
          price: `¥${Math.round(todayComp.avg_price).toLocaleString()}`,
          change: yesterdayComp
            ? `${(todayComp.avg_price - yesterdayComp.avg_price) / yesterdayComp.avg_price * 100 >= 0 ? "+" : ""}${Math.round((todayComp.avg_price - yesterdayComp.avg_price) / yesterdayComp.avg_price * 100)}%`
            : "+0%",
          up: yesterdayComp ? todayComp.avg_price >= yesterdayComp.avg_price : true,
        },
        {
          name: "エリア最安値",
          price: `¥${todayComp.min_price.toLocaleString()}`,
          change: "-",
          up: false,
        },
        {
          name: "エリア最高値",
          price: `¥${todayComp.max_price.toLocaleString()}`,
          change: "-",
          up: true,
        },
      ]
    : [{ name: "競合データ取得中...", price: "—", change: "—", up: false }];

  // 実績から各KPI値を取り出す
  const latest = perfSummary?.latest;
  const occ = latest?.occupancy_rate ?? null;
  const newBookings = latest?.new_bookings ?? null;
  const cancels = latest?.cancellations ?? null;
  const revenueManYen = latest ? Math.round(latest.revenue / 10000) : null;

  const occChange = perfSummary?.occ_change;
  const revChange = perfSummary?.revenue_change_pct;
  const bkChange = perfSummary?.new_bookings_change_pct;

  const { summary: aiText, bullets: aiBullets } = perfSummary
    ? generateAiSummary(perfSummary, compAvgPrice, ourAvgPrice, today)
    : { summary: "データを読み込んでいます...", bullets: [] };

  // 直近7日トレンドをチャート用データに変換
  const trendData = (perfSummary?.trend_7d ?? []).map(r => ({
    date: `${new Date(r.date + "T00:00:00").getMonth() + 1}/${new Date(r.date + "T00:00:00").getDate()}`,
    稼働率: r.occupancy_rate,
    ADR: r.adr,
  }));

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

      <AiSummaryCard summary={aiText} bullets={aiBullets} />

      {/* 前日実績サマリー */}
      <div className="yl-card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">前日実績サマリー</h3>
          {latest && (
            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
              {new Date(latest.date + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })} 実績
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <KpiCard
            label="新規予約"
            value={newBookings !== null ? String(newBookings) : "—"}
            unit="室"
            change={bkChange != null ? `${bkChange >= 0 ? "+" : ""}${bkChange}%` : undefined}
            changePositive={bkChange != null ? bkChange >= 0 : undefined}
            accentColor="blue"
            detail
          />
          <KpiCard
            label="キャンセル"
            value={cancels !== null ? String(cancels) : "—"}
            unit="室"
            accentColor="red"
            detail
          />
          <KpiCard
            label="売上"
            value={revenueManYen !== null ? `¥${revenueManYen.toLocaleString()}万` : "—"}
            change={revChange != null ? `${revChange >= 0 ? "+" : ""}${revChange}%` : undefined}
            changePositive={revChange != null ? revChange >= 0 : undefined}
            accentColor="green"
            detail
          />
          <KpiCard
            label="稼働率"
            value={occ !== null ? String(occ) : "—"}
            unit="%"
            change={occChange != null ? `${occChange >= 0 ? "+" : ""}${occChange}pt` : undefined}
            changePositive={occChange != null ? occChange >= 0 : undefined}
            accentColor="purple"
          />
        </div>
      </div>

      <div className="flex gap-4">
        {/* ブッキングカーブ + 直近トレンド */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="yl-card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">ブッキングカーブ（今後30日間）</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={curveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="days"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  label={{ value: "泊日までの日数", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9CA3AF" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="今年"     stroke="#2563EB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="昨年同期" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                <Line type="monotone" dataKey="理想ライン" stroke="#10B981" strokeWidth={1.5} strokeDasharray="2 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 直近7日トレンド */}
          {trendData.length > 0 && (
            <div className="yl-card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">直近7日間の稼働率推移</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                  <YAxis
                    yAxisId="occ"
                    domain={[40, 100]}
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    tickFormatter={v => `${v}%`}
                    width={36}
                  />
                  <Tooltip formatter={(v, name) => name === "稼働率" ? `${v}%` : `¥${Number(v).toLocaleString()}`} />
                  <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="occ" type="monotone" dataKey="稼働率" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 右サイドパネル */}
        <div className="w-72 flex flex-col gap-4">
          {/* 競合価格変動アラート */}
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

          {/* マーケットイベント（API連動） */}
          <div className="yl-card p-4 flex-1">
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">需要影響イベント</h3>
              <span className="text-xs text-gray-400 ml-1">今後30日</span>
            </div>
            <div className="space-y-2.5">
              {events.length > 0 ? events.slice(0, 3).map(ev => (
                <div key={ev.id} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-blue-600 truncate max-w-[130px]">{ev.name}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                      ev.impact === "影響大" ? "text-purple-600 bg-purple-50" : "text-blue-600 bg-blue-50"
                    }`}>
                      {ev.impact}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{ev.date_label}</div>
                </div>
              )) : (
                <p className="text-xs text-gray-400">イベント情報を取得中...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
