"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TabNavBar } from "@/components/layout/TabNavBar";
import { ReviewSummaryTab } from "@/components/review/ReviewSummaryTab";
import { ReviewAnalyticsTab } from "@/components/review/ReviewAnalyticsTab";
import { InboxTab } from "@/components/review/InboxTab";

type ReviewTabId = "summary" | "inbox" | "analytics";

const TABS = [
  { id: "summary"   as ReviewTabId, label: "サマリー" },
  { id: "inbox"     as ReviewTabId, label: "口コミ・問い合わせ" },
  { id: "analytics" as ReviewTabId, label: "分析" },
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

      <TabNavBar tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as ReviewTabId)} equalWidth />

      {/* コンテンツ */}
      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {activeTab === "summary"   && <ReviewSummaryTab   propertyId={propertyId} />}
        {activeTab === "inbox"     && <InboxTab           propertyId={propertyId} />}
        {activeTab === "analytics" && <ReviewAnalyticsTab propertyId={propertyId} />}
      </main>
    </div>
  );
}
