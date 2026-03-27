"use client";

import { useState } from "react";
import { Save, CheckCircle2, Sliders, Bell, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommonSettingsLink } from "./CommonSettingsPanel";

type SubTab = "channels" | "notifications" | "cancellation";

const SUB_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "channels",      label: "OTA優先度・受付設定", icon: Sliders },
  { id: "notifications", label: "予約通知ルール",       icon: Bell },
  { id: "cancellation",  label: "キャンセルポリシー",   icon: Ban },
];

function SaveButton() {
  const [saved, setSaved] = useState(false);
  const handle = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="flex justify-end mt-6">
      <button
        onClick={handle}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
          saved ? "bg-green-50 text-green-700 border border-green-200" : "bg-[#1E3A8A] text-white hover:bg-[#1e3070]"
        )}
      >
        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? "保存しました" : "変更を保存"}
      </button>
    </div>
  );
}

const CHANNELS_CONFIG = [
  { name: "楽天トラベル",  priority: 1, enabled: true,  quota: 80 },
  { name: "Booking.com",  priority: 2, enabled: true,  quota: 60 },
  { name: "自社サイト",   priority: 3, enabled: true,  quota: 100 },
  { name: "Expedia",      priority: 4, enabled: true,  quota: 40 },
  { name: "じゃらん",     priority: 5, enabled: false, quota: 0 },
  { name: "一休.com",     priority: 6, enabled: false, quota: 0 },
];

function ChannelsPanel() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">チャネルごとの受付ON/OFFと割当上限室数を設定します。</p>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-8">優先</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">チャネル</th>
              <th className="text-center px-4 py-2.5 text-slate-500 font-medium">受付</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">割当上限</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS_CONFIG.map((ch) => (
              <tr key={ch.name} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 text-center">
                  <span className="text-slate-400 font-medium">{ch.priority}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-700 font-medium">{ch.name}</td>
                <td className="px-4 py-2.5 text-center">
                  <input type="checkbox" defaultChecked={ch.enabled} className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300 cursor-pointer" />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      defaultValue={ch.quota}
                      className="w-16 border border-slate-200 rounded px-2 py-1 text-right text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200"
                    />
                    <span className="text-slate-400">室</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" defaultChecked className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300" />
          <span className="text-sm text-slate-700">予約を自動確認する（手動承認を省略）</span>
        </label>
      </div>
      <SaveButton />
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">予約通知先</h3>
        <div className="space-y-3">
          {["新規予約", "修正・変更", "キャンセル", "問い合わせ"].map((type) => (
            <div key={type} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300 cursor-pointer" />
              <span className="flex-1 text-sm text-slate-700">{type}</span>
              <select className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-200">
                <option>即時</option>
                <option>1時間まとめ</option>
                <option>日次まとめ</option>
              </select>
            </div>
          ))}
        </div>
      </div>
      <SaveButton />
    </div>
  );
}

function CancellationPanel() {
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">キャンセルポリシーを設定します。このポリシーはOTA掲載ページに反映されます。</p>
      <div className="space-y-3">
        {[
          { label: "30日前まで",         value: "無料キャンセル" },
          { label: "29〜8日前",           value: "宿泊料金の20%" },
          { label: "7〜2日前",            value: "宿泊料金の50%" },
          { label: "前日・当日",          value: "宿泊料金の100%" },
          { label: "ノーショー",          value: "宿泊料金の100%" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-4">
            <span className="text-sm text-slate-600 w-32 flex-shrink-0">{row.label}</span>
            <input
              type="text"
              defaultValue={row.value}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>
      <SaveButton />
    </div>
  );
}

export function ReservationSettingsPanel() {
  const [activeTab, setActiveTab] = useState<SubTab>("channels");

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
                  ? "border-[#1E3A8A] text-[#1E3A8A]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "channels"      && <ChannelsPanel />}
      {activeTab === "notifications" && <NotificationsPanel />}
      {activeTab === "cancellation"  && <CancellationPanel />}

      <CommonSettingsLink />
    </div>
  );
}
