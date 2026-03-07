"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import { RefreshCw, Star, Users, ExternalLink, MessageSquare, TrendingUp, Minus, AlertTriangle } from "lucide-react";
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
const COMP_COLORS = ["#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

/* ─────────────────── 価格感度エンジン ─────────────────── */

/**
 * 価格感度シグナルの定義
 *
 * positive: 「安い・お得・コスパ良」に関する言及 → 値上げ余地のシグナル
 * negative: 「高い・割高・コスパ悪」に関する言及 → 価格正当化リスクのシグナル
 */
const PRICE_KEYWORDS = {
  // 価格ポジティブ（ユーザーが価格を安いと感じている）
  positive: [
    "お得", "おとく", "リーズナブル", "リーズナブル", "安い", "お安", "コスパ良",
    "コスパが良", "コスパがいい", "コスパよ", "コスト良", "割安", "手頃",
    "値打ち", "値ごろ", "リーゾナブル", "cheap", "affordable", "great value",
    "良心的", "価格以上", "満足できる価格", "納得の価格",
  ],
  // 価格ネガティブ（ユーザーが価格を高いと感じている）
  negative: [
    "高い", "高すぎ", "割高", "コスパ悪", "コスパが悪", "コスパは悪", "コスパ×",
    "高額", "お高", "値段が高", "料金が高", "価格が高", "ちょっと高",
    "少し高", "やや高", "high price", "expensive", "overpriced", "不満な価格",
    "もう少し安", "値段の割に", "値段の割には", "価格の割に",
  ],
  // 価格関連キーワード（中立・言及あり）
  neutral: [
    "価格", "料金", "値段", "費用", "コスト", "宿泊費", "宿泊代", "室料",
    "プライス", "金額", "代金", "宿代",
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

  // センチメントの決定（ポジとネガが両方ある場合は多い方優先）
  let sentiment: PriceSentiment = "none";
  if (positiveMatches.length > 0 || negativeMatches.length > 0) {
    if (positiveMatches.length >= negativeMatches.length && positiveMatches.length > 0) {
      sentiment = "positive";
    } else if (negativeMatches.length > positiveMatches.length) {
      sentiment = "negative";
    }
  } else if (neutralMatches.length > 0) {
    sentiment = "neutral_mention";
  }

  // テキストをハイライト区間に分割
  const allKeywords: Array<{ keyword: string; type: "positive" | "negative" | "neutral" }> = [
    ...negativeMatches.map(k => ({ keyword: k, type: "negative" as const })),
    ...positiveMatches.map(k => ({ keyword: k, type: "positive" as const })),
    ...neutralMatches.map(k => ({ keyword: k, type: "neutral" as const })),
  ].sort((a, b) => b.keyword.length - a.keyword.length);

  // テキストをセグメントに分割（ハイライト適用）
  let segments: Array<{ text: string; highlight: "positive" | "negative" | "neutral" | null }> = [
    { text, highlight: null },
  ];

  for (const { keyword, type } of allKeywords) {
    const newSegments: typeof segments = [];
    for (const seg of segments) {
      if (seg.highlight !== null) {
        newSegments.push(seg);
        continue;
      }
      const idx = seg.text.toLowerCase().indexOf(keyword.toLowerCase());
      if (idx === -1) {
        newSegments.push(seg);
        continue;
      }
      if (idx > 0) newSegments.push({ text: seg.text.slice(0, idx), highlight: null });
      newSegments.push({ text: seg.text.slice(idx, idx + keyword.length), highlight: type });
      if (idx + keyword.length < seg.text.length)
        newSegments.push({ text: seg.text.slice(idx + keyword.length), highlight: null });
    }
    segments = newSegments;
  }

  return {
    sentiment,
    matchedKeywords: [...negativeMatches, ...positiveMatches],
    highlightedText: segments,
  };
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

/** 価格感度バッジ */
function PriceSentimentBadge({ signal }: { signal: PriceSignal }) {
  if (signal.sentiment === "none") return null;
  const config = {
    positive: {
      icon: <TrendingUp className="w-3 h-3" />,
      label: "価格コスパ評価あり",
      className: "text-emerald-700 bg-emerald-50 border-emerald-200",
      tooltip: "「お得・コスパ良」の言及があります。値上げ余地のシグナル",
    },
    negative: {
      icon: <AlertTriangle className="w-3 h-3" />,
      label: "割高感の声あり",
      className: "text-red-700 bg-red-50 border-red-200",
      tooltip: "「高い・割高」の言及があります。価格正当化リスクに注意",
    },
    neutral_mention: {
      icon: <Minus className="w-3 h-3" />,
      label: "価格への言及あり",
      className: "text-slate-600 bg-slate-100 border-slate-200",
      tooltip: "価格に関する中立的な言及があります",
    },
  };
  const c = config[signal.sentiment as keyof typeof config];
  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium ${c.className}`}
      title={c.tooltip}
    >
      {c.icon}
      {c.label}
    </div>
  );
}

/** ハイライト付きレビューテキスト */
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

function QuadrantLabel({ x, y, label, color }: { x: string; y: string; label: string; color: string }) {
  return (
    <div
      className={`absolute text-[9px] font-medium px-1.5 py-0.5 rounded ${x === "left" ? "left-10" : "right-3"} ${y === "top" ? "top-2" : "bottom-2"}`}
      style={{ color, background: `${color}18` }}
    >
      {label}
    </div>
  );
}

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
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

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
      await new Promise(r => setTimeout(r, 10000));
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  const rakutenByHotel = useMemo(() => {
    const map = new Map<string, CompetitorRatingOut>();
    for (const r of ratings) {
      if (r.source === "rakuten") map.set(r.hotel_name, r);
    }
    return map;
  }, [ratings]);

  const allHotels = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const r of ratings) {
      if (!seen.has(r.hotel_name)) { seen.add(r.hotel_name); names.push(r.hotel_name); }
    }
    return names;
  }, [ratings]);

  // 価格感度シグナル（ホテル名→解析結果）
  const priceSignals = useMemo(() => {
    const map = new Map<string, PriceSignal>();
    for (const [name, r] of Array.from(rakutenByHotel.entries())) {
      map.set(name, analyzePriceSentiment(r.user_review));
    }
    return map;
  }, [rakutenByHotel]);

  // 価格感度サマリー（ネガティブ件数）
  const negativeCount = useMemo(() =>
    Array.from(priceSignals.values()).filter(s => s.sentiment === "negative").length,
    [priceSignals]
  );
  const positiveCount = useMemo(() =>
    Array.from(priceSignals.values()).filter(s => s.sentiment === "positive").length,
    [priceSignals]
  );

  const radarData = useMemo(() => {
    const keys: Array<keyof CompetitorRatingOut["categories"]> = [
      "service", "location", "room", "equipment", "bath", "meal",
    ];
    const compRatings = Array.from(rakutenByHotel.values());
    return keys.map((k) => {
      const vals = compRatings.map(r => r.categories[k]).filter((v): v is number => v != null);
      const avg = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
      return { category: CATEGORY_LABELS[k], 競合平均: avg };
    });
  }, [rakutenByHotel]);

  const scatterData = useMemo((): ScatterPoint[] => {
    return allHotels.flatMap((name, i) => {
      const rating = rakutenByHotel.get(name);
      const price = compPriceMap[name];
      if (rating?.overall != null && price) {
        return [{ name, price, rating: rating.overall, reviewCount: rating.review_count, isOwn: false, color: COMP_COLORS[i % COMP_COLORS.length] }];
      }
      return [];
    });
  }, [allHotels, rakutenByHotel, compPriceMap]);

  const ownRating = useMemo(() =>
    Array.from(rakutenByHotel.values()).find(r => r.hotel_name === propertyName) ?? null,
    [rakutenByHotel, propertyName]
  );

  const ownScatterPoint: ScatterPoint | null = useMemo(() => {
    if (!ownRating?.overall || !ownTodayPrice) return null;
    return { name: propertyName, price: ownTodayPrice, rating: ownRating.overall, reviewCount: ownRating.review_count, isOwn: true, color: OWN_COLOR };
  }, [ownRating, ownTodayPrice, propertyName]);

  const avgPrice = scatterData.length ? Math.round(scatterData.reduce((a, b) => a + b.price, 0) / scatterData.length) : null;
  const avgRating = scatterData.length ? +(scatterData.reduce((a, b) => a + b.rating, 0) / scatterData.length).toFixed(2) : null;
  const lastFetched = ratings.length > 0
    ? new Date(ratings[0].fetched_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

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
              <Skeleton className="h-12 w-full rounded-lg" />
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
          <p className="text-xs text-slate-400 mt-1">「評価データを取得する」ボタンを押してください</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E3A8A] text-white text-sm rounded-lg hover:bg-[#1e3070] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "取得中..." : "評価データを取得する"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pt-4">

      {/* ヘッダー + 価格感度サマリー */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">競合ホテル評価モニター</h3>
          <div className="flex items-center gap-3 mt-1.5">
            {lastFetched && <span className="text-[11px] text-slate-400">取得: {lastFetched}</span>}
            {/* 価格感度サマリーバッジ */}
            {negativeCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                割高感の声 {negativeCount}社
              </span>
            )}
            {positiveCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                コスパ評価 {positiveCount}社
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
          {refreshing ? "取得中..." : "評価データ更新"}
        </button>
      </div>

      {/* ZONE A: 評価カード一覧 */}
      <div className="space-y-3">
        {allHotels.map((hotelName, i) => {
          const rakuten = ratings.find(r => r.hotel_name === hotelName && r.source === "rakuten");
          const google  = ratings.find(r => r.hotel_name === hotelName && r.source === "google");
          const ta      = ratings.find(r => r.hotel_name === hotelName && r.source === "tripadvisor");
          const color   = COMP_COLORS[i % COMP_COLORS.length];
          const signal  = priceSignals.get(hotelName) ?? { sentiment: "none" as const, matchedKeywords: [], highlightedText: [] };
          const isExpanded = expandedReview === hotelName;

          return (
            <div key={hotelName} className="yl-card p-4">
              <div className="flex items-start gap-4">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />

                <div className="flex-1 min-w-0">
                  {/* ホテル名 + 口コミ件数 + 価格感度バッジ */}
                  <div className="flex items-center gap-2 flex-wrap mb-2.5">
                    <span className="text-sm font-semibold text-slate-800">{hotelName}</span>
                    {rakuten?.review_count != null && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                        <Users className="w-3 h-3" />
                        {rakuten.review_count.toLocaleString()}件
                      </span>
                    )}
                    <PriceSentimentBadge signal={signal} />
                  </div>

                  {/* ソース別スコアバッジ */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {(["rakuten", "google", "tripadvisor"] as const).map((src) => {
                      const r = src === "rakuten" ? rakuten : src === "google" ? google : ta;
                      const cfg = SOURCE_CONFIG[src];
                      return (
                        <div key={src} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${r ? cfg.border + " " + cfg.bg : "border-slate-100 bg-slate-50"}`}>
                          <span className={`text-[10px] font-medium ${r ? cfg.text : "text-slate-300"}`}>{cfg.label}</span>
                          {r?.overall != null
                            ? <span className={`text-xs font-bold ${cfg.text}`}>★{r.overall.toFixed(1)}</span>
                            : <span className="text-[10px] text-slate-300">—</span>
                          }
                        </div>
                      );
                    })}
                  </div>

                  {/* カテゴリ別バー（楽天のみ） */}
                  {rakuten && Object.keys(CATEGORY_LABELS).some(k =>
                    rakuten.categories[k as keyof typeof rakuten.categories] != null
                  ) && (
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 mb-3">
                      {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((k) => (
                        <div key={k}>
                          <span className="text-[10px] text-slate-500 block mb-0.5">{CATEGORY_LABELS[k]}</span>
                          <StarBar score={rakuten.categories[k as keyof typeof rakuten.categories]} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 口コミセクション */}
                  {rakuten?.user_review ? (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedReview(isExpanded ? null : hotelName)}
                        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer mb-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>最新口コミ（楽天）</span>
                        <span className="text-slate-300">{isExpanded ? "▲ 閉じる" : "▼ 表示"}</span>
                      </button>

                      {isExpanded && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs leading-relaxed text-slate-600 animate-in fade-in duration-200">
                          <HighlightedReview segments={signal.highlightedText} />
                          {rakuten.review_url && (
                            <a
                              href={rakuten.review_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-[10px] text-[#BF0000] hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              楽天トラベルでレビューをすべて見る
                            </a>
                          )}
                        </div>
                      )}

                      {/* 折りたたみ時はシグナルの抜粋を表示 */}
                      {!isExpanded && signal.matchedKeywords.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-slate-400">検出キーワード:</span>
                          {signal.matchedKeywords.slice(0, 4).map(kw => (
                            <span key={kw} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              PRICE_KEYWORDS.negative.includes(kw as never)
                                ? "text-red-700 bg-red-50"
                                : "text-emerald-700 bg-emerald-50"
                            }`}>{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    rakuten?.review_url && (
                      <a
                        href={rakuten.review_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-[#BF0000] hover:underline mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        楽天トラベルでレビューを見る
                      </a>
                    )
                  )}
                </div>

                {/* 総合スコアサークル */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <ScoreCircle score={rakuten?.overall ?? null} source="rakuten" />
                  {rakuten?.overall != null && (
                    <div className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      rakuten.overall >= 4.5 ? "text-green-700 bg-green-50" :
                      rakuten.overall >= 4.0 ? "text-blue-700 bg-blue-50" :
                      rakuten.overall >= 3.5 ? "text-yellow-700 bg-yellow-50" : "text-red-700 bg-red-50"
                    }`}>
                      {rakuten.overall >= 4.5 ? "優秀" : rakuten.overall >= 4.0 ? "良好" : rakuten.overall >= 3.5 ? "普通" : "要注意"}
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
        <div className="yl-card p-5 flex-1">
          <h4 className="text-xs font-semibold text-slate-700 mb-4">評価カテゴリ比較（競合平均）</h4>
          {radarData.some(d => d.競合平均 != null) ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "#64748b" }} />
                <PolarRadiusAxis angle={30} domain={[3, 5]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={3} />
                <Radar name="競合平均" dataKey="競合平均" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} strokeWidth={2} />
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
          {scatterData.length > 0 || ownScatterPoint ? (
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
                    <Scatter key={d.name} name={d.name} data={[d]} fill={d.color} fillOpacity={0.8} />
                  ))}
                  {ownScatterPoint && (
                    <Scatter name={propertyName} data={[ownScatterPoint]} fill={OWN_COLOR}
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
              {avgPrice && avgRating && (
                <div className="absolute inset-0 pointer-events-none" style={{ top: 10, bottom: 30, left: 10, right: 20 }}>
                  <QuadrantLabel x="right" y="top"    label="プレミアム"  color="#10B981" />
                  <QuadrantLabel x="left"  y="top"    label="割安感あり"  color="#3B82F6" />
                  <QuadrantLabel x="right" y="bottom" label="価格過大"    color="#EF4444" />
                  <QuadrantLabel x="left"  y="bottom" label="ローコスト"  color="#F59E0B" />
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
