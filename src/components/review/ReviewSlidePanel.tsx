"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Check, Send } from "lucide-react";
import {
  type Review,
  PLATFORM_LABELS, PLATFORM_COLORS, LANG_LABELS, LANG_COLORS,
  type Language,
} from "./reviewData";

const LANG_REPLY_TEMPLATES: Record<Language, string> = {
  ja: "この度はご宿泊いただき、また貴重なご意見をお聞かせいただき誠にありがとうございます。\n\n[ここに具体的なコメントを入力]\n\nスタッフ一同、皆様に快適にお過ごしいただけるよう努力してまいります。またのご来館を心よりお待ちしております。",
  en: "Thank you so much for taking the time to share your experience with us.\n\n[Please insert a specific response here]\n\nWe look forward to welcoming you back soon!",
  zh: "非常感谢您抽出宝贵时间分享您的住宿体验。\n\n[请在此处填写具体回复内容]\n\n期待再次为您服务！",
  ko: "소중한 리뷰를 남겨주셔서 감사합니다.\n\n[구체적인 답변을 여기에 입력해 주세요]\n\n다음에도 꼭 방문해 주시기 바랍니다.",
  de: "Vielen Dank für Ihr wertvolles Feedback.\n\n[Bitte fügen Sie hier eine spezifische Antwort ein]\n\nWir hoffen, Sie bald wieder bei uns begrüßen zu dürfen.",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i < Math.round(rating) ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

const RATING_COLOR: Record<number, string> = {
  5: "text-green-600", 4: "text-green-500", 3: "text-amber-500", 2: "text-orange-500", 1: "text-red-600",
};

interface Props {
  review: Review | null;
  onClose: () => void;
  onMarkResponded: (id: number) => void;
}

export function ReviewSlidePanel({ review, onClose, onMarkResponded }: Props) {
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sent, setSent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAiDraftOpen(false);
    setReplyText("");
    setSent(false);
  }, [review?.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isOpen = review !== null;
  const draft = LANG_REPLY_TEMPLATES[review?.language ?? "ja"];

  const handleUseAIDraft = () => {
    setReplyText(draft);
    setAiDraftOpen(false);
  };

  const handleSend = () => {
    setSent(true);
    setTimeout(() => { setSent(false); onMarkResponded(review!.id); }, 1500);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-[520px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {!review ? null : (
          <>
            {/* パネルヘッダー */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-white/10 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PLATFORM_COLORS[review.platform]}`}>
                    {PLATFORM_LABELS[review.platform]}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${LANG_COLORS[review.language]}`}>
                    {LANG_LABELS[review.language]}
                  </span>
                  {review.responded && (
                    <span className="flex items-center gap-0.5 text-[10px] text-green-300 bg-green-900/30 px-1.5 py-0.5 rounded-full">
                      <Check className="w-2.5 h-2.5" />返信済
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{review.author}</span>
                  <StarRating rating={review.rating} />
                  <span className={`text-sm font-bold ${RATING_COLOR[Math.round(review.rating)] ?? "text-white"}`}>
                    {review.rating.toFixed(1)}
                  </span>
                </div>
                <p className="text-white/60 text-xs mt-0.5">{review.date}</p>
              </div>
              <button onClick={onClose}
                className="text-white/70 hover:text-white transition-colors cursor-pointer flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* スクロールコンテンツ */}
            <div className="flex-1 overflow-y-auto">

              {/* 口コミ本文 */}
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">口コミ</p>
                <p className="text-sm text-slate-700 leading-relaxed">{review.text}</p>
              </div>

              {/* 既存の返信 */}
              {review.responded && review.response && (
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">ホテルからの返信</p>
                  <div className="pl-3 border-l-2 border-blue-200">
                    <p className="text-sm text-slate-600 leading-relaxed">{review.response}</p>
                  </div>
                </div>
              )}

              {/* 返信エリア（未返信のみ） */}
              {!review.responded && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">返信を作成</p>

                  <button
                    onClick={() => setAiDraftOpen(!aiDraftOpen)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border mb-3 transition-all cursor-pointer"
                    style={aiDraftOpen
                      ? { background: "#1E3A8A", color: "white", borderColor: "#1E3A8A" }
                      : { background: "white", color: "#1E3A8A", borderColor: "#1E3A8A" }
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI返信案を生成
                    <span className="text-[10px] opacity-70 ml-1">Beta</span>
                  </button>

                  {aiDraftOpen && (
                    <div className="mb-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-blue-700">AI 返信案 — GPT-4o</span>
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Beta</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-white rounded-lg p-2.5 border border-blue-100">
                        {draft}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleUseAIDraft}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer"
                          style={{ background: "#1E3A8A" }}
                        >
                          <Check className="w-3 h-3" />
                          返信欄にコピー
                        </button>
                        <button className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer px-2 py-1.5 hover:bg-slate-100 rounded-lg">
                          再生成
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="返信内容を入力してください..."
                    rows={6}
                    className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 leading-relaxed placeholder:text-slate-300"
                  />

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSend}
                      disabled={!replyText.trim() || sent}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ background: sent ? "#16A34A" : "#1E3A8A" }}
                    >
                      {sent ? <><Check className="w-3.5 h-3.5" />送信しました</> : <><Send className="w-3.5 h-3.5" />送信（スタブ）</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
