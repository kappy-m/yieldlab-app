"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertCircle, TrendingUp, Users, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const PIPELINE_DATA = [
  { stage: "提案中",   count: 1, amount: 180 },
  { stage: "交渉中",   count: 1, amount: 54 },
  { stage: "契約待ち", count: 1, amount: 99 },
  { stage: "成立",     count: 1, amount: 28 },
];

const MONTHLY_TREND = [
  { month: "10月", leads: 3, won: 1, amount: 45 },
  { month: "11月", leads: 5, won: 2, amount: 120 },
  { month: "12月", leads: 4, won: 2, amount: 98 },
  { month: "1月",  leads: 2, won: 1, amount: 32 },
  { month: "2月",  leads: 6, won: 3, amount: 210 },
  { month: "3月",  leads: 6, won: 1, amount: 28 },
];

const URGENT_ACTIONS = [
  { id: "D002", client: "近畿日本ツーリスト", action: "バス駐車場確認・回答",  due: "2026-03-27", type: "deal" as const },
  { id: "L006", client: "〇〇大学体育会",     action: "新規リード — 担当アサイン未", due: "2026-03-26", type: "lead" as const },
  { id: "D003", client: "JTB法人東京支店",   action: "契約書最終確認・署名",   due: "2026-03-30", type: "deal" as const },
];

function DaysUntil({ dateStr }: { dateStr: string }) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return <span className="text-red-500 text-xs font-medium">期限超過</span>;
  if (diff === 0) return <span className="text-red-500 text-xs font-medium">本日</span>;
  if (diff <= 3)  return <span className="text-orange-500 text-xs font-medium">{diff}日後</span>;
  return <span className="text-slate-400 text-xs">{diff}日後</span>;
}

export function SalesDashboard({ propertyId: _propertyId }: { propertyId: number }) {
  const totalPipeline = useMemo(() => PIPELINE_DATA.reduce((s, d) => s + d.amount, 0), []);
  const winRate = Math.round((1 / 4) * 100);

  const kpis = [
    { label: "今月の新規リード",   value: "6件",       icon: Users,        color: "text-blue-600",  bg: "bg-blue-50" },
    { label: "パイプライン総額",   value: `¥${totalPipeline}万`, icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "今月の成約件数",     value: "1件",        icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "成約率",             value: `${winRate}%`, icon: TrendingUp,  color: "text-[#1E3A8A]", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-3">
              <div className={cn("rounded-lg p-2 flex-shrink-0", kpi.bg)}>
                <Icon className={cn("w-4 h-4", kpi.color)} />
              </div>
              <div>
                <p className="text-xs text-slate-400">{kpi.label}</p>
                <p className={cn("text-xl font-bold mt-0.5", kpi.color)}>{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* アクション要 + パイプラインファネル */}
      <div className="grid grid-cols-5 gap-4">
        {/* 要対応アクション */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-slate-700">要対応アクション</h3>
            <span className="ml-auto text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">
              {URGENT_ACTIONS.length}件
            </span>
          </div>
          <div className="space-y-2">
            {URGENT_ACTIONS.map((action) => (
              <div key={action.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <div className={cn("rounded-md p-1.5 flex-shrink-0",
                  action.type === "lead" ? "bg-blue-100" : "bg-orange-100"
                )}>
                  {action.type === "lead"
                    ? <Users className="w-3 h-3 text-blue-600" />
                    : <Clock className="w-3 h-3 text-orange-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{action.client}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{action.action}</p>
                </div>
                <DaysUntil dateStr={action.due} />
              </div>
            ))}
          </div>
        </div>

        {/* パイプラインファネル */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">パイプライン（万円）</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={PIPELINE_DATA} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="万" />
              <Tooltip
                formatter={(v: number) => [`¥${v}万`, "金額"]}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
              />
              <Bar dataKey="amount" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 月次トレンド */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">月次トレンド（過去6ヶ月）</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={MONTHLY_TREND} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="件" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="万" />
            <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
            <Bar yAxisId="left" dataKey="leads" name="新規リード" fill="#93c5fd" radius={[3, 3, 0, 0]} barSize={14} />
            <Bar yAxisId="left" dataKey="won"   name="成立件数"   fill="#1E3A8A" radius={[3, 3, 0, 0]} barSize={14} />
            <Bar yAxisId="right" dataKey="amount" name="成立金額(万)" fill="#a78bfa" radius={[3, 3, 0, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-center">
          {[
            { color: "bg-blue-300", label: "新規リード" },
            { color: "bg-[#1E3A8A]", label: "成立件数" },
            { color: "bg-violet-400", label: "成立金額（万円）" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded-sm", l.color)} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
