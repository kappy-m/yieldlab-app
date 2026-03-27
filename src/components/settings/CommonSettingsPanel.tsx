"use client";

import { useState } from "react";
import {
  Building2, Globe, Users, Bell, ChevronRight,
  Save, Eye, EyeOff, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type CommonSubTab = "hotel" | "ota" | "users" | "notifications";

const SUB_TABS: { id: CommonSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "hotel",         label: "ホテル基本情報",     icon: Building2 },
  { id: "ota",           label: "OTA・チャネル連携", icon: Globe },
  { id: "users",         label: "ユーザー管理",       icon: Users },
  { id: "notifications", label: "通知・アラート",     icon: Bell },
];

// ────────────────────────────────────────────────────────────────────────────
// Hotel Basic Info Panel
// ────────────────────────────────────────────────────────────────────────────

function HotelInfoPanel() {
  const [saved, setSaved] = useState(false);
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">施設基本情報</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "施設名", value: "サンプルホテル東京", type: "text" },
            { label: "施設名（英語）", value: "Sample Hotel Tokyo", type: "text" },
            { label: "電話番号", value: "03-1234-5678", type: "tel" },
            { label: "メールアドレス", value: "info@samplehotel.co.jp", type: "email" },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs text-slate-500 mb-1.5">{f.label}</label>
              <input
                type={f.type}
                defaultValue={f.value}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1.5">住所</label>
            <input
              type="text"
              defaultValue="東京都千代田区丸の内1-1-1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">客室構成</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "総客室数", value: "120", unit: "室" },
            { label: "フロア数", value: "15", unit: "F" },
            { label: "チェックイン時刻", value: "15:00", unit: "" },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs text-slate-500 mb-1.5">{f.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={f.value}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {f.unit && <span className="text-xs text-slate-400 flex-shrink-0">{f.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
            saved
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-[#1E3A8A] text-white hover:bg-[#1e3070]"
          )}
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "保存しました" : "変更を保存"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OTA Panel
// ────────────────────────────────────────────────────────────────────────────

const OTA_CHANNELS = [
  { id: "rakuten",    name: "楽天トラベル",  color: "text-rose-600",   bg: "bg-rose-50",   status: "connected" as const },
  { id: "bookingcom", name: "Booking.com",  color: "text-blue-600",   bg: "bg-blue-50",   status: "connected" as const },
  { id: "expedia",    name: "Expedia",       color: "text-yellow-600", bg: "bg-yellow-50", status: "pending" as const },
  { id: "jalan",      name: "じゃらん",      color: "text-orange-600", bg: "bg-orange-50", status: "disconnected" as const },
  { id: "ikyu",       name: "一休.com",      color: "text-purple-600", bg: "bg-purple-50", status: "disconnected" as const },
];

function OtaPanel() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setShowKeys((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 mb-4">
        各OTAのAPIキーを設定します。接続状況はリアルタイムで確認できます。
      </p>
      {OTA_CHANNELS.map((ota) => (
        <div key={ota.id} className="border border-slate-100 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", ota.bg)}>
              <Globe className={cn("w-4 h-4", ota.color)} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{ota.name}</p>
            </div>
            <span className={cn(
              "text-xs px-2 py-1 rounded-full font-medium",
              ota.status === "connected"    && "bg-green-50 text-green-700",
              ota.status === "pending"      && "bg-amber-50 text-amber-700",
              ota.status === "disconnected" && "bg-slate-100 text-slate-500",
            )}>
              {ota.status === "connected" ? "接続済" : ota.status === "pending" ? "確認中" : "未接続"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type={showKeys[ota.id] ? "text" : "password"}
              defaultValue={ota.status === "connected" ? "sk_live_xxxxxxxxxxxxxxxxxxxx" : ""}
              placeholder="APIキーを入力..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              onClick={() => toggle(ota.id)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              {showKeys[ota.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-xs font-medium hover:bg-[#1e3070] cursor-pointer">
              {ota.status === "connected" ? "更新" : "接続"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Users Panel
// ────────────────────────────────────────────────────────────────────────────

const PRODUCTS = ["Yield", "Front", "Review", "Reservation", "Sales"] as const;

const USERS = [
  { id: 1, name: "村山 一樹",   email: "murayama@hotel.jp",  role: "admin",  products: ["Yield","Front","Review","Reservation","Sales"] },
  { id: 2, name: "田中 花子",   email: "tanaka@hotel.jp",    role: "manager",products: ["Front","Reservation"] },
  { id: 3, name: "鈴木 太郎",   email: "suzuki@hotel.jp",    role: "staff",  products: ["Front"] },
  { id: 4, name: "山本 次郎",   email: "yamamoto@hotel.jp",  role: "staff",  products: ["Sales","Reservation"] },
];

function UsersPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">ユーザーにプロダクトごとのアクセス権を付与します。</p>
        <button className="flex items-center gap-1.5 text-xs bg-[#1E3A8A] text-white px-3 py-1.5 rounded-lg hover:bg-[#1e3070] cursor-pointer font-medium">
          + ユーザー招待
        </button>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">ユーザー</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">ロール</th>
              {PRODUCTS.map((p) => (
                <th key={p} className="text-center px-3 py-2.5 text-slate-500 font-medium">{p}</th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {USERS.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700">{user.name}</p>
                  <p className="text-slate-400 mt-0.5">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium",
                    user.role === "admin"   && "bg-blue-50 text-blue-700",
                    user.role === "manager" && "bg-purple-50 text-purple-700",
                    user.role === "staff"   && "bg-slate-100 text-slate-600",
                  )}>
                    {user.role === "admin" ? "管理者" : user.role === "manager" ? "マネージャー" : "スタッフ"}
                  </span>
                </td>
                {PRODUCTS.map((p) => (
                  <td key={p} className="px-3 py-3 text-center">
                    {user.products.includes(p)
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                      : <span className="text-slate-200">―</span>
                    }
                  </td>
                ))}
                <td className="px-4 py-3">
                  <button className="text-xs text-[#1E3A8A] hover:underline cursor-pointer">編集</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Notifications Panel
// ────────────────────────────────────────────────────────────────────────────

function NotificationsPanel() {
  const [saved, setSaved] = useState(false);
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">メール通知</h3>
        <div className="space-y-3">
          {[
            { label: "通知先メールアドレス",  value: "alert@samplehotel.co.jp" },
            { label: "CCアドレス（任意）",    value: "" },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs text-slate-500 mb-1.5">{f.label}</label>
              <input
                type="email"
                defaultValue={f.value}
                placeholder={f.value ? undefined : "例: manager@hotel.co.jp"}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Slack連携</h3>
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Webhook URL</label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs text-slate-400 mt-1">Slack App の Incoming Webhooks URL を設定します</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">通知イベント設定</h3>
        <div className="space-y-2">
          {[
            { label: "新規予約",             checked: true },
            { label: "キャンセル",           checked: true },
            { label: "低評価レビュー (3以下)", checked: true },
            { label: "新規グループ問い合わせ", checked: true },
            { label: "デイリーサマリー",       checked: false },
          ].map((item) => (
            <label key={item.label} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                defaultChecked={item.checked}
                className="w-4 h-4 text-[#1E3A8A] rounded border-slate-300 cursor-pointer"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer">
          <AlertCircle className="w-3.5 h-3.5" /> テスト送信
        </button>
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
            saved
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-[#1E3A8A] text-white hover:bg-[#1e3070]"
          )}
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "保存しました" : "変更を保存"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

export function CommonSettingsPanel({ initialTab }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<CommonSubTab>(
    (initialTab as CommonSubTab) ?? "hotel"
  );

  return (
    <div className="space-y-0">
      {/* サブタブ */}
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

      {activeTab === "hotel"         && <HotelInfoPanel />}
      {activeTab === "ota"           && <OtaPanel />}
      {activeTab === "users"         && <UsersPanel />}
      {activeTab === "notifications" && <NotificationsPanel />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Common Settings Link Card (for use in product settings tabs)
// ────────────────────────────────────────────────────────────────────────────

export function CommonSettingsLink() {
  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">共通設定（全プロダクト共通）</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/settings?tab=hotel",  icon: Building2, label: "ホテル基本情報",    desc: "施設名・住所・客室構成" },
          { href: "/settings?tab=ota",    icon: Globe,     label: "OTA・チャネル連携", desc: "楽天・Booking.com 等" },
          { href: "/settings?tab=users",  icon: Users,     label: "ユーザー管理",       desc: "アクセス権・ロール設定" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E3A8A]/10">
                <Icon className="w-4 h-4 text-slate-500 group-hover:text-[#1E3A8A]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700">{item.label}</p>
                <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto flex-shrink-0 group-hover:text-slate-400" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
