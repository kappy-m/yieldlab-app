"use client";

import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { KpiCard } from "@/components/shared/KpiCard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const curveData = [
  { days: "90", 今年: 2, 昨年同期: 3, 理想ライン: 5 },
  { days: "60", 今年: 8, 昨年同期: 7, 理想ライン: 12 },
  { days: "45", 今年: 18, 昨年同期: 16, 理想ライン: 22 },
  { days: "30", 今年: 35, 昨年同期: 32, 理想ライン: 40 },
  { days: "21", 今年: 48, 昨年同期: 44, 理想ライン: 55 },
  { days: "14", 今年: 62, 昨年同期: 58, 理想ライン: 68 },
  { days: "7", 今年: 75, 昨年同期: 70, 理想ライン: 80 },
  { days: "3", 今年: 83, 昨年同期: 78, 理想ライン: 87 },
  { days: "1", 今年: 88, 昨年同期: 82, 理想ライン: 91 },
  { days: "0", 今年: 89, 昨年同期: 84, 理想ライン: 92 },
];

const competitorAlerts = [
  { name: "ホテルA - スタンダードツイン", price: "¥19,800", change: "+15%", up: true },
  { name: "ホテルC - デラックスツイン", price: "¥26,400", change: "+20%", up: true },
  { name: "ホテルE - スイート", price: "¥38,500", change: "+10%", up: true },
];

const newEvents = [
  { name: "国際医療機器展", date: "11/18-20 東京ビッグサイト", impact: "影響大" },
  { name: "東京モーターショー", date: "10/23-25 東京ビッグサイト", impact: "影響大" },
];

export function DailyTab() {
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">デイリーダッシュボード</h2>
        <p className="text-xs text-gray-400">{today}</p>
      </div>

      <AiSummaryCard
        summary="前日の予約状況は好調で、新規予約47室（前日比+12%）を獲得しました。ブッキングカーブは理想的なペースで推移しており、今後30日間の稼働率目標92%達成の見込みです。ただし、競合3社が過去24時間で平均15%値上げを実施しており、当ホテルも追随検討が必要です。"
        bullets={[
          "10月23-25日の東京モーターショーに向けて、デラックス以上の部屋タイプの価格を18%引き上げ推薦",
          "11/18-20の国際医療機器展（新規検出）により、ビジネス需要が見込まれます",
          "現在の予約ペースは昨年同期比+5.2%で推移。このまま維持すれば月次目標を達成可能",
        ]}
      />

      <div className="yl-card p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">前日実績サマリー</h3>
        <div className="flex gap-3">
          <KpiCard label="新規予約" value="47" unit="室" change="+12%" changePositive={true} accentColor="blue" detail />
          <KpiCard label="キャンセル" value="3" unit="室" accentColor="red" detail />
          <KpiCard label="売上" value="¥128万" change="+8.5%" changePositive={true} accentColor="green" detail />
          <KpiCard label="稼働率" value="89" unit="%" change="+5%" changePositive={true} accentColor="purple" />
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
          <div className="yl-card p-4 flex-1">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-800">競合価格変動アラート</h3>
              <span className="text-xs text-gray-400 ml-1">過去24時間</span>
            </div>
            <div className="space-y-2.5">
              {competitorAlerts.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-xs font-medium text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.price}</div>
                  </div>
                  <span className="text-xs font-bold text-white bg-orange-500 rounded px-2 py-0.5">{item.change}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="yl-card p-4 flex-1">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-sm">📅</span>
              <h3 className="text-sm font-semibold text-gray-800">新規イベント検出</h3>
              <span className="text-xs text-gray-400 ml-1">過去24時間</span>
            </div>
            <div className="space-y-2.5">
              {newEvents.map((ev) => (
                <div key={ev.name} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-blue-600">{ev.name}</span>
                    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{ev.impact}</span>
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
