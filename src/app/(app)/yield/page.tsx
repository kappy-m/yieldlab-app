"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TabNavBar } from "@/components/layout/TabNavBar";
import { useProperty } from "@/hooks/useProperty";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { DailyTab } from "@/components/tabs/DailyTab";
import { PricingTab } from "@/components/tabs/PricingTab";
import { CompetitorTab } from "@/components/tabs/CompetitorTab";
import { BookingTab } from "@/components/tabs/BookingTab";
import { MarketTab } from "@/components/tabs/MarketTab";
import { SettingsTab } from "@/components/tabs/SettingsTab";
import { CostTab } from "@/components/tabs/CostTab";
import { BudgetTab } from "@/components/tabs/BudgetTab";

type TabId = "overview" | "daily" | "booking" | "pricing" | "competitor" | "market" | "cost" | "budget" | "settings";

const VALID_TABS: TabId[] = [
  "overview", "daily", "booking", "pricing", "competitor", "market", "cost", "budget", "settings",
];

const TABS = [
  { id: "overview"   as TabId, label: "ホーム" },
  { id: "booking"    as TabId, label: "ブッキング分析" },
  { id: "pricing"    as TabId, label: "プライシング管理" },
  { id: "competitor" as TabId, label: "競合分析" },
  { id: "market"     as TabId, label: "マーケット状況" },
  { id: "cost"       as TabId, label: "コスト管理" },
  { id: "budget"     as TabId, label: "予算管理" },
  { id: "settings"   as TabId, label: "設定", icon: Settings, alignRight: true },
];

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabFromUrl = searchParams.get("tab") as TabId | null;
  const initialTab: TabId = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "overview";

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [propertyId] = useProperty();
  const prevPropRef = useRef(propertyId);

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab as TabId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // URL が外部から変わった場合（ブラウザ戻る/進む）に同期
  useEffect(() => {
    const tab = searchParams.get("tab") as TabId | null;
    if (tab && VALID_TABS.includes(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // プロパティ切り替え時に overview へリセット
  useEffect(() => {
    if (prevPropRef.current !== propertyId) {
      prevPropRef.current = propertyId;
      handleTabChange("overview");
    }
  }, [propertyId, handleTabChange]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader />
      <TabNavBar tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-brand-navy focus:shadow-lg focus:rounded-md">メインコンテンツへスキップ</a>

      {/* 条件付きレンダリング: useApiData の SWR キャッシュでタブ切替を高速化 */}
      <main id="main-content" className="max-w-[1400px] mx-auto px-6 py-5">
        {activeTab === "overview"   && <OverviewTab   key={propertyId} propertyId={propertyId} onTabChange={handleTabChange} />}
        {activeTab === "daily"      && <DailyTab      key={propertyId} propertyId={propertyId} />}
        {activeTab === "pricing"    && <PricingTab    key={propertyId} propertyId={propertyId} />}
        {activeTab === "competitor" && <CompetitorTab key={propertyId} propertyId={propertyId} />}
        {activeTab === "booking"    && <BookingTab    key={propertyId} propertyId={propertyId} />}
        {activeTab === "market"     && <MarketTab     key={propertyId} propertyId={propertyId} />}
        {activeTab === "cost"       && <CostTab       key={propertyId} propertyId={propertyId} />}
        {activeTab === "budget"     && <BudgetTab     key={propertyId} propertyId={propertyId} />}
        {activeTab === "settings"   && <SettingsTab   key={propertyId} propertyId={propertyId} />}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB]" />}>
      <DashboardInner />
    </Suspense>
  );
}
