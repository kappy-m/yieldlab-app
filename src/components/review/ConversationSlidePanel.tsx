"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Sparkles, Send, User, ChevronDown, Check, UserPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchConversation,
  markConversationRead,
  sendConversationMessage,
  generateConversationAiDraft,
  updateConversationAssignee,
  updateConversationStatus,
  type ConversationSummaryOut,
  type ConversationDetailOut,
  type MessageOut,
} from "@/lib/api";
import { useCurrentUser, getInitials } from "@/hooks/useCurrentUser";
import { useStaffList } from "@/hooks/useStaffList";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const LANG_FLAG: Record<string, string> = {
  en: "🇺🇸", zh: "🇨🇳", ko: "🇰🇷", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", ja: "🇯🇵",
};

const STATUS_CONFIG = {
  open:     { label: "対応中",   className: "bg-blue-100 text-blue-700 border-blue-200" },
  pending:  { label: "保留",     className: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "解決済み", className: "bg-slate-100 text-slate-500 border-slate-200" },
} as const;

type ConvStatus = "open" | "pending" | "resolved";

// ────────────────────────────────────────────────────────────────────────────
// AssigneeDropdown (chat 専用 — IDベース)
// ────────────────────────────────────────────────────────────────────────────

interface AssigneeDropdownProps {
  currentAssigneeId: number | null;
  currentAssigneeName: string | null;
  currentUserName: string | null;
  canAssign: boolean;
  onAssign: (id: number | null, name: string | null) => void;
}

function AssigneeDropdown({ currentAssigneeId, currentAssigneeName, currentUserName, canAssign, onAssign }: AssigneeDropdownProps) {
  const staffList = useStaffList();
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
    return currentAssigneeName ? (
      <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
        <span className="w-5 h-5 rounded-full bg-brand-navy text-white text-[9px] font-bold flex items-center justify-center">
          {getInitials(currentAssigneeName)}
        </span>
        担当: {currentAssigneeName}
      </span>
    ) : (
      <span className="text-xs text-slate-400">— 未担当</span>
    );
  }

  const myStaff = staffList.find(s => s.name === currentUserName);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:border-brand-navy/40 transition-colors cursor-pointer"
      >
        {currentAssigneeName ? (
          <>
            <span className="w-5 h-5 rounded-full bg-brand-navy text-white text-[9px] font-bold flex items-center justify-center">
              {getInitials(currentAssigneeName)}
            </span>
            <span className="text-slate-600">{currentAssigneeName}</span>
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
        <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-20 min-w-[180px]">
          {myStaff && (
            <button
              onClick={() => { onAssign(myStaff.id, myStaff.name); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors border-b border-amber-100"
            >
              <UserPlus className="w-3.5 h-3.5" />
              自分に割当て（{myStaff.name}）
            </button>
          )}
          {staffList.map(staff => (
            <button
              key={staff.id}
              onClick={() => { onAssign(staff.id, staff.name); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center">
                {getInitials(staff.name)}
              </span>
              {staff.name}
              {currentAssigneeId === staff.id && (
                <Check className="w-3 h-3 text-brand-navy ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MessageBubble
// ────────────────────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: MessageOut }) {
  const [translationOpen, setTranslationOpen] = useState(false);
  const flag = LANG_FLAG[msg.detected_language] ?? "🌐";
  const isInbound = msg.direction === "inbound";
  const showTranslationToggle = isInbound && msg.detected_language !== "ja";

  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[75%] space-y-1")}>
        {/* 言語バッジ */}
        <div className={cn("text-[10px] text-slate-400", isInbound ? "pl-1" : "pr-1 text-right")}>
          {flag} {msg.detected_language.toUpperCase()}
        </div>

        {/* バブル */}
        <div
          className={cn(
            "px-4 py-2.5 text-sm leading-relaxed",
            isInbound
              ? "bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm"
              : "bg-brand-navy text-white rounded-2xl rounded-br-sm"
          )}
        >
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>

          {/* outbound: 翻訳済みテキスト（ゲストに届く言語） */}
          {!isInbound && msg.translated_text && (
            <p className="mt-2 pt-2 border-t border-white/20 text-xs text-white/70 whitespace-pre-wrap break-words">
              → {msg.translated_text}
            </p>
          )}
        </div>

        {/* inbound: 日本語訳トグル */}
        {showTranslationToggle && (
          <div className="pl-1">
            <button
              onClick={() => setTranslationOpen(v => !v)}
              className="text-[11px] text-brand-navy hover:underline cursor-pointer"
            >
              💬 {translationOpen ? "日本語訳を閉じる" : "日本語訳を見る"}
            </button>
            {translationOpen && (
              <div className="mt-1 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed">
                {msg.translated_text ?? "翻訳を取得できませんでした"}
              </div>
            )}
          </div>
        )}

        {/* タイムスタンプ */}
        <div className={cn("text-[10px] text-slate-400", isInbound ? "pl-1" : "pr-1 text-right")}>
          {new Date(msg.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ConversationSlidePanel
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  conversation: ConversationSummaryOut;
  propertyId: number;
  onClose: () => void;
  onStatusChange: (id: number, status: ConvStatus) => void;
  onAssigneeChange: (id: number, assigneeId: number | null, assigneeName: string | null) => void;
}

export function ConversationSlidePanel({ conversation, propertyId, onClose, onStatusChange, onAssigneeChange }: Props) {
  const [detail, setDetail]           = useState<ConversationDetailOut | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [threadError, setThreadError]     = useState(false);
  const [replyText, setReplyText]     = useState("");
  const [sending, setSending]         = useState(false);
  const [sendError, setSendError]     = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiDraft, setAiDraft]         = useState<string | null>(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState(false);
  const [status, setStatus]           = useState<ConvStatus>(conversation.status);
  const [assigneeId, setAssigneeId]   = useState<number | null>(conversation.assignee_id);
  const [assigneeName, setAssigneeName] = useState<string | null>(conversation.assignee_name);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, canAssign: canAssignFn } = useCurrentUser();
  const canAssign = canAssignFn("review");

  const loadThread = useCallback(async () => {
    setThreadLoading(true);
    setThreadError(false);
    try {
      const [d] = await Promise.all([
        fetchConversation(propertyId, conversation.id),
        markConversationRead(propertyId, conversation.id),
      ]);
      setDetail(d);
    } catch {
      setThreadError(true);
    } finally {
      setThreadLoading(false);
    }
  }, [propertyId, conversation.id]);

  useEffect(() => {
    loadThread();
    setReplyText("");
    setAiDraftOpen(false);
    setAiDraft(null);
    setAiError(false);
    setSendError(false);
    setStatus(conversation.status);
    setAssigneeId(conversation.assignee_id);
    setAssigneeName(conversation.assignee_name);
  }, [conversation.id, loadThread, conversation.status, conversation.assignee_id, conversation.assignee_name]);

  // 新着メッセージが追加されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  // Escape キーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSend = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    setSendError(false);
    try {
      const msg = await sendConversationMessage(propertyId, conversation.id, replyText.trim());
      setDetail(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setReplyText("");
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateDraft = async () => {
    setAiDraftOpen(true);
    setAiLoading(true);
    setAiDraft(null);
    setAiError(false);
    try {
      const res = await generateConversationAiDraft(propertyId, conversation.id);
      setAiDraft(res.draft);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAdoptDraft = () => {
    if (aiDraft) setReplyText(aiDraft);
    setAiDraftOpen(false);
  };

  const handleAssign = async (id: number | null, name: string | null) => {
    setAssigneeId(id);
    setAssigneeName(name);
    try {
      await updateConversationAssignee(propertyId, conversation.id, id);
      onAssigneeChange(conversation.id, id, name);
    } catch {
      setAssigneeId(conversation.assignee_id);
      setAssigneeName(conversation.assignee_name);
    }
  };

  const handleStatusChange = async (s: ConvStatus) => {
    setStatus(s);
    try {
      await updateConversationStatus(propertyId, conversation.id, s);
      onStatusChange(conversation.id, s);
    } catch {
      setStatus(conversation.status);
    }
  };

  const conv = conversation;
  const flag = LANG_FLAG[conv.detected_language] ?? "🌐";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* パネル本体 */}
      <div
        role="dialog"
        aria-label="ゲストチャット"
        className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-white shadow-2xl z-50 flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{conv.guest_name}</span>
              {conv.room_no && (
                <span className="text-xs text-slate-400">{conv.room_no}号室</span>
              )}
              <span className="bg-slate-200 text-slate-600 text-[10px] font-mono px-1.5 py-0.5 rounded">
                {flag} {conv.detected_language.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* ステータス変更セレクター */}
              <select
                value={status}
                onChange={e => handleStatusChange(e.target.value as ConvStatus)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border font-medium cursor-pointer appearance-none",
                  statusCfg.className
                )}
              >
                <option value="open">対応中</option>
                <option value="pending">保留</option>
                <option value="resolved">解決済み</option>
              </select>
              {conv.guest_email && (
                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{conv.guest_email}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AssigneeDropdown
              currentAssigneeId={assigneeId}
              currentAssigneeName={assigneeName}
              currentUserName={user?.name ?? null}
              canAssign={canAssign}
              onAssign={handleAssign}
            />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* ── メッセージスレッド ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {threadLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {threadError && (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-400 text-sm">
              読み込みに失敗しました
              <button onClick={loadThread} className="text-xs text-brand-navy hover:underline cursor-pointer">
                再試行
              </button>
            </div>
          )}
          {!threadLoading && !threadError && detail?.messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── AI ドラフトパネル (折りたたみ) ── */}
        <div className="border-t border-slate-100">
          {!aiDraftOpen ? (
            <div className="px-4 py-2">
              <button
                onClick={handleGenerateDraft}
                className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                ✨ AIで返信を生成
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                AI 返信ドラフト
              </div>
              {aiLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  生成中...
                </div>
              )}
              {aiError && (
                <div className="space-y-1">
                  <p className="text-xs text-red-600">生成に失敗しました。もう一度お試しください。</p>
                  <button onClick={handleGenerateDraft} className="text-xs text-brand-navy hover:underline cursor-pointer">
                    再試行
                  </button>
                </div>
              )}
              {aiDraft && !aiLoading && (
                <>
                  <p className="text-sm text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-amber-100">
                    {aiDraft}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAdoptDraft}
                      className="text-xs px-3 py-1.5 bg-brand-navy text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      採用
                    </button>
                    <button
                      onClick={() => setAiDraftOpen(false)}
                      className="text-xs px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      閉じる
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Compose エリア ── */}
          <div className="px-4 py-3 space-y-2">
            {sendError && (
              <p className="text-xs text-red-600">送信に失敗しました。再度お試しください。</p>
            )}
            <div className="flex gap-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                }}
                placeholder="日本語で返信を入力… (⌘Enter で送信)"
                rows={3}
                className="flex-1 resize-none text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 placeholder:text-slate-300"
              />
              <button
                onClick={handleSend}
                disabled={!replyText.trim() || sending}
                className="self-end flex items-center justify-center w-10 h-10 rounded-xl bg-brand-navy text-white disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
