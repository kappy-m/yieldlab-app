"use client";

import { useState, useEffect } from "react";
import {
  Calendar, TrendingDown,
  Users, DollarSign, BarChart2,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { KpiCard } from "@/components/shared/KpiCard";
import { fetchReservations, type ReservationListOut } from "@/lib/api";

const CHANNEL_COLORS: Record<string, string> = {
  "楽天": "#e11d48",
  "Booking.com": "#2563eb",
  "直接": "#1E3A8A",
  "じゃらん": "#f97316",
  "Expedia": "#eab308",
  "Airbnb": "#f43f5e",
};
const FALLBACK_COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#84cc16", "#a78bfa"];

function channelColor(name: string, index: number) {
  return CHANNEL_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 h-60 bg-slate-100 rounded-xl" />
        <div className="col-span-3 h-60 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-40 bg-slate-100 rounded-xl" />
    </div>
  );
}

export function ReservationHomeTab({ propertyId }: { propertyId: number }) {
  const [data, setData] = useState<ReservationListOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const month = new Date().toISOString().slice(0, 7);
    fetchReservations(propertyId, { month })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return <LoadingSkeleton />;

  const today = new Date().toISOString().slice(0, 10);
  const items = data?.items ?? [];

  // KPIs
  const activeItems = items.filter(r => r.status !== "cancelled" && r.status !== "no_show");
  const cancelledItems = items.filter(r => r.status === "cancelled");
  const monthlyCount = activeItems.length;
  const todayNew = items.filter(r => r.booking_date === today).length;
  const cancelRate = items.length > 0 ? (cancelledItems.length / items.length) * 100 : 0;
  const itemsWithAmount = activeItems.filter(r => r.total_amount != null);
  const avgRate = itemsWithAmount.length > 0
    ? itemsWithAmount.reduce((sum, r) => sum + (r.total_amount ?? 0), 0) / itemsWithAmount.length
    : 0;

  // Channel mix
  const channelCounts: Record<string, number> = {};
  for (const r of activeItems) {
    const ch = r.ota_channel ?? "直接";
    channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
  }
  const totalActive = activeItems.length || 1;
  const channelMix = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      value: Math.round((count / totalActive) * 100),
      color: channelColor(name, i),
    }));

  // Booking trend (last 7 days)
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    return {
      day: label,
      bookings: items.filter(r => r.booking_date === dateStr && r.status !== "cancelled").length,
      cancels: items.filter(r => r.booking_date === dateStr && r.status === "cancelled").length,
    };
  });

  // Upcoming 5 days
  const upcoming = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}（${DAYS_JA[d.getDay()]}）`,
      arrivals: items.filter(r => r.checkin_date === dateStr && r.status !== "cancelled").length,
      departures: items.filter(r => r.checkout_date === dateStr && r.status !== "cancelled").length,
    };
  });

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          variant="icon"
          label="今月の予約数"
          value={String(monthlyCount)}
          sub="キャンセル除く"
          icon={Calendar}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          variant="icon"
          label="本日の新規予約"
          value={String(todayNew)}
          sub="本日の受付件数"
          icon={Users}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <KpiCard
          variant="icon"
          label="今月のキャンセル率"
          value={`${cancelRate.toFixed(1)}%`}
          sub={`キャンセル ${cancelledItems.length}件`}
          icon={TrendingDown}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KpiCard
          variant="icon"
          label="平均単価"
          value={avgRate > 0 ? `¥${Math.round(avgRate).toLocaleString()}` : "—"}
          sub="今月の予約平均"
          icon={DollarSign}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* チャネルミックス + 予約推移 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">チャネルミックス（今月）</h3>
          {channelMix.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-xs">データなし</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={channelMix} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                    {channelMix.map((entry) => (
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
                {channelMix.slice(0, 5).map((ch) => (
                  <div key={ch.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ch.color }} />
                    <span className="text-xs text-slate-600 flex-1">{ch.name}</span>
                    <span className="text-xs font-medium text-slate-700">{ch.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-3 bg-white rounded-xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">直近7日の予約推移</h3>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="bookGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v: number | undefined) => [`${v ?? 0}件`, ""]}
              />
              <Area type="monotone" dataKey="bookings" name="新規予約" stroke="#1E3A8A" fill="url(#bookGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="cancels" name="キャンセル" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 今後5日間 */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">今後5日間の予約状況</h3>
        </div>
        <div className="space-y-2">
          {upcoming.map((day) => (
            <div key={day.date} className="flex items-center gap-6 py-2 border-b border-slate-50 last:border-0">
              <span className="text-xs font-medium text-slate-600 w-28 flex-shrink-0">{day.date}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-green-600">↑ チェックイン {day.arrivals}件</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-amber-600">↓ チェックアウト {day.departures}件</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
