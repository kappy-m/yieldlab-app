"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Mail, PhoneCall, FileText, Sparkles, Check, ChevronDown, Send, UserPlus, User } from "lucide-react";
import {
  type InquiryChannel, type InquiryStatus, type InquiryPriority,
  STATUS_CONFIG, PRIORITY_CONFIG, CHANNEL_CONFIG,
} from "./inquiryData";
import type { InquiryOut } from "@/lib/api";
import { generateAiReply, sendMail } from "@/lib/api";
import { useCurrentUser, getInitials } from "@/hooks/useCurrentUser";

const CHANNEL_ICONS: Record<InquiryChannel, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  form:  <FileText className="w-4 h-4" />,
  phone: <PhoneCall className="w-4 h-4" />,
};

const LANG_REPLY_TEMPLATES: Record<string, string> = {
  ja: "この度はお問い合わせいただき、誠にありがとうございます。\n\nご質問いただいた内容について、以下の通りご回答申し上げます。\n\n[ここに具体的な回答を記入]\n\nご不明な点がございましたら、お気軽にご連絡ください。今後ともよろしくお願いいたします。",
  en: "Thank you for reaching out to us.\n\nRegarding your inquiry, please find our response below:\n\n[Please insert specific response here]\n\nIf you have any further questions, please don't hesitate to contact us. We look forward to hearing from you.",
  zh: "感谢您的来函。\n\n关于您的咨询，请见以下回复：\n\n[请在此处填写具体回复内容]\n\n如有任何疑问，请随时与我们联系。期待为您服务。",
  ko: "문의해 주셔서 감사합니다.\n\n문의하신 내용에 대해 아래와 같이 답변 드립니다.\n\n[구체적인 답변 내용을 여기에 입력해 주세요]\n\n추가적인 질문이 있으시면 언제든지 연락 주시기 바랍니다.",
};

/** モックのユーザーリスト（将来は /api/users から取得） */
const MOCK_STAFF = [
  { id: 1, name: "佐藤 花子" },
  { id: 2, name: "田村 誠" },
  { id: 3, name: "中村 浩二" },
  { id: 4, name: "山田 太郎" },
];

interface AssigneeDropdownProps {
  currentAssignee?: string;
  onAssign: (name: string) => void;
  currentUserName: string | null;
  canAssign: boolean;
}

function AssigneeDropdown({ currentAssignee, onAssign, currentUserName, canAssign }: AssigneeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!canAssign) {
    return currentAssignee ? (
      <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
        <span className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white text-[9px] font-bold flex items-center justify-center">
          {getInitials(currentAssignee)}
        </span>
        担当: {currentAssignee}
      </span>
    ) : (
      <span className="text-xs text-slate-400">— 未担当</span>
    );
  }

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:border-[#1E3A8A]/40 transition-colors cursor-pointer"
      >
        {currentAssignee ? (
          <>
            <span className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white text-[9px] font-bold flex items-center justify-center">
              {getInitials(currentAssignee)}
            </span>
            <span className="text-slate-600">{currentAssignee}</span>
          </>
        ) : (
          <>
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">担当者を割当て</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-20 min-w-[160px]">
          {/* 自分に割当てショートカット */}
          {currentUserName && (
            <button
              onClick={() => { onAssign(currentUserName); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors border-b border-amber-100"
            >
              <UserPlus className="w-3.5 h-3.5" />
              自分に割当て（{currentUserName}）
            </button>
          )}
          {MOCK_STAFF.map((staff) => (
            <button
              key={staff.id}
              onClick={() => { onAssign(staff.name); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center">
                {getInitials(staff.name)}
              </span>
              {staff.name}
              {currentAssignee === staff.name && (
                <Check className="w-3 h-3 text-[#1E3A8A] ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  inquiry: InquiryOut | null;
  onClose: () => void;
  onStatusChange: (id: number, status: InquiryStatus) => void;
  onPriorityChange: (id: number, priority: InquiryPriority) => void;
  onRespond?: (id: number, responseText: string) => void;
  onAssigneeChange?: (id: number, assignee: string) => void;
  propertyId?: number;
}

export function InquirySlidePanel({ inquiry, onClose, onStatusChange, onPriorityChange, onRespond, onAssigneeChange }: Props) {
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiDraftText, setAiDraftText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { user, canAssign } = useCurrentUser();

  // パネルを開くたびに状態リセット
  useEffect(() => {
    setAiDraftOpen(false);
    setAiDraftText(null);
    setAiLoading(false);
    setReplyText("");
    setCopied(false);
    setSent(false);
  }, [inquiry?.id]);

  // Escape キーで閉じる
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isOpen = inquiry !== null;
  const fallbackDraft = LANG_REPLY_TEMPLATES[inquiry?.language ?? "ja"];

  const handleGenerateAiDraft = async () => {
    if (!inquiry) return;
    setAiDraftOpen(true);
    setAiLoading(true);
    setAiDraftText(null);
    try {
      const res = await generateAiReply({
        content_type: "inquiry",
        content: inquiry.content,
        language: (inquiry.language ?? "ja") as "ja" | "en" | "zh" | "ko" | "de",
      });
      setAiDraftText(res.reply);
    } catch {
      setAiDraftText(fallbackDraft);
    } finally {
      setAiLoading(false);
    }
  };

  const handleUseAIDraft = () => {
    setReplyText(aiDraftText ?? fallbackDraft);
    setAiDraftOpen(false);
  };

  const [mailSending, setMailSending] = useState(false);
  const [mailResult, setMailResult] = useState<"sent" | "simulated" | "failed" | null>(null);

  const handleSend = async () => {
    if (!replyText.trim() || !inquiry) return;
    setSent(true);
    onRespond?.(inquiry.id, replyText.trim());

    // メール送信（メールアドレスがある場合）
    if (inquiry.customerEmail) {
      setMailSending(true);
      try {
        const res = await sendMail({
          to_email: inquiry.customerEmail,
          to_name: inquiry.customerName,
          subject: `Re: ${inquiry.subject}`,
          body: replyText.trim(),
          inquiry_id: inquiry.id,
        });
        setMailResult(res.status === "failed" ? "failed" : res.status);
      } catch {
        setMailResult("failed");
      } finally {
        setMailSending(false);
      }
    }

    setTimeout(() => { setSent(false); setMailResult(null); }, 3000);
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* スライドパネル */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-[520px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {!inquiry ? null : (
          <>
            {/* パネルヘッダー */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%)" }}>
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex-shrink-0 mt-0.5 text-white">
                {CHANNEL_ICONS[inquiry.channel as InquiryChannel] ?? CHANNEL_ICONS.email}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight truncate">{inquiry.subject}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white/70 text-xs">{inquiry.customerName}</span>
                  <span className="text-white/40 text-[10px]">·</span>
                  <span className="text-white/60 text-xs">{CHANNEL_CONFIG[inquiry.channel as InquiryChannel].label}</span>
                  <span className="text-white/40 text-[10px]">·</span>
                  <span className="text-white/60 text-xs">{inquiry.date}</span>
                </div>
              </div>
              <button onClick={onClose}
                className="text-white/70 hover:text-white transition-colors cursor-pointer flex-shrink-0 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* スクロールコンテンツ */}
            <div className="flex-1 overflow-y-auto">

              {/* ステータス・優先度・担当者 */}
              <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-100 bg-slate-50/50">
                {/* ステータス */}
                <div className="relative group">
                  <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${STATUS_CONFIG[inquiry.status as InquiryStatus].color}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[inquiry.status as InquiryStatus].dot}`} />
                    {STATUS_CONFIG[inquiry.status as InquiryStatus].label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-10 hidden group-hover:block min-w-[120px]">
                    {(Object.entries(STATUS_CONFIG) as [InquiryStatus, typeof STATUS_CONFIG[InquiryStatus]][]).map(([key, cfg]) => (
                      <button key={key}
                        onClick={() => onStatusChange(inquiry.id, key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${inquiry.status === (key as string) ? "font-semibold" : ""}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 優先度 */}
                <div className="relative group">
                  <button className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${PRIORITY_CONFIG[inquiry.priority as InquiryPriority].color}`}>
                    優先度: {PRIORITY_CONFIG[inquiry.priority as InquiryPriority].label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-10 hidden group-hover:block min-w-[100px]">
                    {(Object.entries(PRIORITY_CONFIG) as [InquiryPriority, typeof PRIORITY_CONFIG[InquiryPriority]][]).map(([key, cfg]) => (
                      <button key={key}
                        onClick={() => onPriorityChange(inquiry.id, key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${inquiry.priority === key ? "font-semibold" : ""}`}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <AssigneeDropdown
                  currentAssignee={inquiry.assignee}
                  onAssign={(name) => onAssigneeChange?.(inquiry.id, name)}
                  currentUserName={user?.name ?? null}
                  canAssign={canAssign("review")}
                />
              </div>

              {/* 連絡先情報 */}
              {(inquiry.customerEmail || inquiry.customerPhone) && (
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4">
                  {inquiry.customerEmail && (
                    <a href={`mailto:${inquiry.customerEmail}`}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                      <Mail className="w-3.5 h-3.5" />
                      {inquiry.customerEmail}
                    </a>
                  )}
                  {inquiry.customerPhone && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <PhoneCall className="w-3.5 h-3.5" />
                      {inquiry.customerPhone}
                    </span>
                  )}
                </div>
              )}

              {/* 本文 */}
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">内容</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{inquiry.content}</p>
                {inquiry.tags && inquiry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {inquiry.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 既存の返信 */}
              {inquiry.response && (
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">送信済み返信</p>
                  <div className="pl-3 border-l-2 border-blue-200">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{inquiry.response}</p>
                  </div>
                </div>
              )}

              {/* 返信エリア（クローズ以外） */}
              {inquiry.status !== "closed" && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">返信を作成</p>

                  {/* AI返信案ボタン */}
                  <button
                    onClick={handleGenerateAiDraft}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border mb-3 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    style={aiDraftOpen
                      ? { background: "#1E3A8A", color: "white", borderColor: "#1E3A8A" }
                      : { background: "white", color: "#1E3A8A", borderColor: "#1E3A8A" }
                    }
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
                    {aiLoading ? "生成中..." : "AI返信案を生成"}
                    <span className="text-[10px] opacity-70 ml-1">Beta</span>
                  </button>

                  {/* AI ドラフト */}
                  {aiDraftOpen && (
                    <div className="mb-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-blue-700">AI 返信案 — GPT-4o</span>
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Beta</span>
                      </div>
                      {aiLoading ? (
                        <div className="bg-white rounded-lg p-2.5 border border-blue-100 space-y-2">
                          <div className="h-3 bg-blue-100 rounded animate-pulse w-full" />
                          <div className="h-3 bg-blue-100 rounded animate-pulse w-5/6" />
                          <div className="h-3 bg-blue-100 rounded animate-pulse w-4/6" />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-white rounded-lg p-2.5 border border-blue-100">
                          {aiDraftText ?? fallbackDraft}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleUseAIDraft}
                          disabled={aiLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer disabled:opacity-50"
                          style={{ background: "#1E3A8A" }}
                        >
                          <Check className="w-3 h-3" />
                          返信欄にコピー
                        </button>
                        <button
                          onClick={handleGenerateAiDraft}
                          disabled={aiLoading}
                          className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer px-2 py-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                        >
                          再生成
                        </button>
                      </div>
                    </div>
                  )}

                  {/* テキストエリア */}
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="返信内容を入力してください..."
                    rows={6}
                    className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 leading-relaxed placeholder:text-slate-300"
                  />

                  {/* 送信ボタン */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button
                      onClick={handleSend}
                      disabled={!replyText.trim() || sent || mailSending}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ background: sent ? "#16A34A" : "#1E3A8A" }}
                    >
                      {sent ? (
                        <><Check className="w-3.5 h-3.5" />送信しました</>
                      ) : inquiry?.customerEmail ? (
                        <><Send className="w-3.5 h-3.5" />返信してメール送信</>
                      ) : (
                        <><Send className="w-3.5 h-3.5" />返信を送信</>
                      )}
                    </button>
                    {mailResult === "sent" && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />メール送信完了
                      </span>
                    )}
                    {mailResult === "simulated" && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />返信記録済（メール未設定）
                      </span>
                    )}
                    {mailResult === "failed" && (
                      <span className="text-xs text-rose-500">メール送信に失敗しました</span>
                    )}
                    {copied && <span className="text-xs text-green-600">コピーしました</span>}
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
