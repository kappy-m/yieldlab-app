"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useProperty } from "@/hooks/useProperty";
import { DashboardTabs, type TabId } from "@/components/layout/DashboardTabs";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { DailyTab } from "@/components/tabs/DailyTab";
import { PricingTab } from "@/components/tabs/PricingTab";
import { CompetitorTab } from "@/components/tabs/CompetitorTab";
import { BookingTab } from "@/components/tabs/BookingTab";
import { MarketTab } from "@/components/tabs/MarketTab";
import { SettingsTab } from "@/components/tabs/SettingsTab";
import { CostTab } from "@/components/tabs/CostTab";
import { BudgetTab } from "@/components/tabs/BudgetTab";

// URLに永続化するタブID一覧（overview がデフォルト）
const VALID_TABS: TabId[] = [
  "overview", "daily", "booking", "pricing", "competitor", "market", "cost", "budget", "settings",
];

// 常時マウントしてCSSで表示切り替えするタブ（overview は軽量なのでオンデマンドでよい）
const ALWAYS_MOUNTED_TABS: TabId[] = [
  "daily", "pricing", "competitor", "booking", "market", "settings", "cost", "budget",
];

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL の ?tab= からタブを復元、なければ overview をデフォルトに
  const tabFromUrl = searchParams.get("tab") as TabId | null;
  const initialTab: TabId = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "overview";

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [propertyId] = useProperty();
  const prevPropRef = useRef(propertyId);

  // タブ変更 → URL を同期（ブラウザ履歴を汚さないよう replace）
  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
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

  // プロパティ切り替え時に overview へリセット + URL同期
  useEffect(() => {
    if (prevPropRef.current !== propertyId) {
      prevPropRef.current = propertyId;
      handleTabChange("overview");
    }
  }, [propertyId, handleTabChange]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader />
      <DashboardTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* スキップリンク（キーボードユーザー向け） */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:border focus:border-[#1E3A8A] focus:rounded focus:text-[#1E3A8A] focus:text-sm font-medium"
      >
        メインコンテンツへスキップ
      </a>

      <main id="main-content" className="max-w-[1400px] mx-auto px-6 py-5">
        {/* Overview タブ（オンデマンドマウント） */}
        {activeTab === "overview" && (
          <OverviewTab
            key={propertyId}
            propertyId={propertyId}
            onTabChange={handleTabChange}
          />
        )}

        {/* 常時マウントタブ: CSSで表示切り替え（瞬時遷移） */}
        {ALWAYS_MOUNTED_TABS.map((tab) => (
          <div
            key={tab}
            className={activeTab === tab ? "block" : "hidden"}
            aria-hidden={activeTab !== tab}
          >
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB]" />}>
      <DashboardInner />
    </Suspense>
  );
}
