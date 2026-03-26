"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TabNavBar } from "@/components/layout/TabNavBar";
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import { SalesLeads } from "@/components/sales/SalesLeads";
import { SalesDeals } from "@/components/sales/SalesDeals";
import { SalesGroups } from "@/components/sales/SalesGroups";

type SalesTabId = "dashboard" | "leads" | "deals" | "groups";

const TABS = [
  { id: "dashboard" as SalesTabId, label: "ダッシュボード" },
  { id: "leads"     as SalesTabId, label: "リード" },
  { id: "deals"     as SalesTabId, label: "商談" },
  { id: "groups"    as SalesTabId, label: "グループ管理" },
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
      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {activeTab === "dashboard" && <SalesDashboard propertyId={propertyId} />}
        {activeTab === "leads"     && <SalesLeads     propertyId={propertyId} />}
        {activeTab === "deals"     && <SalesDeals     propertyId={propertyId} />}
        {activeTab === "groups"    && <SalesGroups    propertyId={propertyId} />}
      </main>
    </div>
  );
}
