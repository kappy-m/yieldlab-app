"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TabNavBar } from "@/components/layout/TabNavBar";
import { ReviewSummaryTab } from "@/components/review/ReviewSummaryTab";
import { ReviewAnalyticsTab } from "@/components/review/ReviewAnalyticsTab";
import { InboxTab } from "@/components/review/InboxTab";
import { ReviewSettingsPanel } from "@/components/settings/ReviewSettingsPanel";

type ReviewTabId = "summary" | "inbox" | "analytics" | "settings";

const TABS = [
  { id: "summary"   as ReviewTabId, label: "ホーム" },
  { id: "inbox"     as ReviewTabId, label: "口コミ・問い合わせ" },
  { id: "analytics" as ReviewTabId, label: "分析" },
  { id: "settings"  as ReviewTabId, label: "設定", alignRight: true },
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

      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {activeTab === "summary"   && <ReviewSummaryTab   propertyId={propertyId} />}
        {activeTab === "inbox"     && <InboxTab           propertyId={propertyId} />}
        {activeTab === "analytics" && <ReviewAnalyticsTab propertyId={propertyId} />}
        {activeTab === "settings"  && (
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-800">Review 設定</h2>
              <p className="text-xs text-slate-400 mt-0.5">返信テンプレート・評価アラート・プラットフォーム連携を管理します</p>
            </div>
            <ReviewSettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
}
