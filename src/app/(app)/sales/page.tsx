"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TabNavBar } from "@/components/layout/TabNavBar";
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import { SalesLeads } from "@/components/sales/SalesLeads";
import { SalesDeals } from "@/components/sales/SalesDeals";
import { SalesGroups } from "@/components/sales/SalesGroups";
import { SalesSettingsPanel } from "@/components/settings/SalesSettingsPanel";

type SalesTabId = "dashboard" | "leads" | "deals" | "groups" | "settings";

const TABS = [
  { id: "dashboard" as SalesTabId, label: "ホーム" },
  { id: "leads"     as SalesTabId, label: "リード" },
  { id: "deals"     as SalesTabId, label: "商談" },
  { id: "groups"    as SalesTabId, label: "グループ管理" },
  { id: "settings"  as SalesTabId, label: "設定", alignRight: true },
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
      <TabNavBar tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as SalesTabId)} equalWidth />
      <main className="max-w-[1400px] mx-auto px-6 py-5 w-full">
        {activeTab === "dashboard" && <SalesDashboard propertyId={propertyId} />}
        {activeTab === "leads"     && <SalesLeads     propertyId={propertyId} />}
        {activeTab === "deals"     && <SalesDeals     propertyId={propertyId} />}
        {activeTab === "groups"    && <SalesGroups    propertyId={propertyId} />}
        {activeTab === "settings"  && (
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-800">Sales 設定</h2>
              <p className="text-xs text-slate-400 mt-0.5">担当者・商談ステージ・団体割引テンプレートを管理します</p>
            </div>
            <SalesSettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
}
