"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchConversations, type ConversationSummaryOut } from "@/lib/api";
import { ConversationSlidePanel } from "./ConversationSlidePanel";

const LANG_FLAG: Record<string, string> = {
  en: "🇺🇸", zh: "🇨🇳", ko: "🇰🇷", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", ja: "🇯🇵",
};

const STATUS_CONFIG = {
  open:     { label: "対応中",   className: "bg-blue-100 text-blue-700" },
  pending:  { label: "保留",     className: "bg-amber-100 text-amber-700" },
  resolved: { label: "解決済み", className: "bg-slate-100 text-slate-500" },
} as const;

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3_600_000;
  if (diffH < 24) return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

interface Props {
  propertyId: number;
  onUnreadChange?: (count: number) => void;
}

export function ConversationListTab({ propertyId, onUnreadChange }: Props) {
  const [conversations, setConversations] = useState<ConversationSummaryOut[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [selected, setSelected]           = useState<ConversationSummaryOut | null>(null);
  const prevUnreadRef                     = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const data = await fetchConversations(propertyId);
      setConversations(data.items);

      // 未読増加時にブラウザ通知を発火
      if (data.unread_total > prevUnreadRef.current && prevUnreadRef.current > 0) {
        const newConvs = data.items.filter(c => c.unread_count > 0);
        if (newConvs.length > 0 && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const c = newConvs[0];
          new Notification("YieldLab — 新着ゲストメッセージ", {
            body: `${c.room_no ? c.room_no + "号室 (" : ""}${c.guest_name}${c.room_no ? ")" : ""}からメッセージが届きました`,
          });
        }
      }
      prevUnreadRef.current = data.unread_total;
      onUnreadChange?.(data.unread_total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [propertyId, onUnreadChange]);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleSelect = (conv: ConversationSummaryOut) => {
    setSelected(conv);
    // パネルを開いたら unread をローカルでも即時リセット（PATCH /read は ConversationSlidePanel 側で実行）
    setConversations(prev =>
      prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
    );
    const newTotal = conversations.reduce(
      (sum, c) => sum + (c.id === conv.id ? 0 : c.unread_count), 0
    );
    onUnreadChange?.(newTotal);
    prevUnreadRef.current = newTotal;
  };

  // ── LOADING ──
  if (loading) {
    return (
      <div role="list" className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
        <p className="text-sm">データの取得に失敗しました</p>
        <button
          onClick={() => load()}
          className="text-xs px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          再試行
        </button>
      </div>
    );
  }

  // ── EMPTY ──
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
        <Mail className="w-10 h-10 opacity-30" />
        <p className="text-sm text-center leading-relaxed">
          ゲストからのメッセージはまだありません。<br />
          メールが届くと自動で表示されます。
        </p>
      </div>
    );
  }

  // ── SUCCESS ──
  return (
    <>
      <div role="list" className="space-y-1">
        {conversations.map(conv => {
          const flag = LANG_FLAG[conv.detected_language] ?? "🌐";
          const status = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.open;
          const isUnread = conv.unread_count > 0;

          return (
            <button
              key={conv.id}
              role="listitem"
              onClick={() => handleSelect(conv)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 cursor-pointer hover:bg-slate-50 border-l-2",
                isUnread
                  ? "border-brand-navy bg-blue-50/40"
                  : "border-transparent"
              )}
            >
              {/* 言語バッジ */}
              <span className="flex-shrink-0 bg-slate-200 text-slate-600 text-[10px] font-mono px-1.5 py-0.5 rounded">
                {flag} {conv.detected_language.toUpperCase()}
              </span>

              {/* メイン情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold truncate", isUnread ? "text-slate-900" : "text-slate-700")}>
                    {conv.guest_name}
                    {conv.room_no && <span className="ml-1 text-slate-400 font-normal">{conv.room_no}号室</span>}
                  </span>
                  <span className={cn("flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium", status.className)}>
                    {status.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {conv.last_message_preview ?? "—"}
                </p>
              </div>

              {/* 右端: 担当者 + タイムスタンプ */}
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                {conv.assignee_name && (
                  <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-[9px] font-bold flex items-center justify-center">
                    {getInitials(conv.assignee_name)}
                  </span>
                )}
                <span className="text-[10px] text-slate-400">{formatTime(conv.last_message_at)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <ConversationSlidePanel
          conversation={selected}
          propertyId={propertyId}
          onClose={() => setSelected(null)}
          onStatusChange={(id, status) =>
            setConversations(prev => prev.map(c => c.id === id ? { ...c, status } : c))
          }
          onAssigneeChange={(id, assigneeId, assigneeName) =>
            setConversations(prev => prev.map(c => c.id === id ? { ...c, assignee_id: assigneeId, assignee_name: assigneeName } : c))
          }
        />
      )}
    </>
  );
}
