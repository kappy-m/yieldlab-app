"use client";

import { useState } from "react";
import { Save, CheckCircle2, Users, Kanban, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommonSettingsLink } from "./CommonSettingsPanel";

type SubTab = "team" | "stages" | "discounts";

const SUB_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "team",      label: "担当者・チーム管理", icon: Users },
  { id: "stages",    label: "商談ステージ定義",   icon: Kanban },
  { id: "discounts", label: "団体割引テンプレート", icon: Percent },
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

const TEAM_MEMBERS = [
  { name: "村山 一樹",  role: "営業マネージャー", quota: 50,  email: "murayama@hotel.jp" },
  { name: "山本 次郎",  role: "営業担当",         quota: 30,  email: "yamamoto@hotel.jp" },
  { name: "中村 三郎",  role: "営業担当",         quota: 25,  email: "nakamura@hotel.jp" },
];

function TeamPanel() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="text-xs bg-[#1E3A8A] text-white px-3 py-1.5 rounded-lg hover:bg-[#1e3070] cursor-pointer font-medium">
          + メンバー追加
        </button>
      </div>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">氏名</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">ロール</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">月次ノルマ</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {TEAM_MEMBERS.map((m) => (
              <tr key={m.email} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700">{m.name}</p>
                  <p className="text-slate-400">{m.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{m.role}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      defaultValue={m.quota}
                      className="w-16 border border-slate-200 rounded px-2 py-1 text-right text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200"
                    />
                    <span className="text-slate-400">件</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button className="text-[#1E3A8A] hover:underline cursor-pointer">編集</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton />
    </div>
  );
}

const DEFAULT_STAGES = [
  { order: 1, name: "新規問い合わせ", color: "bg-slate-400",  win_rate: 10 },
  { order: 2, name: "提案中",        color: "bg-blue-500",   win_rate: 30 },
  { order: 3, name: "見積提出",      color: "bg-amber-500",  win_rate: 55 },
  { order: 4, name: "交渉中",        color: "bg-orange-500", win_rate: 70 },
  { order: 5, name: "受注",          color: "bg-green-500",  win_rate: 100 },
];

function StagesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">商談パイプラインのステージと各ステージのデフォルト受注確率を設定します。</p>
      {DEFAULT_STAGES.map((stage) => (
        <div key={stage.order} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
          <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", stage.color)} />
          <span className="w-6 text-xs text-slate-400 text-center">{stage.order}</span>
          <input
            type="text"
            defaultValue={stage.name}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              defaultValue={stage.win_rate}
              className="w-14 border border-slate-200 rounded px-2 py-1.5 text-right text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
        </div>
      ))}
      <SaveButton />
    </div>
  );
}

const DISCOUNT_TEMPLATES = [
  { name: "企業法人プラン",    rooms_min: 10, discount: 8,  extras: "朝食付き" },
  { name: "旅行会社パッケージ", rooms_min: 20, discount: 12, extras: "バス手配" },
  { name: "大型団体割引",      rooms_min: 40, discount: 18, extras: "宴会場無料" },
];

function DiscountsPanel() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="text-xs bg-[#1E3A8A] text-white px-3 py-1.5 rounded-lg hover:bg-[#1e3070] cursor-pointer font-medium">
          + テンプレート追加
        </button>
      </div>
      <div className="space-y-3">
        {DISCOUNT_TEMPLATES.map((t) => (
          <div key={t.name} className="border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="text"
                defaultValue={t.name}
                className="flex-1 text-sm font-medium text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">最少室数</label>
                <div className="flex items-center gap-1">
                  <input type="number" defaultValue={t.rooms_min} className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200" />
                  <span className="text-xs text-slate-400 flex-shrink-0">室〜</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">割引率</label>
                <div className="flex items-center gap-1">
                  <input type="number" defaultValue={t.discount} className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200" />
                  <span className="text-xs text-slate-400 flex-shrink-0">%</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">付帯サービス</label>
                <input type="text" defaultValue={t.extras} className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <SaveButton />
    </div>
  );
}

export function SalesSettingsPanel() {
  const [activeTab, setActiveTab] = useState<SubTab>("team");

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

      {activeTab === "team"      && <TeamPanel />}
      {activeTab === "stages"    && <StagesPanel />}
      {activeTab === "discounts" && <DiscountsPanel />}

      <CommonSettingsLink />
    </div>
  );
}
