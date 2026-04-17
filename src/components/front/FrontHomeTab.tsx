"use client";

import { useState, useEffect } from "react";
import {
  Users, BedDouble, TrendingUp, Gift,
  Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { KpiCard } from "@/components/shared/KpiCard";
import { fetchGuestStays, type GuestStayListOut } from "@/lib/api";

// 在泊推移チャートはバックエンドに時間粒度のデータがないため静的プレースホルダー
const STAY_TREND = [
  { time: "06:00", staying: 82, checkin: 0, checkout: 18 },
  { time: "08:00", staying: 64, checkin: 0, checkout: 36 },
  { time: "10:00", staying: 30, checkin: 2, checkout: 52 },
  { time: "12:00", staying: 15, checkin: 8, checkout: 5  },
  { time: "14:00", staying: 22, checkin: 18, checkout: 0 },
  { time: "16:00", staying: 58, checkin: 36, checkout: 0 },
  { time: "18:00", staying: 88, checkin: 30, checkout: 0 },
  { time: "20:00", staying: 110, checkin: 22, checkout: 0 },
  { time: "22:00", staying: 118, checkin: 8, checkout: 0  },
];

// 本日スケジュールはバックエンドに対応テーブルがないため静的プレースホルダー
const TODAY_EVENTS = [
  { time: "14:00", event: "ツアー団体 チェックイン (18名)",  type: "group" },
  { time: "15:00", event: "VIPゲスト アーリーチェックイン",  type: "vip" },
  { time: "18:00", event: "レストラン貸切予約 (26名)",       type: "facility" },
  { time: "11:30", event: "清掃チーム全室完了見込み",         type: "housekeeping" },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 h-60 bg-slate-100 rounded-xl" />
        <div className="col-span-2 h-60 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-40 bg-slate-100 rounded-xl" />
    </div>
  );
}

export function FrontHomeTab({ propertyId }: { propertyId: number }) {
  const [data, setData] = useState<GuestStayListOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchGuestStays(propertyId, { view: "today" })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return <LoadingSkeleton />;

  const today = new Date().toISOString().slice(0, 10);
  const checkedOutToday = data?.items.filter(
    s => s.status === "checked_out" && s.checkout_date === today
  ).length ?? 0;
  const totalCheckoutToday = data?.today_checkout ?? 0;
  const guestsWithRequests = data?.items.filter(s => s.special_requests).length ?? 0;

  // special_requests があるゲストをアップセル候補として表示
  const upsellGuests = (data?.items ?? [])
    .filter(s => s.special_requests && s.room_number)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* KPIグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          variant="icon"
          label="本日の在泊数"
          value={String(data?.today_inhouse ?? "—")}
          sub="チェックイン済みゲスト"
          icon={BedDouble}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          variant="icon"
          label="チェックイン予定"
          value={String(data?.today_checkin ?? "—")}
          sub="本日到着予定"
          icon={Users}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <KpiCard
          variant="icon"
          label="チェックアウト"
          value={`${checkedOutToday} / ${totalCheckoutToday}`}
          sub={`残り ${Math.max(0, totalCheckoutToday - checkedOutToday)}名`}
          icon={CheckCircle2}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KpiCard
          variant="icon"
          label="特別リクエスト"
          value={String(guestsWithRequests)}
          sub="要対応ゲスト"
          icon={Gift}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* メインコンテンツ: 在泊推移 + ゲスト一覧 */}
      <div className="grid grid-cols-5 gap-4">
        {/* 在泊数推移チャート（プレースホルダー） */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">本日の在泊推移</h3>
            <span className="text-xs text-slate-400">参考値（時間粒度データ未対応）</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={STAY_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="stayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v: number | undefined) => [`${v ?? 0}名`, ""]}
              />
              <Area type="monotone" dataKey="staying" name="在泊" stroke="#1E3A8A" fill="url(#stayGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="checkin" name="チェックイン" stroke="#10b981" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
              <Area type="monotone" dataKey="checkout" name="チェックアウト" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 特別リクエスト・要対応ゲスト */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-slate-700">特別リクエスト</h3>
          </div>
          {upsellGuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <Gift className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">本日の特別リクエストはありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upsellGuests.map((g) => (
                <div
                  key={g.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-slate-400">{g.room_number}号室</span>
                        <span className="text-sm font-medium text-slate-700">{g.guest_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{g.special_requests}</p>
                    </div>
                    <button className="flex-shrink-0 text-[10px] bg-brand-navy text-white px-2 py-0.5 rounded cursor-pointer hover:bg-brand-navy/90">
                      対応
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 本日のスケジュール（プレースホルダー） */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">本日のスケジュール・タスク</h3>
          </div>
          <span className="text-xs text-slate-400">参考値（スケジュール管理未対応）</span>
        </div>
        <div className="space-y-2">
          {TODAY_EVENTS.sort((a, b) => a.time.localeCompare(b.time)).map((ev) => (
            <div key={ev.event} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
              <span className="text-xs font-mono text-slate-400 w-12 flex-shrink-0">{ev.time}</span>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                ev.type === "group"    ? "bg-blue-400" :
                ev.type === "vip"     ? "bg-amber-400" :
                ev.type === "facility" ? "bg-purple-400" :
                "bg-green-400"
              }`} />
              <span className="text-sm text-slate-700">{ev.event}</span>
              {ev.type === "group" && (
                <span className="ml-auto text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">団体</span>
              )}
              {ev.type === "vip" && (
                <AlertTriangle className="ml-auto w-4 h-4 text-amber-400" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
