"use client";

import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "overview" | "daily" | "booking" | "pricing" | "competitor" | "market" | "cost" | "budget" | "settings";

const MAIN_TABS: { id: TabId; label: string }[] = [
  { id: "overview",   label: "ホーム" },
  { id: "booking",    label: "ブッキング分析" },
  { id: "pricing",    label: "プライシング管理" },
  { id: "competitor", label: "競合分析" },
  { id: "market",     label: "マーケット状況" },
  { id: "cost",       label: "コスト管理" },
  { id: "budget",     label: "予算管理" },
];

interface DashboardTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <nav className="sticky top-14 z-30 bg-white border-b border-slate-200 shadow-sm overflow-x-auto">
      <div className="flex items-center justify-between px-4 min-w-max">
        {/* メインタブ */}
        <div className="flex gap-0.5">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative px-3 py-3 text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap",
                activeTab === tab.id
                  ? "text-[#1E3A8A]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 rounded-t-md"
              )}
            >
              {tab.label}
              {/* アンダーラインを span で実装して transition を効かせる */}
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A8A] rounded-t transition-transform duration-200 origin-bottom",
                  activeTab === tab.id ? "scale-y-100" : "scale-y-0"
                )}
              />
            </button>
          ))}
        </div>

        {/* 設定タブ（右端） */}
        <button
          onClick={() => onTabChange("settings")}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ml-4",
            activeTab === "settings"
              ? "text-[#1E3A8A]"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/80 rounded-t-md"
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          設定
          <span
            className={cn(
              "absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A8A] rounded-t transition-transform duration-200 origin-bottom",
              activeTab === "settings" ? "scale-y-100" : "scale-y-0"
            )}
          />
        </button>
      </div>
    </nav>
  );
}
