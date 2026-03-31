"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import {
  fetchCompetitorPrices,
  fetchCompetitorAverages,
  fetchCompSet,
  fetchPricingGrid,
  fetchProperty,
  triggerPipeline,
  type CompetitorPriceOut,
  type CompetitorAvgOut,
  type CompSetOut,
  type PricingCellOut,
} from "@/lib/api";
import { SkeletonChart, SkeletonTable, SkeletonCardGrid } from "@/components/shared/Skeleton";
import { RatingPanel } from "./RatingPanel";

type SubTab = "price" | "rating";

// 競合ホテルカラーパレット
const COMP_COLORS = ["#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];
const OWN_COLOR = "#1E3A8A";

function formatPrice(p: number) {
  return `¥${p.toLocaleString()}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDayLabel(iso: string) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const d = new Date(iso);
  const dow = days[d.getDay()];
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  return { label: `${formatDate(iso)}(${dow})`, isWeekend };
}

// 自社価格（BARラダーCレベル = 標準価格帯）を日付から取得
function buildOwnPriceMap(grid: PricingCellOut[]): Record<string, number> {
  // スタンダードシングル（room_type_id最小）の価格を代表値として使用
  const byDate: Record<string, number[]> = {};
  for (const cell of grid) {
    if (!byDate[cell.target_date]) byDate[cell.target_date] = [];
    byDate[cell.target_date].push(cell.price);
  }
  const map: Record<string, number> = {};
  for (const [date, prices] of Object.entries(byDate)) {
    map[date] = Math.min(...prices);
  }
  return map;
}

interface CompSummary {
  name: string;
  color: string;
  todayPrice: number | null;
  avgPrice: number;
  expediaUrl: string | null;
  scrapeMode: string;
  prices: Record<string, number>;
}

const RANGE_OPTIONS = [
  { label: "14日", days: 14 },
  { label: "30日", days: 30 },
  { label: "90日", days: 90 },
] as const;

export function CompetitorTab({ propertyId }: { propertyId: number }) {
  const [prices, setPrices] = useState<CompetitorPriceOut[]>([]);
  const [averages, setAverages] = useState<CompetitorAvgOut[]>([]);
  const [compSet, setCompSet] = useState<CompSetOut[]>([]);
  const [ownGrid, setOwnGrid] = useState<PricingCellOut[]>([]);
  const [propertyName, setPropertyName] = useState<string>("自社");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [displayDays, setDisplayDays] = useState<14 | 30 | 90>(30);
  const [subTab, setSubTab] = useState<SubTab>("price");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateFrom = today;
  const dateTo = useMemo(() => new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [pricesRes, averagesRes, compSetRes, gridRes, propRes] = await Promise.allSettled([
        fetchCompetitorPrices(propertyId, { date_from: dateFrom, date_to: dateTo }),
        fetchCompetitorAverages(propertyId, { date_from: dateFrom, date_to: dateTo }),
        fetchCompSet(propertyId),
        fetchPricingGrid(propertyId, { date_from: dateFrom, date_to: dateTo }),
        fetchProperty(propertyId),
      ]);
      const allFailed = [pricesRes, averagesRes, compSetRes, gridRes].every(r => r.status === "rejected");
      if (allFailed) {
        setLoadError("データの取得に失敗しました。ネットワーク状態を確認してから再試行してください。");
        return;
      }
      const p = pricesRes.status === "fulfilled" ? pricesRes.value : [];
      const a = averagesRes.status === "fulfilled" ? averagesRes.value : [];
      const cs = compSetRes.status === "fulfilled" ? compSetRes.value : [];
      const grid = gridRes.status === "fulfilled" ? gridRes.value : [];
      if (propRes.status === "fulfilled") setPropertyName(propRes.value.name);
      setPrices(p);
      setAverages(a);
      setCompSet(cs);
      setOwnGrid(grid);
      if (p.length > 0) {
        setLastUpdated(p[0].scraped_at.slice(0, 16).replace("T", " "));
      }
    } catch {
      setLoadError("予期しないエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }, [propertyId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      await triggerPipeline(propertyId);
      // 進捗カウントダウン
      for (let i = 25; i > 0; i--) {
        setRefreshCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setRefreshCountdown(null);
      await load();
    } catch {
      setLoadError("パイプラインの実行に失敗しました。");
    } finally {
      setRefreshing(false);
      setRefreshCountdown(null);
    }
  };

  // 競合ホテル別サマリー
  const compSummaries = useMemo((): CompSummary[] => {
    const compMap = new Map(compSet.map((c, i) => [c.name, { ...c, color: COMP_COLORS[i % COMP_COLORS.length] }]));
    const grouped: Record<string, CompetitorPriceOut[]> = {};
    for (const p of prices) {
      if (!grouped[p.competitor_name]) grouped[p.competitor_name] = [];
      grouped[p.competitor_name].push(p);
    }
    return Object.entries(grouped).map(([name, rows], i) => {
      const cs = compMap.get(name);
      const priceMap: Record<string, number> = {};
      for (const r of rows) priceMap[r.target_date] = r.price;
      const vals = rows.map(r => r.price);
      return {
        name,
        color: cs?.color ?? COMP_COLORS[i % COMP_COLORS.length],
        todayPrice: priceMap[today] ?? null,
        avgPrice: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
        expediaUrl: cs?.expedia_url ?? null,
        scrapeMode: cs?.scrape_mode ?? "mock",
        prices: priceMap,
      };
    }).sort((a, b) => (b.todayPrice ?? 0) - (a.todayPrice ?? 0));
  }, [prices, compSet, today]);

  // 自社価格マップ
  const ownPriceMap = useMemo(() => buildOwnPriceMap(ownGrid), [ownGrid]);

  // パイプライン実行済みの日付セット
  // 少なくとも1社でも価格データがある日付 = その日付はAPIで検索済み
  // → 他のホテルにデータがない = 満室（楽天APIに返却されなかった）
  const coveredDates = useMemo(() => {
    const covered = new Set<string>();
    for (const c of compSummaries) {
      for (const date of Object.keys(c.prices)) covered.add(date);
    }
    return covered;
  }, [compSummaries]);

  // 表示対象日付（displayDays で絞る）
  const displayCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + displayDays);
    return d.toISOString().slice(0, 10);
  }, [displayDays]);

  const displayAverages = useMemo(
    () => averages.filter(a => a.target_date <= displayCutoff),
    [averages, displayCutoff]
  );

  // チャートデータ（displayDays分）
  const chartData = useMemo(() => {
    return displayAverages.map(avg => {
      const { label, isWeekend } = getDayLabel(avg.target_date);
      const row: Record<string, string | number | boolean> = {
        date: label,
        rawDate: avg.target_date,
        isWeekend,
        競合平均: avg.avg_price,
        自社価格: ownPriceMap[avg.target_date] ?? 0,
      };
      for (const c of compSummaries) {
        row[c.name] = c.prices[avg.target_date] ?? 0;
      }
      return row;
    });
  }, [displayAverages, ownPriceMap, compSummaries]);

  // 本日の競合平均と自社との乖離
  const todayAvg = averages.find(a => a.target_date === today);
  const ownTodayPrice = ownPriceMap[today] ?? 0;
  const gapPct = todayAvg && ownTodayPrice
    ? Math.round(((ownTodayPrice - todayAvg.avg_price) / todayAvg.avg_price) * 100)
    : null;

  // 今日の競合価格マップ（RatingPanelに渡す）- Hooksはconditional returnより前に置く
  const compPriceMapToday = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of compSummaries) {
      if (c.todayPrice != null) map[c.name] = c.todayPrice;
    }
    return map;
  }, [compSummaries]);

  if (loadError && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-slate-600">{loadError}</p>
        <button onClick={() => load()} className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700">
          再試行
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        {/* ヘッダー KPI */}
        <div className="flex gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="yl-card px-4 py-3 min-w-[140px] space-y-1.5">
              <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-2.5 w-32 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* 競合セットバッジ */}
        <div className="yl-card p-4">
          <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse mb-3" />
          <SkeletonCardGrid count={6} cols={3} />
        </div>
        {/* チャート */}
        <SkeletonChart height={280} />
        {/* テーブル */}
        <SkeletonTable rows={6} cols={10} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* サブタブ: 価格 | 評価 */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {(["price", "rating"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              subTab === tab
                ? "border-brand-navy text-brand-navy"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "price" ? "価格モニター" : "評価モニター"}
          </button>
        ))}
      </div>

      {/* 評価タブ */}
      {subTab === "rating" && (
        <RatingPanel
          propertyId={propertyId}
          propertyName={propertyName}
          ownTodayPrice={ownTodayPrice}
          compPriceMap={compPriceMapToday}
        />
      )}

      {/* 価格タブ */}
      {subTab === "price" && <>
      {/* ヘッダー：KPI + 更新ボタン */}
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          {/* 競合平均 */}
          {todayAvg && (
            <div className="yl-card px-4 py-3 min-w-[140px]">
              <p className="text-xs text-slate-400 mb-1">競合平均（本日）</p>
              <p className="text-xl font-bold text-slate-800">{formatPrice(Math.round(todayAvg.avg_price))}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {formatPrice(todayAvg.min_price)} 〜 {formatPrice(todayAvg.max_price)}
              </p>
            </div>
          )}
          {/* 自社との乖離 */}
          {gapPct !== null && (
            <div className="yl-card px-4 py-3 min-w-[140px]">
              <p className="text-xs text-slate-400 mb-1">自社 vs 競合平均</p>
              <div className="flex items-center gap-1.5">
                {gapPct > 0
                  ? <TrendingUp className="w-4 h-4 text-green-500" />
                  : gapPct < 0
                    ? <TrendingDown className="w-4 h-4 text-red-500" />
                    : <Minus className="w-4 h-4 text-slate-400" />
                }
                <p className={`text-xl font-bold ${gapPct > 0 ? "text-green-600" : gapPct < 0 ? "text-red-600" : "text-slate-600"}`}>
                  {gapPct > 0 ? "+" : ""}{gapPct}%
                </p>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                自社 {formatPrice(ownTodayPrice)}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {lastUpdated && (
            <span className="text-[11px] text-slate-400">最終更新: {lastUpdated}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshCountdown != null ? `更新中... ${refreshCountdown}秒` : refreshing ? "起動中..." : "データ更新"}
          </button>
        </div>
      </div>

      {/* 競合ホテル一覧バッジ */}
      <div className="yl-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">競合セット（{compSummaries.length}社）</h3>
          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
            Settings から変更可能
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {compSummaries.map((c) => (
            <div key={c.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <div className="min-w-0">
                  <span className="text-xs font-medium text-slate-700 truncate block">{c.name}</span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                    c.scrapeMode === "rakuten"
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : c.scrapeMode === "live"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "bg-slate-100 text-slate-400"
                  }`}>
                    {c.scrapeMode === "rakuten" ? "楽天LIVE" : c.scrapeMode === "live" ? "Expedia LIVE" : "mock"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {c.todayPrice ? (
                  <span className="text-xs font-bold text-slate-800">{formatPrice(c.todayPrice)}</span>
                ) : coveredDates.has(today) ? (
                  <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">満室</span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
                {c.expediaUrl && (
                  <a href={c.expediaUrl} target="_blank" rel="noopener noreferrer"
                    className="text-slate-400 hover:text-brand-navy transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 価格推移チャート */}
      <div className="yl-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">価格推移比較（{displayDays}日間）</h3>
            <p className="text-xs text-slate-400 mt-0.5">自社と競合{compSummaries.length}社の掲載価格トレンド（楽天トラベル実データ）</p>
          </div>
          {/* 期間セレクター */}
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setDisplayDays(opt.days as 14 | 30 | 90)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  displayDays === opt.days
                    ? "bg-white text-brand-navy font-semibold shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                interval={displayDays === 14 ? 1 : displayDays === 30 ? 2 : 6}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                tickFormatter={(v) => v >= 1000 ? `¥${Math.round(v / 1000)}K` : `¥${v}`}
                width={55}
              />
              <Tooltip
                formatter={(v: number | undefined, name: string | undefined) => [v != null ? formatPrice(v) : "—", name ?? ""]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }}
              />
              <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
              {/* 自社価格 */}
              <Line
                type="monotone"
                dataKey="自社価格"
                stroke={OWN_COLOR}
                strokeWidth={2.5}
                dot={false}
                strokeDasharray="0"
              />
              {/* 競合各社 */}
              {compSummaries.map((c) => (
                <Line
                  key={c.name}
                  type="monotone"
                  dataKey={c.name}
                  stroke={c.color}
                  strokeWidth={1.5}
                  dot={false}
                  strokeOpacity={0.8}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-sm">データがありません。パイプラインを実行してください。</span>
          </div>
        )}
      </div>

      {/* 価格テーブル（日別） */}
      <div className="yl-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">日別価格モニタリング</h3>
            <p className="text-xs text-slate-400">自社と競合{compSummaries.length}社の掲載価格（{displayDays}日間・楽天トラベル最安値）</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium sticky left-0 bg-slate-50 min-w-[160px] z-10">
                  ホテル
                </th>
                {displayAverages.map(avg => {
                  const { label, isWeekend } = getDayLabel(avg.target_date);
                  return (
                    <th
                      key={avg.target_date}
                      className={`px-3 py-2.5 text-center font-medium min-w-[80px] ${
                        avg.target_date === today
                          ? "text-brand-navy bg-blue-50"
                          : isWeekend
                            ? "text-red-500"
                            : "text-slate-500"
                      }`}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* 自社行 */}
              <tr className="border-b border-slate-50 bg-blue-50/30">
                <td className="px-4 py-2.5 sticky left-0 bg-blue-50/50 z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: OWN_COLOR }} />
                    <span className="font-semibold text-brand-navy">自社（{propertyName}）</span>
                  </div>
                </td>
                {displayAverages.map(avg => {
                  const own = ownPriceMap[avg.target_date];
                  return (
                    <td key={avg.target_date} className={`px-3 py-2.5 text-center ${avg.target_date === today ? "bg-blue-50/50" : ""}`}>
                      {own ? (
                        <div className="font-bold text-brand-navy">
                          {formatPrice(own)}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              {/* 競合各社 */}
              {compSummaries.map((c) => (
                <tr key={c.name} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      <span className="font-medium text-slate-700">{c.name}</span>
                    </div>
                  </td>
                  {displayAverages.map(avg => {
                    const p = c.prices[avg.target_date];
                    const own = ownPriceMap[avg.target_date];
                    const isLower = own && p && p < own;
                    const isSoldOut = !p && coveredDates.has(avg.target_date);
                    return (
                      <td key={avg.target_date} className={`px-3 py-2.5 text-center ${avg.target_date === today ? "bg-blue-50/30" : ""}`}>
                        {p ? (
                          <span className={`font-medium ${isLower ? "text-green-600" : "text-slate-600"}`}>
                            {formatPrice(p)}
                          </span>
                        ) : isSoldOut ? (
                          <span className="inline-block text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                            満室
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* 競合平均行 */}
              <tr className="border-t border-slate-200 bg-amber-50/20">
                <td className="px-4 py-2.5 sticky left-0 bg-amber-50/30 z-10">
                  <span className="font-semibold text-amber-700 text-xs">競合平均</span>
                </td>
                {displayAverages.map(avg => (
                  <td key={avg.target_date} className={`px-3 py-2.5 text-center ${avg.target_date === today ? "bg-blue-50/30" : ""}`}>
                    <div className="font-medium text-amber-700">{formatPrice(Math.round(avg.avg_price))}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-slate-100">
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-navy inline-block" />自社（{propertyName}）
            </span>
            <span>緑色の競合価格 = 自社より低い（要注意）</span>
            <span className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 px-1 rounded">満室</span>
              = 楽天トラベルに空室なし（当日API取得時点）
            </span>
            <span>— = データ未取得</span>
          </div>
        </div>
      </div>

      {/* スクレイプモード表示 */}
      <div className="yl-card px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-slate-600">
              データ取得モード：現在は <strong>モック（価格カタログ）</strong> で動作中。
              Settings &gt; 競合セット管理 で各ホテルの「スクレイプモード」を
              <strong className="text-green-600"> live</strong> に変更すると実 Expedia データを取得します。
            </span>
          </div>
        </div>
      </div>
      </> /* end price tab */}
    </div>
  );
}
