"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import { SalesPipeline } from "@/components/sales/SalesPipeline";
import { SalesAccounts } from "@/components/sales/SalesAccounts";
import { cn } from "@/lib/utils";

type SalesTabId = "dashboard" | "pipeline" | "accounts";

const TABS: { id: SalesTabId; label: string }[] = [
  { id: "dashboard", label: "ダッシュボード" },
  { id: "pipeline",  label: "パイプライン" },
  { id: "accounts",  label: "アカウント管理" },
];

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTabId>("dashboard");
  const [propertyId, setPropertyId] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader
        propertyId={propertyId}
        onPropertyChange={(id) => {
          setPropertyId(id);
          setActiveTab("dashboard");
        }}
      />

      {/* タブナビゲーション */}
      <nav className="sticky top-14 z-30 bg-white border-b border-slate-200 shadow-sm px-6">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors duration-150 cursor-pointer",
                activeTab === tab.id
                  ? "text-[#1E3A8A]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 rounded-t-md"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A8A] rounded-t transition-transform duration-200 origin-bottom",
                  activeTab === tab.id ? "scale-x-100" : "scale-x-0"
                )}
              />
            </button>
          ))}
        </div>
      </nav>

      {/* コンテンツ */}
      <main className="px-6 py-6 max-w-7xl mx-auto">
        {activeTab === "dashboard" && <SalesDashboard propertyId={propertyId} />}
        {activeTab === "pipeline"  && <SalesPipeline  propertyId={propertyId} />}
        {activeTab === "accounts"  && <SalesAccounts  propertyId={propertyId} />}
      </main>
    </div>
  );
}
