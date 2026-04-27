"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TabNavBar } from "@/components/layout/TabNavBar";
import { useProperty } from "@/hooks/useProperty";
import { GuestStayList } from "@/components/front/GuestStayList";
import { FrontHomeTab } from "@/components/front/FrontHomeTab";
import { GuestAttributeAnalysis } from "@/components/front/GuestAttributeAnalysis";
import { UpsellPanel } from "@/components/front/UpsellPanel";
import { FrontSettingsPanel } from "@/components/settings/FrontSettingsPanel";

type FrontTabId = "home" | "front-desk" | "attributes" | "upsell" | "housekeeping" | "settings";

const TABS = [
  { id: "home"         as FrontTabId, label: "ホーム" },
  { id: "front-desk"   as FrontTabId, label: "フロントデスク" },
  { id: "attributes"   as FrontTabId, label: "来客属性分析" },
  { id: "upsell"       as FrontTabId, label: "アップセル" },
  { id: "housekeeping" as FrontTabId, label: "ハウスキーピング" },
  { id: "settings"     as FrontTabId, label: "設定", alignRight: true },
];

export default function ManagePage() {
  const [activeTab, setActiveTab] = useState<FrontTabId>("home");
  const [propertyId] = useProperty();
  const prevPropRef = useRef(propertyId);

  // プロパティ切り替え時にホームタブへリセット
  useEffect(() => {
    if (prevPropRef.current !== propertyId) {
      prevPropRef.current = propertyId;
      setActiveTab("home");
    }
  }, [propertyId]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <DashboardHeader />

      <TabNavBar tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as FrontTabId)} equalWidth />

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-brand-navy focus:shadow-lg focus:rounded-md">メインコンテンツへスキップ</a>

      <main id="main-content" className="max-w-[1400px] mx-auto px-6 py-5 w-full">
        {activeTab === "home"       && <FrontHomeTab key={propertyId} propertyId={propertyId} />}
        {activeTab === "front-desk" && <GuestStayList key={propertyId} propertyId={propertyId} />}
        {activeTab === "attributes" && <GuestAttributeAnalysis />}
        {activeTab === "upsell"     && <UpsellPanel />}

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
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-800">Front 設定</h2>
              <p className="text-xs text-slate-400 mt-0.5">チェックイン時刻・ハウスキーピング・部屋タイプ・アップセル設定を管理します</p>
            </div>
            <FrontSettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
}
