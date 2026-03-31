"use client";

import { useEffect, useState, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertCircle, Info,
  CheckCircle, ArrowRight, Minus,
} from "lucide-react";
import { fetchOverview, type OverviewOut, type OverviewAlertOut } from "@/lib/api";
// Yield プロダクトのタブID（DashboardTabs 廃止に伴いローカル定義）
type TabId = "overview" | "daily" | "booking" | "pricing" | "competitor" | "market" | "cost" | "budget" | "settings";

// ─── count-up アニメーション ─────────────────────────────────────────────────
function useCountUp(target: number, duration = 800, decimals = 1) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((target * eased).toFixed(decimals)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, decimals]);

  return value;
}

// ─── KPI カード ───────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  unit: string;
  change: number;
  decimals?: number;
  prefix?: string;
  loaded: boolean;
}

function KpiCardAnimated({ label, value, unit, change, decimals = 1, prefix = "", loaded }: KpiCardProps) {
  const animated = useCountUp(loaded ? value : 0, 900, decimals);
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">
        {prefix}{loaded ? animated.toLocaleString("ja-JP") : "—"}{unit}
      </p>
      <div className="mt-2 flex items-center gap-1">
        {isNeutral ? (
          <Minus className="w-3.5 h-3.5 text-slate-400" />
        ) : isPositive ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-yl-negative" />
        )}
        <span
          className={`text-xs font-medium ${
            isNeutral ? "text-slate-400" : isPositive ? "text-yl-positive" : "text-yl-negative"
          }`}
        >
          {isNeutral ? "前日比 変動なし" : `前日比 ${isPositive ? "+" : ""}${change.toLocaleString("ja-JP")}${unit}`}
        </span>
      </div>
    </div>
  );
}

// ─── アラートカード ───────────────────────────────────────────────────────────
const ALERT_CONFIG: Record<
  OverviewAlertOut["severity"],
  { border: string; bg: string; icon: React.ReactNode; label: string }
> = {
  critical: {
    border: "border-l-rose-500",
    bg: "bg-rose-50",
    icon: <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />,
    label: "要対応",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    icon: <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
    label: "注意",
  },
  info: {
    border: "border-l-blue-400",
    bg: "bg-blue-50",
    icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
    label: "情報",
  },
};

interface AlertCardProps {
  alert: OverviewAlertOut;
  onAction?: () => void;
}

function AlertCard({ alert, onAction }: AlertCardProps) {
  const cfg = ALERT_CONFIG[alert.severity];
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border-l-4 ${cfg.border} ${cfg.bg} border border-slate-100`}
    >
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-2">
          {cfg.label}
        </span>
        <span className="text-sm text-slate-700">{alert.message}</span>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-xs font-medium text-brand-navy hover:text-brand-navy/80 cursor-pointer transition-colors duration-150 flex-shrink-0"
        >
          確認
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Recharts カスタム Tooltip ────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-bold tabular-nums">{p.value.toLocaleString("ja-JP")}</span>
        </p>
      ))}
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────────────────────
interface OverviewTabProps {
  propertyId: number;
  onTabChange?: (tab: TabId) => void;
}

export function OverviewTab({ propertyId, onTabChange }: OverviewTabProps) {
  const [data, setData] = useState<OverviewOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchOverview(propertyId)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const kpi = data?.today_kpi;

  // 月次予算進捗
  const budgetPct = kpi?.budget_progress ?? null;

  return (
    <div className="space-y-6">
      {/* ─── Section A: 今日の KPI ─── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          本日の経営サマリー
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCardAnimated
            label="本日の OCC"
            value={kpi?.occ ?? 0}
            unit="%"
            change={kpi?.occ_change ?? 0}
            decimals={1}
            loaded={!loading && !!kpi}
          />
          <KpiCardAnimated
            label="本日の ADR"
            value={kpi?.adr ?? 0}
            unit="円"
            change={kpi?.adr_change ?? 0}
            decimals={0}
            loaded={!loading && !!kpi}
          />
          <KpiCardAnimated
            label="本日の RevPAR"
            value={kpi?.revpar ?? 0}
            unit="円"
            change={kpi?.revpar_change ?? 0}
            decimals={0}
            loaded={!loading && !!kpi}
          />
          {/* 月次予算進捗 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">月次予算進捗</p>
            {loading ? (
              <div className="h-8 bg-slate-100 rounded animate-pulse" />
            ) : budgetPct !== null ? (
              <>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{budgetPct.toFixed(1)}%</p>
                <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(budgetPct, 100)}%`,
                      backgroundColor: budgetPct >= 80 ? "#10B981" : budgetPct >= 50 ? "#F59E0B" : "#EF4444",
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">月次目標対比</p>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-xl font-semibold text-slate-400">—</p>
                <p className="text-xs text-slate-400">予算データなし</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Section B: アラート ─── */}
      {!loading && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            アクションが必要な項目
          </h2>
          {error ? (
            <div role="alert" className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              データの取得に失敗しました: {error}
            </div>
          ) : data?.alerts.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              現在、対応が必要なアラートはありません
            </div>
          ) : (
            <div className="space-y-2">
              {data?.alerts.map((alert, i) => (
                <AlertCard
                  key={i}
                  alert={alert}
                  onAction={
                    alert.type === "pending_recommendation"
                      ? () => onTabChange?.("pricing")
                      : alert.type === "competitor_change"
                      ? () => onTabChange?.("competitor")
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Section C: 週間トレンドグラフ ─── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          過去7日間のトレンド
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          {loading ? (
            <div className="h-64 bg-slate-100 rounded animate-pulse" />
          ) : data?.weekly_trend.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 text-slate-400">
              <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
              <span className="text-sm">まだデータが蓄積されていません</span>
              <span className="text-xs text-slate-300">ログを記録すると7日間のトレンドが表示されます</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data?.weekly_trend} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickFormatter={(d: string) => {
                    const [, m, day] = d.split("-");
                    return `${m}/${day}`;
                  }}
                />
                <YAxis yAxisId="occ" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} unit="%" width={42} />
                <YAxis yAxisId="adr" orientation="right" tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} width={42} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                <Line yAxisId="occ" type="monotone" dataKey="occ" name="OCC (%)" stroke="#1E3A8A" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="adr" type="monotone" dataKey="adr" name="ADR (円)" stroke="#CA8A04" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="adr" type="monotone" dataKey="revpar" name="RevPAR (円)" stroke="#059669" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ─── Section D: AI サマリー (将来拡張用プレースホルダー) ─── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          AI 経営サマリー
        </h2>
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-navy/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">AI 経営状況サマリー</p>
              <p className="text-sm text-slate-500">
                今日の経営状況を自然言語でサマリー表示する機能は近日公開予定です。
                GPT-4o を活用した分析により、競合動向・予算進捗・おすすめアクションを毎朝提案します。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
