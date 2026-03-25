"use client";

import { useState, useMemo } from "react";
import { Search, Sparkles, ChevronDown, MessageSquare, Check } from "lucide-react";
import {
  MOCK_REVIEWS, PLATFORM_LABELS, PLATFORM_COLORS, LANG_LABELS, LANG_COLORS,
  type Platform, type Language,
} from "./reviewData";

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`${cls} ${i < Math.round(rating) ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// AI 返信スタブ — モック返信文（言語自動判定）
function mockReplyDraft(text: string, lang: Language): string {
  const templates: Record<Language, string> = {
    ja: "この度はご宿泊いただき、また貴重なご意見をお聞かせいただき誠にありがとうございます。スタッフ一同、皆様に快適にお過ごしいただけるよう努力してまいります。またのご来館を心よりお待ちしております。",
    en: "Thank you so much for taking the time to share your experience with us. We're delighted to hear your feedback and will continue striving to provide the best possible stay for all our guests. We hope to welcome you back soon!",
    zh: "非常感谢您抽出宝贵时间分享您的住宿体验。您的反馈对我们非常重要，我们将继续努力为每位宾客提供最优质的服务。期待再次为您提供服务！",
    ko: "소중한 리뷰를 남겨주셔서 감사합니다. 고객님의 소중한 의견을 바탕으로 더 나은 서비스를 제공할 수 있도록 노력하겠습니다. 다음에도 꼭 방문해 주시기 바랍니다.",
    de: "Vielen Dank für Ihre Zeit und Ihr wertvolles Feedback. Wir freuen uns sehr über Ihre Rückmeldung und werden weiterhin alles dafür tun, dass sich unsere Gäste rundum wohl fühlen. Wir hoffen, Sie bald wieder bei uns begrüßen zu dürfen.",
  };
  void text; // unused in stub
  return templates[lang] ?? templates.ja;
}

export function ReviewListTab({ propertyId: _propertyId }: { propertyId: number }) {
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [langFilter, setLangFilter] = useState<Language | "all">("all");
  const [search, setSearch] = useState("");
  const [replyOpenId, setReplyOpenId] = useState<number | null>(null);
  const [replyLang, setReplyLang] = useState<Language>("ja");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return MOCK_REVIEWS.filter((r) => {
      if (platformFilter !== "all" && r.platform !== platformFilter) return false;
      if (ratingFilter !== "all" && Math.round(r.rating) !== ratingFilter) return false;
      if (langFilter !== "all" && r.language !== langFilter) return false;
      if (search && !r.text.toLowerCase().includes(search.toLowerCase()) &&
          !r.author.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [platformFilter, ratingFilter, langFilter, search]);

  const unrespondedCount = MOCK_REVIEWS.filter((r) => !r.responded).length;

  return (
    <div className="space-y-4">
      {/* ステータスバー */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">未返信 {unrespondedCount} 件</span>
        </div>
        <span className="text-xs text-slate-400">全 {MOCK_REVIEWS.length} 件 / 表示 {filtered.length} 件</span>
      </div>

      {/* フィルターバー */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 検索 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="キーワード・作者名で検索..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>

          {/* プラットフォーム */}
          <div className="relative">
            <select
              value={platformFilter}
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

          {/* 評価 */}
          <div className="relative">
            <select
              value={ratingFilter}
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

          {/* 言語 */}
          <div className="relative">
            <select
              value={langFilter}
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

      {/* 口コミカード一覧 */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
            <p className="text-sm text-slate-400">条件に合う口コミが見つかりません</p>
          </div>
        )}

        {filtered.map((review) => {
          const isReplyOpen = replyOpenId === review.id;
          const draft = mockReplyDraft(review.text, replyLang);
          return (
            <div key={review.id}
              className={`bg-white rounded-xl border shadow-sm p-4 transition-colors ${
                !review.responded ? "border-amber-100" : "border-slate-100"
              }`}
            >
              {/* ヘッダー行 */}
              <div className="flex items-start gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${PLATFORM_COLORS[review.platform]}`}>
                  {PLATFORM_LABELS[review.platform]}
                </span>
                <span className="text-xs font-semibold text-slate-700">{review.author}</span>
                <StarRating rating={review.rating} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${LANG_COLORS[review.language]}`}>
                  {LANG_LABELS[review.language]}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{review.date}</span>
                {review.responded && (
                  <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    <Check className="w-2.5 h-2.5" />返信済
                  </span>
                )}
              </div>

              {/* 本文 */}
              <p className="text-xs text-slate-600 leading-relaxed mb-3">{review.text}</p>

              {/* 既存の返信 */}
              {review.responded && review.response && (
                <div className="mb-3 pl-3 border-l-2 border-blue-200">
                  <p className="text-[10px] font-semibold text-blue-600 mb-0.5">ホテルからの返信</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{review.response}</p>
                </div>
              )}

              {/* AI返信ボタン */}
              {!review.responded && (
                <div>
                  <button
                    onClick={() => {
                      setReplyOpenId(isReplyOpen ? null : review.id);
                      setReplyLang(review.language in { ja: 1, en: 1, zh: 1, ko: 1, de: 1 } ? review.language : "ja");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer"
                    style={isReplyOpen
                      ? { background: "#1E3A8A", color: "white", borderColor: "#1E3A8A" }
                      : { background: "white", color: "#1E3A8A", borderColor: "#1E3A8A" }
                    }
                  >
                    <Sparkles className="w-3 h-3" />
                    AI返信案を生成
                  </button>

                  {/* 返信ドラフトエリア */}
                  {isReplyOpen && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">AI 返信案</span>
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            ✦ Beta — OpenAI GPT-4o
                          </span>
                        </div>
                        {/* 言語切り替え */}
                        <div className="relative">
                          <select
                            value={replyLang}
                            onChange={(e) => setReplyLang(e.target.value as Language)}
                            className="appearance-none text-[10px] pl-2 pr-5 py-1 border border-slate-200 rounded-md bg-white cursor-pointer focus:outline-none"
                          >
                            {(["ja", "en", "zh", "ko", "de"] as Language[]).map((l) => (
                              <option key={l} value={l}>{LANG_LABELS[l]}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3 p-2.5 bg-white rounded-md border border-slate-100">
                        {draft}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setCopiedId(review.id); setTimeout(() => setCopiedId(null), 2000); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
                          style={{ background: copiedId === review.id ? "#16A34A" : "#1E3A8A" }}
                        >
                          {copiedId === review.id ? <><Check className="w-3 h-3" />コピー済み</> : "この返信を使用"}
                        </button>
                        <button className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer px-2 py-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                          再生成
                        </button>
                        <button
                          onClick={() => setReplyOpenId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer ml-auto px-2 py-1.5"
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
