"use client";

import { Settings } from "lucide-react";
import { TabNavBar } from "@/components/layout/TabNavBar";

export type TabId = "overview" | "daily" | "booking" | "pricing" | "competitor" | "market" | "cost" | "budget" | "settings";

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

interface DashboardTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <TabNavBar
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(id) => onTabChange(id as TabId)}
    />
  );
}
