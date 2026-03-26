"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { GuestStayList } from "@/components/front/GuestStayList";
import { cn } from "@/lib/utils";

type FrontTabId = "front-desk" | "housekeeping" | "settings";

const TABS: { id: FrontTabId; label: string }[] = [
  { id: "front-desk",   label: "フロントデスク" },
  { id: "housekeeping", label: "ハウスキーピング" },
  { id: "settings",     label: "設定" },
];

export default function ManagePage() {
  const [activeTab, setActiveTab] = useState<FrontTabId>("front-desk");
  const [propertyId, setPropertyId] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <DashboardHeader
          propertyId={propertyId}
          onPropertyChange={(id) => {
            setPropertyId(id);
            setActiveTab("front-desk");
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
          {activeTab === "front-desk" && (
            <GuestStayList propertyId={propertyId} />
          )}

          {activeTab === "housekeeping" && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-700 mb-1">ハウスキーピング管理</h2>
              <p className="text-sm text-slate-400 mb-4">客室清掃状況の管理と割り当て</p>
              <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
                近日公開予定
              </span>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-700 mb-1">Front 設定</h2>
              <p className="text-sm text-slate-400">フロントデスクの設定と管理</p>
            </div>
          )}
        </main>
    </div>
  );
}
