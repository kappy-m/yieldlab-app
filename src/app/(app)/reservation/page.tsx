"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TabNavBar } from "@/components/layout/TabNavBar";
import { ReservationList } from "@/components/reservation/ReservationList";
import { ReservationHomeTab } from "@/components/reservation/ReservationHomeTab";
import { ChannelAnalyticsTab } from "@/components/reservation/ChannelAnalyticsTab";
import { ReservationSettingsPanel } from "@/components/settings/ReservationSettingsPanel";

type ResTabId = "home" | "reservations" | "analytics" | "settings";

const TABS = [
  { id: "home"         as ResTabId, label: "ホーム" },
  { id: "reservations" as ResTabId, label: "予約管理" },
  { id: "analytics"    as ResTabId, label: "分析" },
  { id: "settings"     as ResTabId, label: "設定" },
];

export default function ReservationPage() {
  const [activeTab, setActiveTab] = useState<ResTabId>("home");
  const [propertyId, setPropertyId] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <DashboardHeader
        propertyId={propertyId}
        onPropertyChange={(id) => {
          setPropertyId(id);
          setActiveTab("home");
        }}
      />

      <TabNavBar tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as ResTabId)} equalWidth />

      <main className="max-w-[1400px] mx-auto px-6 py-5 w-full">
        {activeTab === "home"         && <ReservationHomeTab />}
        {activeTab === "reservations" && <ReservationList propertyId={propertyId} />}
        {activeTab === "analytics"    && <ChannelAnalyticsTab />}
        {activeTab === "settings"     && (
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-800">Reservation 設定</h2>
              <p className="text-xs text-slate-400 mt-0.5">OTA優先度・予約通知ルール・キャンセルポリシーを管理します</p>
            </div>
            <ReservationSettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
}
