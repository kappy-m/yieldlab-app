"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, DollarSign, Percent, ImageIcon, Megaphone } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Mock data
// ────────────────────────────────────────────────────────────────────────────

const CHANNEL_DATA = [
  {
    channel: "楽天トラベル",
    bookings: 98,
    revenue: 2_420_000,
    adCost: 242_000,
    roas: 10.0,
    adr: 24_700,
    cancellRate: 3.2,
    color: "#e11d48",
  },
  {
    channel: "Booking.com",
    bookings: 86,
    revenue: 2_150_000,
    adCost: 215_000,
    roas: 10.0,
    adr: 25_000,
    cancellRate: 5.8,
    color: "#2563eb",
  },
  {
    channel: "自社直接",
    bookings: 68,
    revenue: 1_980_000,
    adCost: 95_000,
    roas: 20.8,
    adr: 29_100,
    cancellRate: 1.2,
    color: "#1E3A8A",
  },
  {
    channel: "じゃらん",
    bookings: 38,
    revenue: 820_000,
    adCost: 82_000,
    roas: 10.0,
    adr: 21_600,
    cancellRate: 4.1,
    color: "#f97316",
  },
  {
    channel: "Expedia",
    bookings: 22,
    revenue: 650_000,
    adCost: 78_000,
    roas: 8.3,
    adr: 29_500,
    cancellRate: 6.2,
    color: "#eab308",
  },
];

const CHANNEL_ROAS_TREND = [
  { month: "10月", rakuten: 9.8, booking: 9.5, direct: 18.2, jalan: 9.2, expedia: 7.8 },
  { month: "11月", rakuten: 10.2, booking: 10.1, direct: 19.0, jalan: 9.8, expedia: 8.2 },
  { month: "12月", rakuten: 11.5, booking: 11.0, direct: 22.0, jalan: 10.5, expedia: 9.1 },
  { month: "1月",  rakuten: 9.0, booking: 8.8, direct: 17.5, jalan: 8.5, expedia: 7.2 },
  { month: "2月",  rakuten: 9.5, booking: 9.8, direct: 19.2, jalan: 9.0, expedia: 7.8 },
  { month: "3月",  rakuten: 10.0, booking: 10.0, direct: 20.8, jalan: 10.0, expedia: 8.3 },
];

const PROMOTIONS = [
  {
    id: "p1",
    name: "春の早割プラン",
    channel: "楽天トラベル",
    period: "3/1〜3/31",
    budget: 120_000,
    spend: 98_000,
    bookings: 42,
    revenue: 980_000,
    roas: 10.0,
    status: "active",
  },
  {
    id: "p2",
    name: "連泊割引キャンペーン",
    channel: "全チャネル",
    period: "3/15〜4/15",
    budget: 200_000,
    spend: 75_000,
    bookings: 28,
    revenue: 780_000,
    roas: 10.4,
    status: "active",
  },
  {
    id: "p3",
    name: "バレンタイン特別プラン",
    channel: "Booking.com",
    period: "2/1〜2/28",
    budget: 80_000,
    spend: 80_000,
    bookings: 35,
    revenue: 875_000,
    roas: 10.9,
    status: "ended",
  },
  {
    id: "p4",
    name: "直前割プラン（3日前〜）",
    channel: "自社直接",
    period: "通年",
    budget: 50_000,
    spend: 18_000,
    bookings: 18,
    revenue: 580_000,
    roas: 32.2,
    status: "active",
  },
];

const CREATIVES = [
  {
    id: "c1",
    title: "桜ビュールーム特集",
    type: "バナー",
    channel: "楽天トラベル",
    impressions: 48_500,
    clicks: 1_940,
    ctr: 4.0,
    bookings: 28,
    cvr: 1.44,
    revenue: 680_000,
  },
  {
    id: "c2",
    title: "カップル・記念日プラン",
    type: "プランLP",
    channel: "Booking.com",
    impressions: 32_000,
    clicks: 2_240,
    ctr: 7.0,
    bookings: 34,
    cvr: 1.52,
    revenue: 850_000,
  },
  {
    id: "c3",
    title: "ビジネスパック（朝食付）",
    type: "プランLP",
    channel: "じゃらん",
    impressions: 21_000,
    clicks: 840,
    ctr: 4.0,
    bookings: 16,
    cvr: 1.90,
    revenue: 328_000,
  },
  {
    id: "c4",
    title: "GW先行予約バナー",
    type: "バナー",
    channel: "楽天トラベル",
    impressions: 62_000,
    clicks: 1_240,
    ctr: 2.0,
    bookings: 12,
    cvr: 0.97,
    revenue: 360_000,
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Sub components
// ────────────────────────────────────────────────────────────────────────────

function ChannelOverview() {
  return (
    <div className="space-y-5">
      {/* ROAS サマリーカード */}
      <div className="grid grid-cols-5 gap-3">
        {CHANNEL_DATA.map((ch) => (
          <div key={ch.channel} className="bg-white rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-slate-600 truncate">{ch.channel}</span>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ch.color }} />
            </div>
            <p className="text-xl font-bold text-slate-800">{ch.roas.toFixed(1)}x</p>
            <p className="text-[10px] text-slate-400 mt-0.5">ROAS</p>
            <div className="mt-2 pt-2 border-t border-slate-50 grid grid-cols-2 gap-1">
              <div>
                <p className="text-[10px] text-slate-400">予約数</p>
                <p className="text-xs font-medium text-slate-700">{ch.bookings}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">ADR</p>
                <p className="text-xs font-medium text-slate-700">¥{(ch.adr / 1000).toFixed(0)}k</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ROAS比較バーチャート */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">チャネル別 ROAS・ADR 比較（今月）</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-2">ROAS（広告費用対効果）</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={CHANNEL_DATA} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[0, 25]} />
                <YAxis type="category" dataKey="channel" tick={{ fontSize: 11, fill: "#64748b" }} width={70} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}x`, "ROAS"]} />
                <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
                  {CHANNEL_DATA.map((entry) => (
                    <Cell key={entry.channel} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">平均客室単価（ADR）</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={CHANNEL_DATA} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="channel" tick={{ fontSize: 11, fill: "#64748b" }} width={70} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} formatter={(v: number | undefined) => [`¥${(v ?? 0).toLocaleString()}`, "ADR"]} />
                <Bar dataKey="adr" radius={[0, 4, 4, 0]}>
                  {CHANNEL_DATA.map((entry) => (
                    <Cell key={entry.channel} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ROASトレンド */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">チャネル別 ROAS 推移（6ヶ月）</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={CHANNEL_ROAS_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}x`, ""]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="direct"  name="自社直接"    stroke="#1E3A8A" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="rakuten" name="楽天"        stroke="#e11d48" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="booking" name="Booking"     stroke="#2563eb" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="jalan"   name="じゃらん"    stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="expedia" name="Expedia"     stroke="#eab308" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-400 mt-2">
          自社直接予約はROAS 20x超で推移。直販比率を高める施策が最も費用対効果が高い。
        </p>
      </div>
    </div>
  );
}

function PromotionAnalysis() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">プロモーション毎の効果を集計しています。</p>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">プロモーション名</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">チャネル</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">期間</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">予算消化</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">予約数</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">売上</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">ROAS</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {PROMOTIONS.map((promo) => (
              <tr key={promo.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-700">{promo.name}</td>
                <td className="px-4 py-3 text-slate-500">{promo.channel}</td>
                <td className="px-4 py-3 text-slate-500">{promo.period}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E3A8A] rounded-full"
                        style={{ width: `${Math.min((promo.spend / promo.budget) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-slate-600">{Math.round((promo.spend / promo.budget) * 100)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{promo.bookings}件</td>
                <td className="px-4 py-3 text-right text-slate-700">¥{(promo.revenue / 10000).toFixed(0)}万</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    "font-bold",
                    promo.roas >= 15 ? "text-green-600" : promo.roas >= 10 ? "text-[#1E3A8A]" : "text-amber-600"
                  )}>
                    {promo.roas.toFixed(1)}x
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium",
                    promo.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {promo.status === "active" ? "実施中" : "終了"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* インサイト */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl border border-green-100 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-700">最高効率</span>
          </div>
          <p className="text-sm font-bold text-green-800">直前割プラン</p>
          <p className="text-xs text-green-600 mt-0.5">ROAS 32.2x — 自社直接の強み</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">最多売上</span>
          </div>
          <p className="text-sm font-bold text-blue-800">春の早割プラン</p>
          <p className="text-xs text-blue-600 mt-0.5">¥980K — 楽天トラベルで最大貢献</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Percent className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">予算消化率</span>
          </div>
          <p className="text-sm font-bold text-amber-800">連泊割キャンペーン</p>
          <p className="text-xs text-amber-600 mt-0.5">37.5%消化 — 残予算の活用余地大</p>
        </div>
      </div>
    </div>
  );
}

function CreativeAnalysis() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">クリエイティブ（バナー・プランLP）毎のCTR・CVR・売上を集計しています。</p>
      <div className="grid grid-cols-2 gap-4">
        {CREATIVES.map((cr) => (
          <div key={cr.id} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {cr.type === "バナー"
                  ? <ImageIcon className="w-4 h-4 text-slate-500" />
                  : <Megaphone className="w-4 h-4 text-slate-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{cr.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{cr.type}</span>
                  <span className="text-xs text-slate-400">{cr.channel}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "インプレッション", value: `${(cr.impressions / 1000).toFixed(0)}K` },
                { label: "CTR", value: `${cr.ctr.toFixed(1)}%`,
                  highlight: cr.ctr >= 5 ? "text-green-600" : cr.ctr >= 3 ? "text-[#1E3A8A]" : "text-amber-600" },
                { label: "CVR", value: `${cr.cvr.toFixed(2)}%`,
                  highlight: cr.cvr >= 1.5 ? "text-green-600" : cr.cvr >= 1.0 ? "text-[#1E3A8A]" : "text-amber-600" },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-50 rounded-lg p-2">
                  <p className={cn("text-sm font-bold", stat.highlight ?? "text-slate-700")}>{stat.value}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
              <span className="text-xs text-slate-500">予約 {cr.bookings}件</span>
              <span className="text-sm font-bold text-[#1E3A8A]">¥{(cr.revenue / 10000).toFixed(0)}万</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

type SubTab = "channels" | "promotions" | "creatives";

const SUB_TABS = [
  { id: "channels"   as SubTab, label: "チャネル分析・ROAS" },
  { id: "promotions" as SubTab, label: "プロモーション分析" },
  { id: "creatives"  as SubTab, label: "クリエイティブ分析" },
];

export function ChannelAnalyticsTab() {
  const [activeTab, setActiveTab] = useState<SubTab>("channels");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-slate-800">予約経路分析</h2>
        <p className="text-xs text-slate-400 mt-0.5">チャネル別ROAS・プロモーション・クリエイティブの効果を可視化します</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              activeTab === tab.id
                ? "border-[#1E3A8A] text-[#1E3A8A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "channels"   && <ChannelOverview />}
      {activeTab === "promotions" && <PromotionAnalysis />}
      {activeTab === "creatives"  && <CreativeAnalysis />}
    </div>
  );
}
