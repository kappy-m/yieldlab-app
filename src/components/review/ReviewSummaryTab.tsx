"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { fetchReviews, type ReviewOut } from "@/lib/api";
import {
  MONTHLY_TREND, SENTIMENT_DATA,
  PLATFORM_LABELS, PLATFORM_COLORS, LANG_LABELS, LANG_COLORS,
} from "./reviewData";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < Math.round(rating) ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor" viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

type PlatformKey = string;

export function ReviewSummaryTab({ propertyId }: { propertyId: number }) {
  const [reviews, setReviews] = useState<ReviewOut[]>([]);
  const [unresponded, setUnresponded] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchReviews(propertyId)
      .then((data) => {
        setReviews(data.items ?? []);
        setUnresponded(data.unresponded ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId]);

  // 実データからスコア集計
  const totalScore = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;
  const totalCount = reviews.length;
  const recentReviews = [...reviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  // プラットフォーム別集計
  const platformMap: Record<PlatformKey, { sum: number; count: number }> = {};
  for (const r of reviews) {
    const p = r.platform ?? "other";
    if (!platformMap[p]) platformMap[p] = { sum: 0, count: 0 };
    platformMap[p].sum += r.rating;
    platformMap[p].count += 1;
  }
  const platformScores = Object.entries(platformMap).map(([platform, { sum, count }]) => ({
    platform,
    label: PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform,
    score: Math.round((sum / count) * 10) / 10,
    count,
    delta: 0,
  }));

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* AI サマリー */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 bg-gradient-to-br from-brand-navy to-blue-500">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">AI 分析サマリー</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              総合評価は <strong>{totalScore > 0 ? `${totalScore} / 5.0` : "データなし"}</strong>。
              全 <strong>{totalCount}件</strong> のレビューを集計しています。
              未返信口コミが <strong>{unresponded}件</strong> あります。
            </p>
          </div>
        </div>
      </div>

      {/* スコアカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 総合 */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">総合評価</p>
          <div className="flex items-end gap-2 mb-1">
            <span className="text-3xl font-bold text-slate-800">{totalScore > 0 ? totalScore : "—"}</span>
            <span className="text-sm text-slate-400 mb-1">/ 5.0</span>
          </div>
          {totalScore > 0 && <StarRating rating={totalScore} />}
          <p className="text-xs text-slate-400 mt-1.5">{totalCount} 件のレビュー</p>
        </div>

        {/* プラットフォーム別 */}
        {platformScores.map((p) => (
          <div key={p.platform} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{p.label}</p>
            <div className="flex items-end gap-1.5 mb-1">
              <span className="text-2xl font-bold text-slate-800">{p.score}</span>
              <span className="text-xs text-slate-400 mb-0.5">/ 5.0</span>
            </div>
            <StarRating rating={p.score} />
            <p className="text-xs text-slate-400 mt-1.5">{p.count} 件</p>
            <div className="flex items-center gap-1 mt-1">
              {p.delta > 0 ? (
                <><TrendingUp className="w-3 h-3 text-green-500" /><span className="text-xs text-green-600">+{p.delta}</span></>
              ) : p.delta < 0 ? (
                <><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-xs text-red-500">{p.delta}</span></>
              ) : (
                <><Minus className="w-3 h-3 text-slate-400" /><span className="text-xs text-slate-400">±0</span></>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* チャート行 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 評価トレンド（時系列データはバックエンド未対応のため参考値） */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">評価スコアトレンド（過去12ヶ月）</h3>
            <span className="text-xs text-slate-400">参考値（時系列データ未対応）</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MONTHLY_TREND} margin={{ top: 5, right: 16, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[3.4, 5.0]} tick={{ fontSize: 11 }} tickFormatter={(v) => (v as number).toFixed(1)} />
              <Tooltip formatter={(v) => (v as number).toFixed(1)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="google"  name="Google"      stroke="#4285F4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rakuten" name="楽天トラベル" stroke="#BF0000" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expedia" name="Expedia"      stroke="#CA8A04" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 感情分布（分析データはバックエンド未対応のため参考値） */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">感情分布</h3>
            <span className="text-[10px] text-slate-400">参考値</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={SENTIMENT_DATA} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                dataKey="value" paddingAngle={2}>
                {SENTIMENT_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {SENTIMENT_DATA.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-slate-600">{s.name}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 最近の口コミ */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">最近の口コミ</h3>
        {recentReviews.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">口コミデータがありません</p>
        ) : (
          <div className="space-y-3">
            {recentReviews.map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${PLATFORM_COLORS[r.platform as keyof typeof PLATFORM_COLORS] ?? "bg-slate-100 text-slate-600"}`}>
                  {PLATFORM_LABELS[r.platform as keyof typeof PLATFORM_LABELS] ?? r.platform}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">{r.author}</span>
                    <StarRating rating={r.rating} />
                    <span className="text-[10px] text-slate-400 ml-auto">{r.date}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${LANG_COLORS[r.language as keyof typeof LANG_COLORS] ?? "bg-slate-100 text-slate-600"}`}>
                      {LANG_LABELS[r.language as keyof typeof LANG_LABELS] ?? r.language}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
