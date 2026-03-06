"use client";

import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "daily" | "booking" | "pricing" | "competitor" | "market" | "cost" | "budget" | "settings";

const MAIN_TABS: { id: TabId; label: string }[] = [
  { id: "daily",      label: "デイリー" },
  { id: "booking",    label: "ブッキング分析" },
  { id: "pricing",    label: "プライシング管理" },
  { id: "competitor", label: "競合分析" },
  { id: "market",     label: "マーケット状況" },
];

interface DashboardTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 shadow-sm">
      <div className="flex items-center justify-between">
        {/* メインタブ */}
        <div className="flex gap-0.5">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer",
                activeTab === tab.id
                  ? "text-[#1E3A8A] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#1E3A8A] after:rounded-t"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 rounded-t-md"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 設定タブ（右端） */}
        <button
          onClick={() => onTabChange("settings")}
          className={cn(
            "relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer",
            activeTab === "settings"
              ? "text-[#1E3A8A] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#1E3A8A] after:rounded-t"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/80 rounded-t-md"
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          設定
        </button>
      </div>
    </nav>
  );
}
