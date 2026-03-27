"use client";

import {
  Calendar, TrendingUp, TrendingDown, ArrowUpRight,
  Users, DollarSign, BarChart2,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ────────────────────────────────────────────────────────────────────────────
// Mock data
// ────────────────────────────────────────────────────────────────────────────

const CHANNEL_MIX = [
  { name: "楽天",       value: 32, color: "#e11d48" },
  { name: "Booking",   value: 28, color: "#2563eb" },
  { name: "自社直接",  value: 22, color: "#1E3A8A" },
  { name: "じゃらん",  value: 12, color: "#f97316" },
  { name: "Expedia",   value: 6,  color: "#eab308" },
];

const BOOKING_TREND = [
  { day: "3/21", bookings: 18, cancels: 2 },
  { day: "3/22", bookings: 24, cancels: 1 },
  { day: "3/23", bookings: 20, cancels: 3 },
  { day: "3/24", bookings: 32, cancels: 1 },
  { day: "3/25", bookings: 28, cancels: 2 },
  { day: "3/26", bookings: 35, cancels: 0 },
  { day: "3/27", bookings: 22, cancels: 1 },
];

const UPCOMING = [
  { date: "3/28（土）", arrivals: 42, departures: 38, occupancy: 96 },
  { date: "3/29（日）", arrivals: 28, departures: 44, occupancy: 82 },
  { date: "3/30（月）", arrivals: 18, departures: 32, occupancy: 72 },
  { date: "3/31（火）", arrivals: 22, departures: 20, occupancy: 74 },
  { date: "4/1（水）",  arrivals: 35, departures: 18, occupancy: 88 },
];

// ────────────────────────────────────────────────────────────────────────────
// KPI Card
// ────────────────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  trend?: string;
  trendUp?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, trend, trendUp }: KpiProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trendUp ? "text-green-600" : "text-red-500"}`}>
            {trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

export function ReservationHomeTab() {
  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="今月の予約数"
          value="312"
          sub="前月比 +24件"
          icon={Calendar}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          trend="+8.3%"
          trendUp
        />
        <KpiCard
          label="本日の新規予約"
          value="22"
          sub="キャンセル 1件"
          icon={Users}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          trend="+4"
          trendUp
        />
        <KpiCard
          label="今月の予約取消率"
          value="4.2%"
          sub="前月 5.1%"
          icon={TrendingDown}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          trend="-0.9pt"
          trendUp
        />
        <KpiCard
          label="平均単価"
          value="¥24,800"
          sub="RevPAR ¥23,200"
          icon={DollarSign}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          trend="+¥1,200"
          trendUp
        />
      </div>

      {/* チャネルミックス + 予約推移 */}
      <div className="grid grid-cols-5 gap-4">
        {/* チャネルミックス */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">チャネルミックス（今月）</h3>
            <a href="#" className="text-xs text-[#1E3A8A] flex items-center gap-0.5 hover:underline">
              詳細分析 <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={CHANNEL_MIX} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                  {CHANNEL_MIX.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }}
                  formatter={(v: number | undefined) => [`${v ?? 0}%`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {CHANNEL_MIX.map((ch) => (
                <div key={ch.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ch.color }} />
                  <span className="text-xs text-slate-600 flex-1">{ch.name}</span>
                  <span className="text-xs font-medium text-slate-700">{ch.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 予約推移チャート */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">直近7日の予約推移</h3>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={BOOKING_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="bookGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Area type="monotone" dataKey="bookings" name="新規予約" stroke="#1E3A8A" fill="url(#bookGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="cancels" name="キャンセル" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 今後の予定 */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">今後5日間の予約状況</h3>
        </div>
        <div className="space-y-2">
          {UPCOMING.map((day) => (
            <div key={day.date} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
              <span className="text-xs font-medium text-slate-600 w-28 flex-shrink-0">{day.date}</span>
              <div className="flex items-center gap-1.5 w-24">
                <span className="text-xs text-green-600">↑ {day.arrivals}</span>
                <span className="text-slate-300">/</span>
                <span className="text-xs text-amber-600">↓ {day.departures}</span>
              </div>
              <div className="flex-1">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${day.occupancy}%`,
                      background: day.occupancy >= 90 ? "#1E3A8A" : day.occupancy >= 75 ? "#3b82f6" : "#94a3b8",
                    }}
                  />
                </div>
              </div>
              <span className={`text-xs font-medium w-10 text-right ${
                day.occupancy >= 90 ? "text-[#1E3A8A]" : day.occupancy >= 75 ? "text-blue-500" : "text-slate-400"
              }`}>
                {day.occupancy}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
