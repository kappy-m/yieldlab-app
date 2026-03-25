"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ReviewSummaryTab } from "@/components/review/ReviewSummaryTab";
import { ReviewListTab } from "@/components/review/ReviewListTab";
import { ReviewAnalyticsTab } from "@/components/review/ReviewAnalyticsTab";
import { InquiryListTab } from "@/components/review/InquiryListTab";
import { cn } from "@/lib/utils";

type ReviewTabId = "summary" | "list" | "analytics" | "inquiry";

const TABS: { id: ReviewTabId; label: string }[] = [
  { id: "summary",   label: "サマリー" },
  { id: "list",      label: "口コミ一覧" },
  { id: "analytics", label: "分析" },
  { id: "inquiry",   label: "問い合わせ" },
];

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState<ReviewTabId>("summary");
  const [propertyId, setPropertyId] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader
        propertyId={propertyId}
        onPropertyChange={(id) => {
          setPropertyId(id);
          setActiveTab("summary");
        }}
      />

      {/* タブナビゲーション */}
      <nav className="sticky top-14 z-30 bg-white border-b border-slate-200 shadow-sm px-6">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors duration-150 cursor-pointer",
                activeTab === tab.id
                  ? "text-[#1E3A8A]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 rounded-t-md"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A8A] rounded-t transition-transform duration-200 origin-bottom",
                  activeTab === tab.id ? "scale-y-100" : "scale-y-0"
                )}
              />
            </button>
          ))}
        </div>
      </nav>

      {/* コンテンツ */}
      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {activeTab === "summary"   && <ReviewSummaryTab   propertyId={propertyId} />}
        {activeTab === "list"      && <ReviewListTab      propertyId={propertyId} />}
        {activeTab === "analytics" && <ReviewAnalyticsTab propertyId={propertyId} />}
        {activeTab === "inquiry"   && <InquiryListTab     propertyId={propertyId} />}
      </main>
    </div>
  );
}
