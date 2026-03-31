"use client";

import { useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Mock data
// ────────────────────────────────────────────────────────────────────────────

const NATIONALITY_DATA = [
  { name: "日本",     value: 52, color: "#1E3A8A" },
  { name: "中国",     value: 18, color: "#3b82f6" },
  { name: "台湾",     value: 10, color: "#06b6d4" },
  { name: "韓国",     value: 8,  color: "#10b981" },
  { name: "アメリカ", value: 6,  color: "#f59e0b" },
  { name: "その他",   value: 6,  color: "#94a3b8" },
];

const GENDER_DATA = [
  { name: "男性",     value: 44, color: "#1E3A8A" },
  { name: "女性",     value: 48, color: "#ec4899" },
  { name: "不明",     value: 8,  color: "#94a3b8" },
];

const AGE_DATA = [
  { age: "〜20代", count: 12, color: "#06b6d4" },
  { age: "30代",   count: 28, color: "#1E3A8A" },
  { age: "40代",   count: 35, color: "#3b82f6" },
  { age: "50代",   count: 18, color: "#f59e0b" },
  { age: "60代〜", count: 7,  color: "#94a3b8" },
];

const PURPOSE_DATA = [
  { name: "観光",           value: 38, color: "#1E3A8A" },
  { name: "ビジネス",       value: 30, color: "#3b82f6" },
  { name: "記念日・祝事",   value: 16, color: "#ec4899" },
  { name: "家族旅行",       value: 12, color: "#10b981" },
  { name: "その他",         value: 4,  color: "#94a3b8" },
];

const CHANNEL_TREND = [
  { month: "10月", rakuten: 32, booking: 28, direct: 18, jalan: 12, expedia: 10 },
  { month: "11月", rakuten: 30, booking: 30, direct: 20, jalan: 10, expedia: 10 },
  { month: "12月", rakuten: 28, booking: 32, direct: 22, jalan: 8,  expedia: 10 },
  { month: "1月",  rakuten: 35, booking: 26, direct: 20, jalan: 12, expedia: 7  },
  { month: "2月",  rakuten: 33, booking: 28, direct: 24, jalan: 10, expedia: 5  },
  { month: "3月",  rakuten: 30, booking: 30, direct: 26, jalan: 8,  expedia: 6  },
];

type Period = "today" | "week" | "month";

// ────────────────────────────────────────────────────────────────────────────
// Custom PieChart with legend
// ────────────────────────────────────────────────────────────────────────────

function AttributePie({ data, title }: { data: { name: string; value: number; color: string }[]; title: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <h4 className="text-xs font-semibold text-slate-600 mb-3">{title}</h4>
      <div className="flex items-center gap-3">
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }}
              formatter={(v: number | undefined) => [`${v ?? 0}%`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1.5 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[11px] text-slate-600 truncate">{d.name}</span>
              <span className="ml-auto text-[11px] font-medium text-slate-700">{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

export function GuestAttributeAnalysis() {
  const [period, setPeriod] = useState<Period>("month");

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">来客属性分析</h2>
          <p className="text-xs text-slate-400 mt-0.5">ゲストの属性データを可視化し、施策の最適化に活用します</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 cursor-pointer transition-colors",
                period === p ? "bg-brand-navy text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {p === "today" ? "本日" : p === "week" ? "今週" : "今月"}
            </button>
          ))}
        </div>
      </div>

      {/* パイチャートグリッド */}
      <div className="grid grid-cols-4 gap-4">
        <AttributePie data={NATIONALITY_DATA} title="国籍別" />
        <AttributePie data={GENDER_DATA}      title="性別" />
        <AttributePie data={PURPOSE_DATA}     title="来館目的" />
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h4 className="text-xs font-semibold text-slate-600 mb-3">年齢層別</h4>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={AGE_DATA} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="age" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }}
                formatter={(v: number | undefined) => [`${v ?? 0}%`, ""]}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {AGE_DATA.map((entry) => (
                  <Cell key={entry.age} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 予約経路推移 */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">予約経路の推移（過去6ヶ月）</h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={CHANNEL_TREND} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(v: number | undefined) => [`${v ?? 0}%`, ""]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="rakuten"  name="楽天"     fill="#e11d48" radius={[2, 2, 0, 0]} stackId="a" />
            <Bar dataKey="booking"  name="Booking"  fill="#2563eb" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="direct"   name="自社"     fill="#1E3A8A" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="jalan"    name="じゃらん"  fill="#f97316" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="expedia"  name="Expedia"  fill="#eab308" radius={[2, 2, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* インサイト */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            title: "最多国籍は日本（52%）",
            desc: "国内旅行者が過半数。次いで中国（18%）・台湾（10%）とアジア系が多い。多言語対応を優先すべき。",
            badge: "国籍",
            badgeColor: "bg-blue-50 text-blue-700",
          },
          {
            title: "記念日ゲストは16%",
            desc: "来館目的の中で記念日・祝事が16%。アップセル施策の主要ターゲット。事前の特別対応でNPS向上が期待できる。",
            badge: "目的",
            badgeColor: "bg-rose-50 text-rose-700",
          },
          {
            title: "40代が最多（35%）",
            desc: "30〜40代で63%を占める。可処分所得が高い層へのアップセル・プレミアムプランの訴求を強化すべき。",
            badge: "年齢",
            badgeColor: "bg-amber-50 text-amber-700",
          },
        ].map((ins) => (
          <div key={ins.title} className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ins.badgeColor}`}>{ins.badge}</span>
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">{ins.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{ins.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
