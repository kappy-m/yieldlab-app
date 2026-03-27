"use client";

import { useState } from "react";
import { Save, CheckCircle2, Clock, Home, BedDouble, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommonSettingsLink } from "./CommonSettingsPanel";

type SubTab = "basic" | "housekeeping" | "roomtypes" | "upsell";

const SUB_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "basic",        label: "基本設定",       icon: Clock },
  { id: "housekeeping", label: "ハウスキーピング", icon: Home },
  { id: "roomtypes",    label: "部屋タイプ",      icon: BedDouble },
  { id: "upsell",       label: "アップセル",      icon: TrendingUp },
];

function SaveButton({ onSave }: { onSave: () => void }) {
  const [saved, setSaved] = useState(false);
  const handle = () => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); };
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

function BasicPanel() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "チェックイン開始時刻", value: "15:00" },
          { label: "チェックアウト締切時刻", value: "11:00" },
          { label: "アーリーチェックイン開始", value: "12:00" },
          { label: "レイトチェックアウト最終", value: "14:00" },
        ].map((f) => (
          <div key={f.label}>
            <label className="block text-xs text-slate-500 mb-1.5">{f.label}</label>
            <input
              type="time"
              defaultValue={f.value}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1.5">フロント緊急連絡先</label>
        <input
          type="tel"
          defaultValue="03-1234-5678 (内線: 0)"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <SaveButton onSave={() => {}} />
    </div>
  );
}

function HousekeepingPanel() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "清掃開始時刻", value: "09:00" },
          { label: "清掃完了目標時刻", value: "14:00" },
        ].map((f) => (
          <div key={f.label}>
            <label className="block text-xs text-slate-500 mb-1.5">{f.label}</label>
            <input
              type="time"
              defaultValue={f.value}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1.5">シフト構成</label>
        <div className="space-y-2">
          {["早番 (07:00〜15:00)", "中番 (10:00〜18:00)", "遅番 (14:00〜22:00)"].map((shift) => (
            <label key={shift} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300" />
              <span className="text-sm text-slate-700">{shift}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <p className="text-xs text-amber-700">ハウスキーピング詳細機能は次フェーズでの本実装を予定しています</p>
      </div>
      <SaveButton onSave={() => {}} />
    </div>
  );
}

const ROOM_TYPES = [
  { id: "SDT", name: "スタンダードシングル", count: 30, baseRate: 12000 },
  { id: "DDT", name: "スタンダードダブル",   count: 40, baseRate: 18000 },
  { id: "TWN", name: "ツイン",              count: 25, baseRate: 20000 },
  { id: "SUP", name: "スーペリアダブル",     count: 15, baseRate: 28000 },
  { id: "DLX", name: "デラックス",          count: 8,  baseRate: 42000 },
  { id: "SUI", name: "スイート",            count: 2,  baseRate: 80000 },
];

function RoomTypesPanel() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">部屋タイプの定義とベースレートを管理します。</p>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">コード</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">部屋タイプ名</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">室数</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">ベースレート</th>
            </tr>
          </thead>
          <tbody>
            {ROOM_TYPES.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <span className="font-mono font-medium text-[#1E3A8A] text-[11px]">{r.id}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{r.name}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{r.count}室</td>
                <td className="px-4 py-2.5 text-right">
                  <input
                    type="number"
                    defaultValue={r.baseRate}
                    className="w-24 border border-slate-200 rounded px-2 py-1 text-right text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={() => {}} />
    </div>
  );
}

function UpsellSettingsPanel() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">アップグレード対象設定</h3>
        <div className="space-y-2">
          {[
            { from: "スタンダードシングル → スタンダードダブル", diff: 3000, enabled: true },
            { from: "スタンダードダブル → ツイン",              diff: 2000, enabled: true },
            { from: "ツイン → スーペリアダブル",                diff: 5000, enabled: true },
            { from: "スーペリアダブル → デラックス",            diff: 8000, enabled: false },
          ].map((item) => (
            <div key={item.from} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
              <input type="checkbox" defaultChecked={item.enabled} className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300 cursor-pointer" />
              <span className="flex-1 text-sm text-slate-700">{item.from}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">差額</span>
                <input
                  type="number"
                  defaultValue={item.diff}
                  className="w-20 border border-slate-200 rounded px-2 py-1 text-right text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
                <span className="text-xs text-slate-400">円〜</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">記念日検知設定</h3>
        <div className="space-y-2">
          {["誕生日", "結婚記念日", "ハネムーン", "入籍記念日"].map((occasion) => (
            <label key={occasion} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300" />
              <span className="text-sm text-slate-700">{occasion}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          予約備考欄・連携OTAのメモフィールドからキーワードを検知します
        </p>
      </div>
      <SaveButton onSave={() => {}} />
    </div>
  );
}

export function FrontSettingsPanel() {
  const [activeTab, setActiveTab] = useState<SubTab>("basic");

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

      {activeTab === "basic"        && <BasicPanel />}
      {activeTab === "housekeeping" && <HousekeepingPanel />}
      {activeTab === "roomtypes"    && <RoomTypesPanel />}
      {activeTab === "upsell"       && <UpsellSettingsPanel />}

      <CommonSettingsLink />
    </div>
  );
}
