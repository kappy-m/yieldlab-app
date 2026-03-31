"use client";

import { useState } from "react";
import { MessageSquare, AlertTriangle, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommonSettingsLink } from "./CommonSettingsPanel";
import { SaveButton } from "@/components/shared/SaveButton";

type SubTab = "templates" | "alerts" | "platforms";

const SUB_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "templates", label: "返信テンプレート",       icon: MessageSquare },
  { id: "alerts",    label: "評価アラート閾値",       icon: AlertTriangle },
  { id: "platforms", label: "監視プラットフォーム",   icon: Monitor },
];

const DEFAULT_TEMPLATES = [
  {
    id: "positive",
    label: "高評価へのお礼",
    rating: "4-5点",
    body: `{guest_name}様\n\nこの度は{hotel_name}にご宿泊いただきありがとうございました。素晴らしいご評価をいただき、スタッフ一同大変うれしく思っております。またのご来館を心よりお待ちしております。`,
  },
  {
    id: "negative",
    label: "低評価への対応",
    rating: "1-3点",
    body: `{guest_name}様\n\nこの度はご不快をおかけして大変申し訳ございません。いただいたご意見を真摯に受け止め、改善に努めてまいります。ぜひ再度のご来館の機会をいただければ幸いです。`,
  },
  {
    id: "noshow",
    label: "未返信フォロー",
    rating: "全評価",
    body: `{guest_name}様\n\nご宿泊いただきありがとうございました。今後のサービス改善のため、是非ご評価・ご感想をお聞かせいただければ幸いです。`,
  },
];

function TemplatesPanel() {
  const [selected, setSelected] = useState("positive");

  return (
    <div className="flex gap-4">
      <div className="w-44 flex-shrink-0 space-y-1">
        {DEFAULT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer",
              selected === t.id ? "bg-brand-navy text-white" : "hover:bg-slate-50 text-slate-700"
            )}
          >
            <p className="font-medium text-[13px]">{t.label}</p>
            <p className={cn("text-[10px] mt-0.5", selected === t.id ? "text-blue-200" : "text-slate-400")}>
              {t.rating}
            </p>
          </button>
        ))}
        <button className="w-full text-center text-xs text-brand-navy hover:underline cursor-pointer px-3 py-2">
          + テンプレート追加
        </button>
      </div>
      <div className="flex-1">
        {DEFAULT_TEMPLATES.filter((t) => t.id === selected).map((t) => (
          <div key={t.id} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">テンプレート名</label>
              <input
                type="text"
                defaultValue={t.label}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">本文</label>
              <textarea
                defaultValue={t.body}
                rows={8}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                変数: {"{guest_name}"} {"{hotel_name}"} {"{check_in_date}"}
              </p>
            </div>
          </div>
        ))}
        <SaveButton />
      </div>
    </div>
  );
}

function AlertsPanel() {
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">設定した閾値を下回る評価が投稿された場合にアラートを送信します。</p>
      <div className="space-y-4">
        {[
          { platform: "楽天トラベル",  threshold: 3.5, enabled: true },
          { platform: "Booking.com",  threshold: 7.0, enabled: true },
          { platform: "Googleマップ",  threshold: 3.5, enabled: true },
          { platform: "TripAdvisor",  threshold: 3.0, enabled: false },
        ].map((item) => (
          <div key={item.platform} className="flex items-center gap-4 p-3 border border-slate-100 rounded-lg">
            <input type="checkbox" defaultChecked={item.enabled} className="w-4 h-4 text-brand-navy rounded border-slate-300 cursor-pointer" />
            <span className="flex-1 text-sm text-slate-700">{item.platform}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">閾値</span>
              <input
                type="number"
                defaultValue={item.threshold}
                step="0.5"
                className="w-16 border border-slate-200 rounded px-2 py-1.5 text-right text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
              <span className="text-xs text-slate-400">以下でアラート</span>
            </div>
          </div>
        ))}
      </div>
      <SaveButton />
    </div>
  );
}

function PlatformsPanel() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">レビューを収集するプラットフォームのAPI連携設定です。</p>
      {[
        { name: "楽天トラベル",  status: "connected",    note: "OTA設定と共有" },
        { name: "Booking.com",  status: "connected",    note: "OTA設定と共有" },
        { name: "Googleビジネス", status: "pending",     note: "Google API キーが必要" },
        { name: "TripAdvisor",  status: "disconnected", note: "TripAdvisor Management API" },
      ].map((p) => (
        <div key={p.name} className="flex items-center gap-3 p-4 border border-slate-100 rounded-xl">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">{p.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{p.note}</p>
          </div>
          <span className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            p.status === "connected"    && "bg-green-50 text-green-700",
            p.status === "pending"      && "bg-amber-50 text-amber-700",
            p.status === "disconnected" && "bg-slate-100 text-slate-500",
          )}>
            {p.status === "connected" ? "接続済" : p.status === "pending" ? "設定中" : "未接続"}
          </span>
          {p.status !== "connected" && (
            <button className="text-xs bg-brand-navy text-white px-3 py-1.5 rounded-lg hover:bg-brand-navy/90 cursor-pointer">
              設定
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReviewSettingsPanel() {
  const [activeTab, setActiveTab] = useState<SubTab>("templates");

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
                activeTab === tab.id
                  ? "border-brand-navy text-brand-navy"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "templates" && <TemplatesPanel />}
      {activeTab === "alerts"    && <AlertsPanel />}
      {activeTab === "platforms" && <PlatformsPanel />}

      <CommonSettingsLink />
    </div>
  );
}
