"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ReviewListTab } from "./ReviewListTab";
import { InquiryListTab } from "./InquiryListTab";
import { ConversationListTab } from "./ConversationListTab";
import { fetchConversations } from "@/lib/api";

type SubTab = "reviews" | "inquiries" | "chat";

export function InboxTab({ propertyId }: { propertyId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("reviews");
  const [unreadCount, setUnreadCount]   = useState(0);
  const notifPermRef = useRef(false);

  // チャットタブ初回クリック時に通知許可を求める
  const handleChatTabClick = () => {
    setActiveSubTab("chat");
    if (!notifPermRef.current && typeof Notification !== "undefined" && Notification.permission === "default") {
      notifPermRef.current = true;
      Notification.requestPermission().catch(() => {});
    }
  };

  // 30秒ポーリングで未読数を取得しバッジ更新
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchConversations(propertyId);
        if (!cancelled) setUnreadCount(data.unread_total);
      } catch {
        // サイレント失敗
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [propertyId]);

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-100 shadow-sm w-fit">
        {/* 口コミ */}
        <button
          onClick={() => setActiveSubTab("reviews")}
          className={cn(
            "flex flex-col items-start px-4 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer min-w-[120px]",
            activeSubTab === "reviews"
              ? "text-white shadow-sm bg-brand-navy"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          )}
        >
          <span className="text-xs font-semibold leading-none">口コミ</span>
          <span className={cn("text-[10px] mt-0.5 leading-none", activeSubTab === "reviews" ? "text-white/60" : "text-slate-400")}>
            Google / OTA
          </span>
        </button>

        {/* 問い合わせ */}
        <button
          onClick={() => setActiveSubTab("inquiries")}
          className={cn(
            "flex flex-col items-start px-4 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer min-w-[120px]",
            activeSubTab === "inquiries"
              ? "text-white shadow-sm bg-brand-navy"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          )}
        >
          <span className="text-xs font-semibold leading-none">問い合わせ</span>
          <span className={cn("text-[10px] mt-0.5 leading-none", activeSubTab === "inquiries" ? "text-white/60" : "text-slate-400")}>
            メール / フォーム / 電話
          </span>
        </button>

        {/* チャット (未読バッジ付き) */}
        <button
          onClick={handleChatTabClick}
          className={cn(
            "relative flex flex-col items-start px-4 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer min-w-[120px]",
            activeSubTab === "chat"
              ? "text-white shadow-sm bg-brand-navy"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          )}
        >
          <span className="text-xs font-semibold leading-none">チャット</span>
          <span className={cn("text-[10px] mt-0.5 leading-none", activeSubTab === "chat" ? "text-white/60" : "text-slate-400")}>
            ゲストメール
          </span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* コンテンツ */}
      {activeSubTab === "reviews"   && <ReviewListTab   propertyId={propertyId} />}
      {activeSubTab === "inquiries" && <InquiryListTab  propertyId={propertyId} />}
      {activeSubTab === "chat"      && <ConversationListTab propertyId={propertyId} onUnreadChange={setUnreadCount} />}
    </div>
  );
}
