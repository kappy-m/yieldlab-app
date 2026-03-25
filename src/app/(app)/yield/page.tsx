"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardTabs, type TabId } from "@/components/layout/DashboardTabs";
import { DailyTab } from "@/components/tabs/DailyTab";
import { PricingTab } from "@/components/tabs/PricingTab";
import { CompetitorTab } from "@/components/tabs/CompetitorTab";
import { BookingTab } from "@/components/tabs/BookingTab";
import { MarketTab } from "@/components/tabs/MarketTab";
import { SettingsTab } from "@/components/tabs/SettingsTab";
import { CostTab } from "@/components/tabs/CostTab";
import { BudgetTab } from "@/components/tabs/BudgetTab";

// コンテンツ型タブは常にマウントしておき、CSSで表示/非表示を切り替える。
const ALWAYS_MOUNTED_TABS: TabId[] = [
  "daily", "pricing", "competitor", "booking", "market", "settings", "cost", "budget",
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("daily");
  const [propertyId, setPropertyId] = useState<number>(1);

  // JWT ガードは middleware.ts に一元化済み。client-side 二重チェック不要。

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader
        propertyId={propertyId}
        onPropertyChange={(id) => {
          setPropertyId(id);
          setActiveTab("daily");
        }}
      />
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {/* 常時マウントタブ: CSSで表示切り替え（瞬時遷移） */}
        {ALWAYS_MOUNTED_TABS.map((tab) => (
          <div
            key={tab}
            className={activeTab === tab ? "block" : "hidden"}
            aria-hidden={activeTab !== tab}
          >
            {/* key={propertyId} により物件変更時だけ再マウント（再フェッチ） */}
            {tab === "daily"      && <DailyTab      key={propertyId} propertyId={propertyId} />}
            {tab === "pricing"    && <PricingTab    key={propertyId} propertyId={propertyId} />}
            {tab === "competitor" && <CompetitorTab key={propertyId} propertyId={propertyId} />}
            {tab === "booking"    && <BookingTab    key={propertyId} propertyId={propertyId} />}
            {tab === "market"     && <MarketTab     key={propertyId} propertyId={propertyId} />}
            {tab === "settings"   && <SettingsTab   key={propertyId} propertyId={propertyId} />}
            {tab === "cost"       && <CostTab       key={propertyId} propertyId={propertyId} />}
            {tab === "budget"     && <BudgetTab     key={propertyId} propertyId={propertyId} />}
          </div>
        ))}
      </main>
    </div>
  );
}
