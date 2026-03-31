"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import {
  RefreshCw, Star, Users, ExternalLink, MessageSquare,
  TrendingUp, Minus, AlertTriangle, Quote, Calendar, Building2,
} from "lucide-react";
import {
  fetchCompetitorRatings,
  refreshCompetitorRatings,
  type CompetitorRatingOut,
} from "@/lib/api";
import { Skeleton } from "@/components/shared/Skeleton";

/* ─────────────────── 定数 ─────────────────── */

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
const COMP_COLORS = ["#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

/* ─────────────────── 価格感度エンジン ─────────────────── */

const PRICE_KEYWORDS = {
  positive: [
    "お得", "おとく", "リーズナブル", "安い", "お安", "コスパ良",
    "コスパが良", "コスパがいい", "コスパよ", "コスト良", "割安", "手頃",
    "値打ち", "値ごろ", "良心的", "価格以上", "満足できる価格", "納得の価格",
  ],
  negative: [
    "高い", "高すぎ", "割高", "コスパ悪", "コスパが悪", "コスパは悪",
    "高額", "お高", "値段が高", "料金が高", "価格が高", "ちょっと高",
    "少し高", "やや高", "高すぎ", "不満な価格", "もう少し安", "値段の割に",
  ],
  neutral: [
    "価格", "料金", "値段", "費用", "コスト", "宿泊費", "宿泊代", "室料",
    "プライス", "金額", "代金",
  ],
} as const;

type PriceSentiment = "positive" | "negative" | "neutral_mention" | "none";

interface PriceSignal {
  sentiment: PriceSentiment;
  matchedKeywords: string[];
  highlightedText: Array<{ text: string; highlight: "positive" | "negative" | "neutral" | null }>;
}

function analyzePriceSentiment(text: string | null): PriceSignal {
  if (!text) return { sentiment: "none", matchedKeywords: [], highlightedText: [] };

  const lower = text.toLowerCase();
  const positiveMatches = PRICE_KEYWORDS.positive.filter(k => lower.includes(k.toLowerCase()));
  const negativeMatches = PRICE_KEYWORDS.negative.filter(k => lower.includes(k.toLowerCase()));
  const neutralMatches  = PRICE_KEYWORDS.neutral.filter(k => lower.includes(k.toLowerCase()));

  let sentiment: PriceSentiment = "none";
  if (positiveMatches.length > 0 || negativeMatches.length > 0) {
    sentiment = positiveMatches.length >= negativeMatches.length && positiveMatches.length > 0
      ? "positive"
      : "negative";
  } else if (neutralMatches.length > 0) {
    sentiment = "neutral_mention";
  }

  const allKeywords: Array<{ keyword: string; type: "positive" | "negative" | "neutral" }> = [
    ...negativeMatches.map(k => ({ keyword: k, type: "negative" as const })),
    ...positiveMatches.map(k => ({ keyword: k, type: "positive" as const })),
    ...neutralMatches.map(k => ({ keyword: k, type: "neutral" as const })),
  ].sort((a, b) => b.keyword.length - a.keyword.length);

  let segments: PriceSignal["highlightedText"] = [{ text, highlight: null }];

  for (const { keyword, type } of allKeywords) {
    const newSegments: typeof segments = [];
    for (const seg of segments) {
      if (seg.highlight !== null) { newSegments.push(seg); continue; }
      const idx = seg.text.toLowerCase().indexOf(keyword.toLowerCase());
      if (idx === -1) { newSegments.push(seg); continue; }
      if (idx > 0) newSegments.push({ text: seg.text.slice(0, idx), highlight: null });
      newSegments.push({ text: seg.text.slice(idx, idx + keyword.length), highlight: type });
      if (idx + keyword.length < seg.text.length)
        newSegments.push({ text: seg.text.slice(idx + keyword.length), highlight: null });
    }
    segments = newSegments;
  }

  return { sentiment, matchedKeywords: [...negativeMatches, ...positiveMatches], highlightedText: segments };
}

/* ─────────────────── サブコンポーネント ─────────────────── */

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

function PriceSentimentBadge({ signal }: { signal: PriceSignal }) {
  if (signal.sentiment === "none") return null;
  const config = {
    positive:        { icon: <TrendingUp className="w-3 h-3" />, label: "コスパ評価あり", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    negative:        { icon: <AlertTriangle className="w-3 h-3" />, label: "割高感の声あり", cls: "text-red-700 bg-red-50 border-red-200" },
    neutral_mention: { icon: <Minus className="w-3 h-3" />, label: "価格への言及あり", cls: "text-slate-600 bg-slate-100 border-slate-200" },
  };
  const c = config[signal.sentiment as keyof typeof config];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

function HighlightedReview({ segments }: { segments: PriceSignal["highlightedText"] }) {
  return (
    <span>
      {segments.map((seg, i) => {
        if (!seg.highlight) return <span key={i}>{seg.text}</span>;
        const cls =
          seg.highlight === "positive" ? "bg-emerald-100 text-emerald-800 rounded px-0.5" :
          seg.highlight === "negative" ? "bg-red-100 text-red-800 rounded px-0.5" :
          "bg-amber-50 text-amber-800 rounded px-0.5";
        return <mark key={i} className={`not-italic font-medium ${cls}`}>{seg.text}</mark>;
      })}
    </span>
  );
}

/** レビューカード（1レビュー = 1カード） */
function ReviewCard({
  rating,
  signal,
  hotelColor,
  isOwn,
}: {
  rating: CompetitorRatingOut;
  signal: PriceSignal;
  hotelColor: string;
  isOwn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!rating.user_review) return null;

  const displayDate = rating.review_date
    ? rating.review_date.split(" ")[0]
    : null;
  const previewLen = 120;
  const isLong = rating.user_review.length > previewLen;

  return (
    <div className={`rounded-xl border p-4 bg-white shadow-sm transition-all duration-200 ${isOwn ? "border-brand-navy/30 bg-blue-50/30" : "border-slate-100"}`}>
      {/* ヘッダー行 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* ホテル色ドット */}
          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ background: hotelColor }} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-800 truncate">
                {isOwn ? `${rating.hotel_name}（自社）` : rating.hotel_name}
              </span>
              {isOwn && <Building2 className="w-3 h-3 text-brand-navy" />}
            </div>
            {/* ソースバッジ + 日付 */}
            <div className="flex items-center gap-2 mt-0.5">
              {(() => {
                const src = SOURCE_CONFIG[rating.source as keyof typeof SOURCE_CONFIG] ?? SOURCE_CONFIG.rakuten;
                return (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${src.text} ${src.bg} border ${src.border} px-1.5 py-0.5 rounded`}>
                    {src.label}
                  </span>
                );
              })()}
              {displayDate && (
                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                  <Calendar className="w-2.5 h-2.5" />
                  {displayDate}投稿
                </span>
              )}
            </div>
          </div>
        </div>

        {/* スコアバッジ */}
        {rating.overall != null && (
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 text-sm font-bold"
            style={{ borderColor: isOwn ? OWN_COLOR : "#BF0000", color: isOwn ? OWN_COLOR : "#BF0000", background: isOwn ? "#EFF6FF" : "#FFF5F5" }}
          >
            {rating.overall.toFixed(1)}
            <Star className="w-2.5 h-2.5 mt-0.5" />
          </div>
        )}
      </div>

      {/* 口コミ本文 */}
      <div className="relative">
        <Quote className="w-5 h-5 text-slate-200 absolute -top-1 -left-0.5" />
        <p className="text-xs leading-relaxed text-slate-700 pl-5 pr-1">
          {signal.highlightedText.length > 0 ? (
            expanded
              ? <HighlightedReview segments={signal.highlightedText} />
              : <HighlightedReview segments={[{ text: rating.user_review.slice(0, previewLen) + (isLong ? "…" : ""), highlight: null }]} />
          ) : (
            expanded ? rating.user_review : rating.user_review.slice(0, previewLen) + (isLong ? "…" : "")
          )}
        </p>
      </div>

      {/* フッター */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-50">
        <div className="flex items-center gap-2">
          {signal.matchedKeywords.length > 0 && (
            <PriceSentimentBadge signal={signal} />
          )}
        </div>
        <div className="flex items-center gap-3">
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
            >
              {expanded ? "閉じる ▲" : "続きを読む ▼"}
            </button>
          )}
          {rating.review_url && (
            <a
              href={rating.review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-[#BF0000] hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              すべてのレビュー
            </a>
          )}
        </div>
      </div>
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

interface ScatterPoint { name: string; price: number; rating: number; reviewCount: number | null; isOwn: boolean; color: string; }

/* ─────────────────── メインコンポーネント ─────────────────── */

interface Props {
  propertyId: number;
  propertyName: string;
  ownTodayPrice: number;
  compPriceMap: Record<string, number>;
}

export function RatingPanel({ propertyId, propertyName, ownTodayPrice, compPriceMap }: Props) {
  const [ratings, setRatings] = useState<CompetitorRatingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    setLoadError(null);
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchCompetitorRatings(propertyId);
      setRatings(data);
    } catch {
      setLoadError("評価データの取得に失敗しました。");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      await refreshCompetitorRatings(propertyId);
      for (let i = 12; i > 0; i--) {
        setRefreshCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setRefreshCountdown(null);
      await load(true);
    } catch {
      setLoadError("評価データの取得に失敗しました。");
    } finally {
      setRefreshing(false);
      setRefreshCountdown(null);
    }
  };

  /* ── 全ソース × ホテル名 のインデックス ─── */
  const ratingsByHotelAndSource = useMemo(() => {
    const map = new Map<string, Map<string, CompetitorRatingOut>>();
    for (const r of ratings) {
      if (!map.has(r.hotel_name)) map.set(r.hotel_name, new Map());
      map.get(r.hotel_name)!.set(r.source, r);
    }
    return map;
  }, [ratings]);

  /* ── 自社 ─────────── */
  const ownRating = useMemo(
    () => ratings.find(r => r.source === "rakuten" && r.is_own_property) ?? null,
    [ratings]
  );

  /* ── 競合のみ（楽天ベース） ────── */
  const rakutenByHotel = useMemo(() => {
    const map = new Map<string, CompetitorRatingOut>();
    for (const r of ratings) {
      if (r.source === "rakuten" && !r.is_own_property) map.set(r.hotel_name, r);
    }
    return map;
  }, [ratings]);

  const compHotels = useMemo(() => Array.from(rakutenByHotel.keys()), [rakutenByHotel]);

  /* ── 価格感度シグナル ─ */
  const priceSignals = useMemo(() => {
    const map = new Map<string, PriceSignal>();
    for (const [name, r] of Array.from(rakutenByHotel.entries())) {
      map.set(name, analyzePriceSentiment(r.user_review));
    }
    if (ownRating) {
      map.set(ownRating.hotel_name, analyzePriceSentiment(ownRating.user_review));
    }
    return map;
  }, [rakutenByHotel, ownRating]);

  const negativeCount = useMemo(() =>
    Array.from(priceSignals.values()).filter(s => s.sentiment === "negative").length, [priceSignals]);
  const positiveCount = useMemo(() =>
    Array.from(priceSignals.values()).filter(s => s.sentiment === "positive").length, [priceSignals]);

  /* ── レーダーデータ（自社 + 競合平均） ─── */
  const radarData = useMemo(() => {
    const keys = ["service", "location", "room", "equipment", "bath", "meal"] as const;
    const compVals = Array.from(rakutenByHotel.values());
    return keys.map((k) => {
      const vals = compVals.map(r => r.categories[k]).filter((v): v is number => v != null);
      const avg = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : undefined;
      const ownScore = ownRating?.categories[k] ?? undefined;
      return { category: CATEGORY_LABELS[k], 競合平均: avg, ...(ownScore != null ? { 自社: ownScore } : {}) };
    });
  }, [rakutenByHotel, ownRating]);

  const hasOwnRadarData = useMemo(
    () => radarData.some(d => (d as Record<string, unknown>)["自社"] != null),
    [radarData]
  );

  /* ── 散布図データ ─── */
  const scatterData = useMemo((): ScatterPoint[] => {
    return compHotels.flatMap((name, i) => {
      const r = rakutenByHotel.get(name);
      const price = compPriceMap[name];
      if (r?.overall != null && price) {
        return [{ name, price, rating: r.overall, reviewCount: r.review_count, isOwn: false, color: COMP_COLORS[i % COMP_COLORS.length] }];
      }
      return [];
    });
  }, [compHotels, rakutenByHotel, compPriceMap]);

  const ownScatterPoint: ScatterPoint | null = useMemo(() => {
    const price = ownTodayPrice || compPriceMap[propertyName];
    if (!ownRating?.overall || !price) return null;
    return { name: propertyName, price, rating: ownRating.overall, reviewCount: ownRating.review_count, isOwn: true, color: OWN_COLOR };
  }, [ownRating, ownTodayPrice, propertyName, compPriceMap]);

  const allScatterPoints = useMemo(() => [
    ...scatterData,
    ...(ownScatterPoint ? [ownScatterPoint] : []),
  ], [scatterData, ownScatterPoint]);

  const avgPrice  = allScatterPoints.length ? Math.round(allScatterPoints.reduce((a, b) => a + b.price, 0) / allScatterPoints.length) : null;
  const avgRating = allScatterPoints.length ? +(allScatterPoints.reduce((a, b) => a + b.rating, 0) / allScatterPoints.length).toFixed(2) : null;

  /* ── 全ソースのレビューリスト（自社を先頭に、ホテル名+ソースで色付け） ─── */
  const reviewRatings = useMemo(() => {
    const list: Array<{ rating: CompetitorRatingOut; color: string; isOwn: boolean }> = [];

    // 自社（楽天優先）
    const ownAll = ratings.filter(r => r.is_own_property && r.user_review);
    ownAll.forEach(r => list.push({ rating: r, color: OWN_COLOR, isOwn: true }));

    // 競合（全ソース）: ホテル名でグループ化して色を統一
    const hotelColorMap = new Map<string, string>();
    compHotels.forEach((name, i) => hotelColorMap.set(name, COMP_COLORS[i % COMP_COLORS.length]));

    const compReviews = ratings.filter(r => !r.is_own_property && r.user_review);
    // ホテル名 → ソース順にソート（楽天 → Google → TripAdvisor）
    const sourceOrder = ["rakuten", "google", "tripadvisor"];
    compReviews.sort((a, b) => {
      const hi = (compHotels.indexOf(a.hotel_name) ?? 99) - (compHotels.indexOf(b.hotel_name) ?? 99);
      if (hi !== 0) return hi;
      return sourceOrder.indexOf(a.source) - sourceOrder.indexOf(b.source);
    });
    compReviews.forEach(r => {
      const color = hotelColorMap.get(r.hotel_name) ?? COMP_COLORS[0];
      list.push({ rating: r, color, isOwn: false });
    });

    return list;
  }, [compHotels, ratings]);

  const lastFetched = ratings.length > 0
    ? new Date(ratings[0].fetched_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  /* ── エラー ─── */
  if (loadError && !loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-slate-600">{loadError}</p>
        <button onClick={() => load()} className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700">
          再試行
        </button>
      </div>
    );
  }

  /* ── ローディング ─── */
  if (loading) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300 pt-4">
        {[...Array(3)].map((_, i) => (
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
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        ))}
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
          <p className="text-xs text-slate-400 mt-1">「評価データを取得する」を押してください</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-brand-navy text-white text-sm rounded-lg hover:bg-brand-navy/90 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshCountdown != null ? (String(refreshCountdown) + "秒") : refreshing ? "起動中..." : "評価データを取得する"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pt-4">

      {/* ─── ヘッダー ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">競合ホテル評価モニター</h3>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {lastFetched && <span className="text-[11px] text-slate-400">取得: {lastFetched}</span>}
            {negativeCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />割高感の声 {negativeCount}社
              </span>
            )}
            {positiveCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />コスパ評価 {positiveCount}社
              </span>
            )}
            {!ownRating && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <Building2 className="w-3 h-3" />
                自社: 設定で楽天ホテル番号を入力すると比較に追加されます
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshCountdown != null ? (String(refreshCountdown) + "秒") : refreshing ? "起動中..." : "更新"}
        </button>
      </div>

      {/* ─── ZONE A: 評価カード一覧 ─── */}
      <div className="space-y-3">
        {/* 自社を先頭に表示 */}
        {ownRating && (
          <div className="yl-card p-4 border-brand-navy/20 bg-blue-50/20">
            <HotelRatingCard
              hotelName={`${ownRating.hotel_name}（自社）`}
              color={OWN_COLOR}
              rakuten={ownRating}
              google={ratings.find(r => r.is_own_property && r.source === "google")}
              ta={ratings.find(r => r.is_own_property && r.source === "tripadvisor")}
              isOwn
              signal={priceSignals.get(ownRating.hotel_name) ?? { sentiment: "none", matchedKeywords: [], highlightedText: [] }}
            />
          </div>
        )}
        {compHotels.map((hotelName, i) => {
          const srcMap = ratingsByHotelAndSource.get(hotelName);
          const rakuten = srcMap?.get("rakuten");
          const google  = srcMap?.get("google");
          const ta      = srcMap?.get("tripadvisor");
          const color   = COMP_COLORS[i % COMP_COLORS.length];
          const signal  = priceSignals.get(hotelName) ?? { sentiment: "none" as const, matchedKeywords: [], highlightedText: [] };

          return (
            <div key={hotelName} className="yl-card p-4">
              <HotelRatingCard hotelName={hotelName} color={color} rakuten={rakuten} google={google} ta={ta} isOwn={false} signal={signal} />
            </div>
          );
        })}
      </div>

      {/* ─── ZONE B: レーダー + 散布図 ─── */}
      <div className="flex gap-4">
        <div className="yl-card p-5 flex-1">
          <h4 className="text-xs font-semibold text-slate-700 mb-4">評価カテゴリ比較</h4>
          {radarData.some(d => d.競合平均 != null) ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "#64748b" }} />
                <PolarRadiusAxis angle={30} domain={[3, 5]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={3} />
                <Radar name="競合平均" dataKey="競合平均" stroke="#EF4444" fill="#EF4444" fillOpacity={0.12} strokeWidth={2} />
                {hasOwnRadarData && (
                  <Radar name="自社" dataKey="自社" stroke={OWN_COLOR} fill={OWN_COLOR} fillOpacity={0.15} strokeWidth={2.5} />
                )}
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number | undefined) => v != null ? v.toFixed(2) : "—"}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">カテゴリデータがありません</div>
          )}
          <p className="text-[10px] text-slate-400 mt-2 text-center">楽天トラベル評価ベース</p>
        </div>

        <div className="yl-card p-5 flex-1">
          <h4 className="text-xs font-semibold text-slate-700 mb-1">価格 × 評価 ポジショニング</h4>
          <p className="text-[10px] text-slate-400 mb-4">高評価＆高価格がプレミアムポジション</p>
          {allScatterPoints.length > 0 ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" dataKey="price" name="価格" tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                    label={{ value: "価格（円）", position: "insideBottom", offset: -10, fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis type="number" dataKey="rating" name="評価" domain={[3.0, 5.0]} tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v.toFixed(1)}
                    label={{ value: "楽天評価", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip content={<ScatterTooltip />} />
                  {avgPrice  && <ReferenceLine x={avgPrice}  stroke="#e2e8f0" strokeDasharray="4 2" />}
                  {avgRating && <ReferenceLine y={avgRating} stroke="#e2e8f0" strokeDasharray="4 2" />}
                  {scatterData.map((d) => (
                    <Scatter key={d.name} name={d.name} data={[d]} fill={d.color} fillOpacity={0.85} />
                  ))}
                  {ownScatterPoint && (
                    <Scatter name={propertyName} data={[ownScatterPoint]} fill={OWN_COLOR}
                      shape={(props) => {
                        const { cx, cy } = props as { cx: number; cy: number };
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={11} fill={OWN_COLOR} fillOpacity={0.95} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">自社</text>
                          </g>
                        );
                      }}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
              {avgPrice && avgRating && (
                <div className="absolute inset-0 pointer-events-none" style={{ top: 10, bottom: 30, left: 10, right: 20 }}>
                  <div className="absolute right-3 top-2 text-[9px] font-medium px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50">プレミアム</div>
                  <div className="absolute left-10 top-2 text-[9px] font-medium px-1.5 py-0.5 rounded text-blue-700 bg-blue-50">割安感あり</div>
                  <div className="absolute right-3 bottom-2 text-[9px] font-medium px-1.5 py-0.5 rounded text-red-700 bg-red-50">価格過大</div>
                  <div className="absolute left-10 bottom-2 text-[9px] font-medium px-1.5 py-0.5 rounded text-amber-700 bg-amber-50">ローコスト</div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">価格と評価の両方があるホテルがありません</div>
          )}
          <p className="text-[10px] text-slate-400 mt-2 text-center">楽天評価 × 楽天今日の最安値</p>
        </div>
      </div>

      {/* ─── ZONE C: レビューカード ─── */}
      {reviewRatings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-semibold text-slate-700">最新口コミ</h4>
            <span className="text-[10px] text-slate-400">楽天トラベル · {reviewRatings.length}件</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {reviewRatings.map(({ rating, color, isOwn }) => (
              <ReviewCard
                key={`${rating.hotel_name}-${rating.source}`}
                rating={rating}
                signal={priceSignals.get(rating.hotel_name) ?? { sentiment: "none", matchedKeywords: [], highlightedText: [] }}
                hotelColor={color}
                isOwn={isOwn}
              />
            ))}
          </div>
        </div>
      )}

      {/* 未連携ソース案内 */}
      <div className="yl-card p-4 bg-slate-50 border-dashed">
        <p className="text-xs font-medium text-slate-600 mb-2">評価ソースの拡張（Phase 3）</p>
        <div className="flex gap-2 flex-wrap">
          {(["google", "tripadvisor"] as const).map((src) => {
            const cfg = SOURCE_CONFIG[src];
            const hasData = ratings.some(r => r.source === src);
            return (
              <div key={src} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${hasData ? `${cfg.bg} ${cfg.border} ${cfg.text}` : "bg-white border-slate-200 text-slate-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasData ? "bg-current" : "bg-slate-300"}`} />
                {cfg.label}
                <span className={`ml-1 text-[10px] ${hasData ? "opacity-70" : "text-slate-300"}`}>
                  {hasData ? "連携済み" : "Phase 3 予定"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── ホテル評価カード（内部コンポーネント） ─────────────────── */

function HotelRatingCard({
  hotelName, color, rakuten, google, ta, isOwn, signal,
}: {
  hotelName: string;
  color: string;
  rakuten?: CompetitorRatingOut;
  google?: CompetitorRatingOut;
  ta?: CompetitorRatingOut;
  isOwn: boolean;
  signal: PriceSignal;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className="text-sm font-semibold text-slate-800">{hotelName}</span>
          {isOwn && <Building2 className="w-3.5 h-3.5 text-brand-navy" />}
          {rakuten?.review_count != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <Users className="w-3 h-3" />{rakuten.review_count.toLocaleString()}件
            </span>
          )}
          {signal.sentiment !== "none" && <PriceSentimentBadge signal={signal} />}
        </div>

        {/* ソース別スコアバッジ */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {(["rakuten", "google", "tripadvisor"] as const).map((src) => {
            const r = src === "rakuten" ? rakuten : src === "google" ? google : ta;
            const cfg = SOURCE_CONFIG[src];
            return (
              <div key={src} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${r ? `${cfg.border} ${cfg.bg}` : "border-slate-100 bg-slate-50"}`}>
                <span className={`text-[10px] font-medium ${r ? cfg.text : "text-slate-300"}`}>{cfg.label}</span>
                {r?.overall != null
                  ? <span className={`text-xs font-bold ${cfg.text}`}>★{r.overall.toFixed(1)}</span>
                  : <span className="text-[10px] text-slate-300">—</span>
                }
              </div>
            );
          })}
        </div>

        {/* カテゴリ別バー */}
        {rakuten && Object.keys(CATEGORY_LABELS).some(k => rakuten.categories[k as keyof typeof rakuten.categories] != null) && (
          <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
            {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((k) => (
              <div key={k}>
                <span className="text-[10px] text-slate-500 block mb-0.5">{CATEGORY_LABELS[k]}</span>
                <StarBar score={rakuten.categories[k as keyof typeof rakuten.categories]} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 総合スコア */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
        {rakuten?.overall != null ? (
          <>
            <div
              className="w-14 h-14 rounded-full flex flex-col items-center justify-center border-2"
              style={{ borderColor: color, background: `${color}12` }}
            >
              <span className="text-base font-bold leading-none" style={{ color }}>{rakuten.overall.toFixed(1)}</span>
              <Star className="w-2.5 h-2.5 mt-0.5" style={{ color }} />
            </div>
            <div className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
              rakuten.overall >= 4.5 ? "text-green-700 bg-green-50" :
              rakuten.overall >= 4.0 ? "text-blue-700 bg-blue-50" :
              rakuten.overall >= 3.5 ? "text-yellow-700 bg-yellow-50" : "text-red-700 bg-red-50"
            }`}>
              {rakuten.overall >= 4.5 ? "優秀" : rakuten.overall >= 4.0 ? "良好" : rakuten.overall >= 3.5 ? "普通" : "要注意"}
            </div>
          </>
        ) : (
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
            <span className="text-[10px] text-slate-300">未取得</span>
          </div>
        )}
      </div>
    </div>
  );
}
