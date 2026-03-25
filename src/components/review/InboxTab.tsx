"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ReviewListTab } from "./ReviewListTab";
import { InquiryListTab } from "./InquiryListTab";

type SubTab = "reviews" | "inquiries";

const SUB_TABS: { id: SubTab; label: string; description: string }[] = [
  { id: "reviews",   label: "口コミ",     description: "Google / OTA" },
  { id: "inquiries", label: "問い合わせ", description: "メール / フォーム / 電話" },
];

export function InboxTab({ propertyId }: { propertyId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("reviews");

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-100 shadow-sm w-fit">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "flex flex-col items-start px-4 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer min-w-[120px]",
              activeSubTab === tab.id
                ? "text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
            style={activeSubTab === tab.id ? { background: "#1E3A8A" } : {}}
          >
            <span className="text-xs font-semibold leading-none">{tab.label}</span>
            <span className={cn(
              "text-[10px] mt-0.5 leading-none",
              activeSubTab === tab.id ? "text-white/60" : "text-slate-400"
            )}>
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      {activeSubTab === "reviews"   && <ReviewListTab   propertyId={propertyId} />}
      {activeSubTab === "inquiries" && <InquiryListTab  propertyId={propertyId} />}
    </div>
  );
}
