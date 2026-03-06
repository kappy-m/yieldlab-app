"use client";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { SettingsTab } from "@/components/tabs/SettingsTab";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader propertyId={1} onPropertyChange={() => {}} />
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-gray-900">設定</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            ダッシュボードの「設定」タブから物件ごとの設定を管理できます
          </p>
        </div>
        <SettingsTab propertyId={1} />
      </div>
    </div>
  );
}
