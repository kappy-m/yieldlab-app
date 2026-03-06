"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardTabs, type TabId } from "@/components/layout/DashboardTabs";
import { DailyTab } from "@/components/tabs/DailyTab";
import { PricingTab } from "@/components/tabs/PricingTab";
import { CompetitorTab } from "@/components/tabs/CompetitorTab";
import { BookingTab } from "@/components/tabs/BookingTab";
import { MarketTab } from "@/components/tabs/MarketTab";
import { PlaceholderTab } from "@/components/tabs/PlaceholderTab";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("daily");
  const [propertyId, setPropertyId] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader propertyId={propertyId} onPropertyChange={setPropertyId} />
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {activeTab === "daily"      && <DailyTab propertyId={propertyId} />}
        {activeTab === "pricing"    && <PricingTab propertyId={propertyId} />}
        {activeTab === "competitor" && <CompetitorTab propertyId={propertyId} />}
        {activeTab === "booking"    && <BookingTab />}
        {activeTab === "market"     && <MarketTab propertyId={propertyId} />}
        {activeTab === "cost"       && <PlaceholderTab label="コスト分析" phase="Phase 3" />}
        {activeTab === "budget"     && <PlaceholderTab label="予算設定" phase="Phase 3" />}
      </main>
    </div>
  );
}
