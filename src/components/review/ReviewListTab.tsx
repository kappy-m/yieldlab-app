"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, MessageSquare, ChevronDown, Check, AlertCircle, Loader2 } from "lucide-react";
import {
  PLATFORM_LABELS, PLATFORM_COLORS, LANG_LABELS, LANG_COLORS,
  type Platform, type Language,
} from "./reviewData";
import { ReviewSlidePanel } from "./ReviewSlidePanel";
import { fetchReviews, respondToReview, type ReviewOut } from "@/lib/api";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-3 h-3 ${i < Math.round(rating) ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function ReviewListTab({ propertyId }: { propertyId: number }) {
  const [reviews, setReviews]       = useState<ReviewOut[]>([]);
  const [loading, setLoading]       = useState(true);
  const [unresponded, setUnresponded] = useState(0);
  const [selected, setSelected]     = useState<ReviewOut | null>(null);
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [ratingFilter, setRatingFilter]     = useState<number | "all">("all");
  const [langFilter, setLangFilter]         = useState<Language | "all">("all");
  const [search, setSearch]                 = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReviews(propertyId);
      setReviews(data.items);
      setUnresponded(data.unresponded);
    } catch {
      // エラー時はモックフォールバックなし — エンプティステートを表示
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (platformFilter !== "all" && r.platform !== platformFilter) return false;
      if (ratingFilter !== "all" && Math.round(r.rating) !== ratingFilter) return false;
      if (langFilter !== "all" && r.language !== langFilter) return false;
      if (search && !r.text.toLowerCase().includes(search.toLowerCase()) &&
          !r.author.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [reviews, platformFilter, ratingFilter, langFilter, search]);

  const handleMarkResponded = async (id: number, responseText: string) => {
    try {
      const updated = await respondToReview(propertyId, id, responseText);
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, ...updated } : r));
      setSelected((prev) => prev?.id === id ? { ...prev, ...updated } : prev);
      setUnresponded((n) => Math.max(0, n - 1));
    } catch {
      // サイレントエラー — UIは変更しない
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* ステータスバー */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">未返信 {unresponded} 件</span>
          </div>
          <span className="text-xs text-slate-400">全 {reviews.length} 件 / 表示 {filtered.length} 件</span>
        </div>

        {/* フィルターバー */}
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="キーワード・投稿者名で検索..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>

            <div className="relative">
              <select value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value as Platform | "all")}
                className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="all">全プラットフォーム</option>
                {(["google", "rakuten", "expedia", "booking"] as Platform[]).map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="all">全評価</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>★ {r}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={langFilter}
                onChange={(e) => setLangFilter(e.target.value as Language | "all")}
                className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="all">全言語</option>
                {(["ja", "en", "zh", "ko", "de"] as Language[]).map((l) => (
                  <option key={l} value={l}>{LANG_LABELS[l]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* リスト */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">条件に合う口コミが見つかりません</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((review) => {
                const isSelected = selected?.id === review.id;
                const platformKey = review.platform as Platform;
                const langKey = review.language;
                return (
                  <li key={review.id}>
                    <button
                      onClick={() => setSelected(review)}
                      className={`w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${isSelected ? "bg-blue-50/50" : ""}`}
                    >
                      <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 mt-0.5 font-bold text-sm ${
                        Math.round(review.rating) >= 4 ? "bg-green-100 text-green-600" :
                        Math.round(review.rating) === 3 ? "bg-amber-100 text-amber-600" :
                        "bg-red-100 text-red-600"
                      }`}>
                        {review.rating.toFixed(1)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${PLATFORM_COLORS[platformKey] ?? "bg-slate-100 text-slate-600"}`}>
                            {PLATFORM_LABELS[platformKey] ?? review.platform}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 truncate">{review.author}</span>
                          <StarRating rating={review.rating} />
                          {review.responded && (
                            <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              <Check className="w-2.5 h-2.5" />返信済
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${LANG_COLORS[langKey] ?? "bg-slate-100 text-slate-600"}`}>
                            {LANG_LABELS[langKey] ?? langKey}
                          </span>
                          {!review.responded && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              未返信
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{review.text}</p>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <span className="text-xs text-slate-400">{review.date}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ReviewSlidePanel
        review={selected}
        onClose={() => setSelected(null)}
        onMarkResponded={handleMarkResponded}
        propertyId={propertyId}
      />
    </>
  );
}
