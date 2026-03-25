"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ProductSidebar } from "@/components/layout/ProductSidebar";
import { ReservationList } from "@/components/reservation/ReservationList";
import { cn } from "@/lib/utils";

type ResTabId = "reservations" | "analytics" | "settings";

const TABS: { id: ResTabId; label: string }[] = [
  { id: "reservations", label: "予約管理" },
  { id: "analytics",   label: "分析" },
  { id: "settings",    label: "設定" },
];

export default function ReservationPage() {
  const [activeTab, setActiveTab] = useState<ResTabId>("reservations");
  const [propertyId, setPropertyId] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      <ProductSidebar />

      <div className="flex-1 min-w-0">
        <DashboardHeader
          propertyId={propertyId}
          onPropertyChange={(id) => {
            setPropertyId(id);
            setActiveTab("reservations");
          }}
        />

        {/* タブナビ */}
        <nav className="sticky top-14 z-30 bg-white border-b border-slate-200 shadow-sm overflow-x-auto">
          <div className="flex items-center px-4 min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap",
                  activeTab === tab.id
                    ? "text-[#1E3A8A]"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 rounded-t-md"
                )}
              >
                {tab.label}
                <span className={cn(
                  "absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A8A] rounded-t transition-transform duration-200 origin-bottom",
                  activeTab === tab.id ? "scale-y-100" : "scale-y-0"
                )} />
              </button>
            ))}
          </div>
        </nav>

        <main className="max-w-[1200px] mx-auto px-6 py-5">
          {activeTab === "reservations" && (
            <ReservationList propertyId={propertyId} />
          )}

          {activeTab === "analytics" && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-700 mb-1">予約分析</h2>
              <p className="text-sm text-slate-400 mb-4">チャネル別・期間別の予約分析</p>
              <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
                近日公開予定
              </span>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <h2 className="text-base font-semibold text-slate-700 mb-1">予約設定</h2>
              <p className="text-sm text-slate-400">OTA連携・通知設定など</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
