"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { CommonSettingsPanel } from "@/components/settings/CommonSettingsPanel";

function SettingsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "hotel";

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader />
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-gray-900">共通設定</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            ホテル基本情報・OTA連携・ユーザー管理など全プロダクト共通の設定を管理します
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <CommonSettingsPanel initialTab={tab} />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-slate-400">読み込み中...</div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
