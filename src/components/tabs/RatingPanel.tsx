"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import { RefreshCw, Star, Users } from "lucide-react";
import {
  fetchCompetitorRatings,
  refreshCompetitorRatings,
  type CompetitorRatingOut,
} from "@/lib/api";
import { Skeleton } from "@/components/shared/Skeleton";

const SOURCE_CONFIG = {
  rakuten:     { label: "楽天トラベル", color: "#BF0000",  bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700" },
  google:      { label: "Google",       color: "#4285F4",  bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700" },
  tripadvisor: { label: "TripAdvisor",  color: "#00AF87",  bg: "bg-emerald-50",border: "border-emerald-200",text: "text-emerald-700" },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  service:   "サービス",
  location:  "立地",
  room:      "部屋",
  equipment: "設備",
  bath:      "風呂",
  meal:      "食事",
};

const OWN_COLOR   = "#1E3A8A";
const COMP_COLORS = ["#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

interface Props {
  propertyId: number;
  propertyName: string;
  /** 今日の自社価格（散布図のX軸に使用） */
  ownTodayPrice: number;
  /** 競合ホテルの今日の価格マップ name→price */
  compPriceMap: Record<string, number>;
}

function StarBar({ score, max = 5 }: { score: number | null; max?: number }) {
  if (score == null) return <span className="text-xs text-slate-300">—</span>;
  const pct = (score / max) * 100;
  const color = score >= 4.5 ? "#10B981" : score >= 4.0 ? "#3B82F6" : score >= 3.5 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 tabular-nums w-7 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function ScoreCircle({ score, source }: { score: number | null; source: keyof typeof SOURCE_CONFIG }) {
  const cfg = SOURCE_CONFIG[source];
  if (score == null) return (
    <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
      <span className="text-[10px] text-slate-300">未連携</span>
    </div>
  );
  return (
    <div
      className="w-14 h-14 rounded-full flex flex-col items-center justify-center border-2"
      style={{ borderColor: cfg.color, background: `${cfg.color}10` }}
    >
      <span className="text-base font-bold leading-none" style={{ color: cfg.color }}>{score.toFixed(1)}</span>
      <Star className="w-2.5 h-2.5 mt-0.5" style={{ color: cfg.color }} />
    </div>
  );
}

/** 散布図カスタムツールチップ */
function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-800 mb-1">{d.name}</p>
      <p className="text-slate-500">評価: <span className="font-bold text-slate-800">{d.rating?.toFixed(1) ?? "—"}</span></p>
      <p className="text-slate-500">価格: <span className="font-bold text-slate-800">¥{d.price?.toLocaleString() ?? "—"}</span></p>
      {d.reviewCount != null && (
        <p className="text-slate-500">口コミ: <span className="font-medium">{d.reviewCount.toLocaleString()}件</span></p>
      )}
    </div>
  );
}

interface ScatterPoint {
  name: string;
  price: number;
  rating: number;
  reviewCount: number | null;
  isOwn: boolean;
  color: string;
}

/** 4象限ラベル（簡易） */
function QuadrantLabel({ x, y, label, color }: { x: string; y: string; label: string; color: string }) {
  return (
    <div className={`absolute text-[9px] font-medium px-1.5 py-0.5 rounded ${x === "left" ? "left-10" : "right-3"} ${y === "top" ? "top-2" : "bottom-2"}`}
      style={{ color, background: `${color}18` }}>
      {label}
    </div>
  );
}

export function RatingPanel({ propertyId, propertyName, ownTodayPrice, compPriceMap }: Props) {
  const [ratings, setRatings] = useState<CompetitorRatingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchCompetitorRatings(propertyId);
      setRatings(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCompetitorRatings(propertyId);
      // 楽天APIは非同期バックグラウンド実行なので数秒待ってから再取得
      await new Promise(r => setTimeout(r, 8000));
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  // ホテル名→最新楽天評価マップ
  const rakutenByHotel = useMemo(() => {
    const map = new Map<string, CompetitorRatingOut>();
    for (const r of ratings) {
      if (r.source === "rakuten") map.set(r.hotel_name, r);
    }
    return map;
  }, [ratings]);

  // 全ホテル（重複除去）
  const allHotels = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const r of ratings) {
      if (!seen.has(r.hotel_name)) {
        seen.add(r.hotel_name);
        names.push(r.hotel_name);
      }
    }
    return names;
  }, [ratings]);

  // レーダーチャートデータ（楽天評価のみ、自社vs競合平均）
  const radarData = useMemo(() => {
    const keys: Array<keyof CompetitorRatingOut["categories"]> = [
      "service", "location", "room", "equipment", "bath", "meal",
    ];
    // 競合平均
    const compRatings = Array.from(rakutenByHotel.values());
    return keys.map((k) => {
      const vals = compRatings.map(r => r.categories[k]).filter((v): v is number => v != null);
      const avg = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
      return {
        category: CATEGORY_LABELS[k],
        競合平均: avg,
      };
    });
  }, [rakutenByHotel]);

  // 散布図データ（価格×評価）
  const scatterData = useMemo((): ScatterPoint[] => {
    const points: ScatterPoint[] = [];
    // 競合
    allHotels.forEach((name, i) => {
      const rating = rakutenByHotel.get(name);
      const price = compPriceMap[name];
      if (rating?.overall != null && price) {
        points.push({
          name,
          price,
          rating: rating.overall,
          reviewCount: rating.review_count,
          isOwn: false,
          color: COMP_COLORS[i % COMP_COLORS.length],
        });
      }
    });
    return points;
  }, [allHotels, rakutenByHotel, compPriceMap]);

  // 自社の楽天評価（CompetitorRatingsには自社も含めるため、propertyNameで検索）
  const ownRating = useMemo(() =>
    Array.from(rakutenByHotel.values()).find(r => r.hotel_name === propertyName) ?? null,
    [rakutenByHotel, propertyName]
  );

  const ownScatterPoint: ScatterPoint | null = useMemo(() => {
    if (!ownRating?.overall || !ownTodayPrice) return null;
    return { name: propertyName, price: ownTodayPrice, rating: ownRating.overall, reviewCount: ownRating.review_count, isOwn: true, color: OWN_COLOR };
  }, [ownRating, ownTodayPrice, propertyName]);

  // 中央値（散布図の四象限境界線用）
  const avgPrice = scatterData.length
    ? Math.round(scatterData.reduce((a, b) => a + b.price, 0) / scatterData.length)
    : null;
  const avgRating = scatterData.length
    ? +(scatterData.reduce((a, b) => a + b.rating, 0) / scatterData.length).toFixed(2)
    : null;

  const lastFetched = ratings.length > 0
    ? new Date(ratings[0].fetched_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300 pt-4">
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="yl-card p-4 flex items-start gap-4">
              <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="space-y-1">
                      <Skeleton className="h-2.5 w-12" />
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (ratings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
          <Star className="w-7 h-7 text-slate-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">評価データがまだありません</p>
          <p className="text-xs text-slate-400 mt-1">データを取得するには「評価データ更新」を実行してください</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E3A8A] text-white text-sm rounded-lg hover:bg-[#1e3070] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "取得中（約8秒）..." : "評価データを取得する"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pt-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">競合ホテル評価モニター</h3>
          {lastFetched && (
            <p className="text-[11px] text-slate-400 mt-0.5">最終取得: {lastFetched}</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "取得中..." : "評価データ更新"}
        </button>
      </div>

      {/* ZONE A: ソース別評価カード */}
      <div className="space-y-2.5">
        {allHotels.map((hotelName, i) => {
          const rakuten = ratings.find(r => r.hotel_name === hotelName && r.source === "rakuten");
          const google  = ratings.find(r => r.hotel_name === hotelName && r.source === "google");
          const ta      = ratings.find(r => r.hotel_name === hotelName && r.source === "tripadvisor");
          const color   = COMP_COLORS[i % COMP_COLORS.length];
          const overall = rakuten?.overall ?? null;
          return (
            <div key={hotelName} className="yl-card p-4">
              <div className="flex items-start gap-4">
                {/* カラードット + ホテル名 */}
                <div className="flex-shrink-0 pt-1 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-slate-800 truncate">{hotelName}</span>
                    {rakuten?.review_count != null && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                        <Users className="w-3 h-3" />
                        {rakuten.review_count.toLocaleString()}件
                      </span>
                    )}
                  </div>

                  {/* ソース別スコアバッジ列 */}
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    {(["rakuten", "google", "tripadvisor"] as const).map((src) => {
                      const r = src === "rakuten" ? rakuten : src === "google" ? google : ta;
                      const cfg = SOURCE_CONFIG[src];
                      return (
                        <div key={src} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${r ? cfg.border + " " + cfg.bg : "border-slate-100 bg-slate-50"}`}>
                          <span className={`text-[10px] font-medium ${r ? cfg.text : "text-slate-300"}`}>{cfg.label}</span>
                          {r?.overall != null ? (
                            <span className={`text-xs font-bold ${cfg.text}`}>★{r.overall.toFixed(1)}</span>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 楽天カテゴリ別バー（6項目） */}
                  {rakuten && (
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                      {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((k) => (
                        <div key={k}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-slate-500">{CATEGORY_LABELS[k]}</span>
                          </div>
                          <StarBar score={rakuten.categories[k as keyof typeof rakuten.categories]} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 総合スコアサークル */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <ScoreCircle score={overall} source="rakuten" />
                  {overall != null && (
                    <div className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      overall >= 4.5 ? "text-green-700 bg-green-50" :
                      overall >= 4.0 ? "text-blue-700 bg-blue-50" :
                      overall >= 3.5 ? "text-yellow-700 bg-yellow-50" : "text-red-700 bg-red-50"
                    }`}>
                      {overall >= 4.5 ? "優秀" : overall >= 4.0 ? "良好" : overall >= 3.5 ? "普通" : "要注意"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ZONE B + C: レーダー + 散布図 */}
      <div className="flex gap-4">
        {/* ZONE B: レーダーチャート */}
        <div className="yl-card p-5 flex-1">
          <h4 className="text-xs font-semibold text-slate-700 mb-4">評価カテゴリ比較（競合平均）</h4>
          {radarData.some(d => d.競合平均 != null) ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "#64748b" }} />
                <PolarRadiusAxis angle={30} domain={[3, 5]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={3} />
                <Radar
                  name="競合平均"
                  dataKey="競合平均"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number | undefined) => v != null ? v.toFixed(2) : "—"}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">
              カテゴリデータがありません
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-2 text-center">楽天トラベル評価ベース</p>
        </div>

        {/* ZONE C: 価格×評価 散布図 */}
        <div className="yl-card p-5 flex-1">
          <div className="flex items-start justify-between mb-1">
            <h4 className="text-xs font-semibold text-slate-700">価格 × 評価 ポジショニング</h4>
          </div>
          <p className="text-[10px] text-slate-400 mb-4">高評価＆高価格がプレミアムポジション</p>

          {scatterData.length > 0 || ownScatterPoint ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    dataKey="price"
                    name="価格"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                    label={{ value: "価格（円）", position: "insideBottom", offset: -10, fontSize: 10, fill: "#94a3b8" }}
                  />
                  <YAxis
                    type="number"
                    dataKey="rating"
                    name="評価"
                    domain={[3.0, 5.0]}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v.toFixed(1)}
                    label={{ value: "楽天評価", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }}
                  />
                  <Tooltip content={<ScatterTooltip />} />
                  {/* 四象限境界線 */}
                  {avgPrice && <ReferenceLine x={avgPrice} stroke="#e2e8f0" strokeDasharray="4 2" />}
                  {avgRating && <ReferenceLine y={avgRating} stroke="#e2e8f0" strokeDasharray="4 2" />}
                  {/* 競合各社（個別色） */}
                  {scatterData.map((d) => (
                    <Scatter
                      key={d.name}
                      name={d.name}
                      data={[d]}
                      fill={d.color}
                      fillOpacity={0.8}
                    />
                  ))}
                  {/* 自社 */}
                  {ownScatterPoint && (
                    <Scatter
                      name={propertyName}
                      data={[ownScatterPoint]}
                      fill={OWN_COLOR}
                      shape={(props) => {
                        const { cx, cy } = props as { cx: number; cy: number };
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={10} fill={OWN_COLOR} fillOpacity={0.9} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">自社</text>
                          </g>
                        );
                      }}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
              {/* 四象限ラベル */}
              {avgPrice && avgRating && (
                <div className="absolute inset-0 pointer-events-none" style={{ top: 10, bottom: 30, left: 10, right: 20 }}>
                  <QuadrantLabel x="right" y="top"   label="プレミアム" color="#10B981" />
                  <QuadrantLabel x="left"  y="top"   label="割安感あり" color="#3B82F6" />
                  <QuadrantLabel x="right" y="bottom" label="価格過大"   color="#EF4444" />
                  <QuadrantLabel x="left"  y="bottom" label="ローコスト" color="#F59E0B" />
                </div>
              )}
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">
              価格と評価の両方があるホテルがありません
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-2 text-center">楽天評価 × 楽天今日の最安値</p>
        </div>
      </div>

      {/* 未連携ソースの案内 */}
      <div className="yl-card p-4 bg-slate-50 border-dashed">
        <p className="text-xs font-medium text-slate-600 mb-2">評価ソースの拡張</p>
        <div className="flex gap-2 flex-wrap">
          {(["google", "tripadvisor"] as const).map((src) => {
            const cfg = SOURCE_CONFIG[src];
            const hasData = ratings.some(r => r.source === src);
            return (
              <div key={src} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${hasData ? `${cfg.bg} ${cfg.border} ${cfg.text}` : "bg-white border-slate-200 text-slate-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasData ? "bg-current" : "bg-slate-300"}`} />
                {cfg.label}
                <span className={`ml-1 text-[10px] ${hasData ? "opacity-70" : "text-slate-300"}`}>
                  {hasData ? "連携済み" : "Phase 2 予定"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
