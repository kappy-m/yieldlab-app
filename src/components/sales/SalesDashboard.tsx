"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Users, Building2, Handshake, Target } from "lucide-react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// ダミーデータ（実装フェーズ2でAPI化）
// ----------------------------------------------------------------
const REVENUE_BY_CHANNEL = [
  { channel: "OTA", revenue: 28500000, share: 38, change: +5 },
  { channel: "直販Web", revenue: 15200000, share: 20, change: +12 },
  { channel: "法人契約", revenue: 18900000, share: 25, change: -3 },
  { channel: "グループ", revenue: 8400000, share: 11, change: +8 },
  { channel: "その他", revenue: 4500000, share: 6, change: -1 },
];

const MONTHLY_SALES = [
  { month: "10月", budget: 62000000, actual: 58400000 },
  { month: "11月", budget: 68000000, actual: 71200000 },
  { month: "12月", budget: 85000000, actual: 82600000 },
  { month: "1月",  budget: 55000000, actual: 53100000 },
  { month: "2月",  budget: 58000000, actual: 60800000 },
  { month: "3月",  budget: 75000000, actual: 75500000 },
  { month: "4月",  budget: 70000000, actual: null },
  { month: "5月",  budget: 72000000, actual: null },
];

const RECENT_DEALS = [
  { id: 1, name: "三菱商事 春季研修合宿", account: "三菱商事株式会社", stage: "成約", rooms: 45, nights: 3, revenue: 3800000, date: "2026-04-10", assignee: "田中 M" },
  { id: 2, name: "ブライダルフェア 週末パッケージ", account: "山田 花子 様", stage: "交渉中", rooms: 20, nights: 2, revenue: 1200000, date: "2026-04-18", assignee: "佐藤 A" },
  { id: 3, name: "NTTデータ 社員旅行", account: "NTTデータ株式会社", stage: "提案中", rooms: 60, nights: 2, revenue: 4500000, date: "2026-05-02", assignee: "田中 M" },
  { id: 4, name: "GW特別パッケージ 旅行代理店", account: "JTB法人営業部", stage: "成約", rooms: 30, nights: 4, revenue: 5600000, date: "2026-05-03", assignee: "鈴木 K" },
  { id: 5, name: "経済産業省 視察団", account: "経済産業省", stage: "リード", rooms: 15, nights: 1, revenue: 600000, date: "2026-04-25", assignee: "佐藤 A" },
];

const STAGE_COLORS: Record<string, string> = {
  "リード":   "text-slate-500 bg-slate-100 border-slate-200",
  "提案中":   "text-blue-600 bg-blue-50 border-blue-200",
  "交渉中":   "text-amber-600 bg-amber-50 border-amber-200",
  "成約":     "text-green-600 bg-green-50 border-green-200",
  "失注":     "text-red-500 bg-red-50 border-red-200",
};

const CHANNEL_COLORS = ["#1E3A8A", "#3B82F6", "#0891B2", "#059669", "#94a3b8"];

function fmt(n: number) {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `¥${Math.round(n / 10_000)}万`;
  return `¥${n.toLocaleString()}`;
}

function changeBadge(pct: number) {
  const positive = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium",
      positive ? "text-green-600" : "text-red-500"
    )}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{pct}%
    </span>
  );
}

// ----------------------------------------------------------------
// カスタムTooltip
// ----------------------------------------------------------------
interface BudgetTooltipProps { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; }
function BudgetTooltip({ active, payload, label }: BudgetTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2 border-b border-slate-100 pb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600">{p.name}</span>
          </div>
          <span className="font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------
export function SalesDashboard({ propertyId: _propertyId }: { propertyId: number }) {
  const totalRevenue = useMemo(() => REVENUE_BY_CHANNEL.reduce((s, c) => s + c.revenue, 0), []);

  const kpis = [
    {
      label: "今月売上",
      value: fmt(75500000),
      sub: "予算比 +0.7%",
      positive: true,
      icon: Target,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "成約件数",
      value: "28件",
      sub: "前月比 +3件",
      positive: true,
      icon: Handshake,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "法人アカウント",
      value: "64社",
      sub: "新規 +2社",
      positive: true,
      icon: Building2,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "担当者数",
      value: "8名",
      sub: "アクティブ",
      positive: true,
      icon: Users,
      color: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPIカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="yl-card p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", kpi.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{kpi.label}</p>
                <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
                <p className={cn("text-[10px]", kpi.positive ? "text-green-600" : "text-red-500")}>{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* チャート2列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 月次売上 vs 予算 */}
        <div className="yl-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">月次売上 vs 予算</h3>
            <p className="text-xs text-slate-400 mt-0.5">直近8ヶ月の実績と予算の比較</p>
          </div>
          <div className="px-5 py-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY_SALES} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${Math.round(v / 1_000_000)}M`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<BudgetTooltip />} />
                <Bar dataKey="budget" name="予算" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="実績" radius={[3, 3, 0, 0]}>
                  {MONTHLY_SALES.map((entry, i) => (
                    <Cell key={i} fill={entry.actual == null ? "#e2e8f0" : entry.actual >= entry.budget ? "#059669" : "#1E3A8A"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-slate-200" />予算</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-[#1E3A8A]" />実績（未達）</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-green-500" />実績（達成）</div>
            </div>
          </div>
        </div>

        {/* チャネル別売上シェア */}
        <div className="yl-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">チャネル別売上構成</h3>
            <p className="text-xs text-slate-400 mt-0.5">今月の予約チャネル分布</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            {REVENUE_BY_CHANNEL.map((ch, i) => (
              <div key={ch.channel} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[i] }} />
                    <span className="font-medium text-slate-700">{ch.channel}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-900 font-semibold">{fmt(ch.revenue)}</span>
                    {changeBadge(ch.change)}
                    <span className="text-slate-400 w-8 text-right">{ch.share}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${ch.share}%`, backgroundColor: CHANNEL_COLORS[i] }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">合計</span>
              <span className="font-bold text-slate-900">{fmt(totalRevenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 直近商談リスト */}
      <div className="yl-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">直近の商談・グループ予約</h3>
            <p className="text-xs text-slate-400 mt-0.5">進行中・直近成約の一覧</p>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {RECENT_DEALS.map((deal) => (
            <div key={deal.id} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 truncate">{deal.name}</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0", STAGE_COLORS[deal.stage])}>
                        {deal.stage}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>{deal.account}</span>
                      <span>{deal.rooms}室 × {deal.nights}泊</span>
                      <span>チェックイン: {deal.date}</span>
                      <span>担当: {deal.assignee}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-900">{fmt(deal.revenue)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
