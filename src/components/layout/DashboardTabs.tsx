"use client";

import { cn } from "@/lib/utils";

export type TabId = "daily" | "booking" | "pricing" | "competitor" | "market" | "cost" | "budget";

const TABS: { id: TabId; label: string; phase3?: boolean }[] = [
  { id: "daily", label: "デイリー" },
  { id: "booking", label: "ブッキング分析" },
  { id: "pricing", label: "プライシング管理" },
  { id: "competitor", label: "競合分析" },
  { id: "market", label: "マーケット状況" },
  // Phase 3 タブは実装完了後に表示
  // { id: "cost", label: "コスト分析", phase3: true },
  // { id: "budget", label: "予算設定", phase3: true },
];

interface DashboardTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <nav className="bg-white border-b border-gray-200 px-6">
      <div className="flex gap-1 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer",
              activeTab === tab.id
                ? "bg-white shadow-sm border border-gray-200 text-gray-900"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
