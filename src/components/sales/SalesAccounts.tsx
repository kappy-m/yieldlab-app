"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Search, Building2, ChevronRight, Star } from "lucide-react";

const ACCOUNTS = [
  { id: 1,  name: "三菱商事株式会社",         type: "法人",       tier: "プレミアム", contact: "人事部 山田 課長", deals: 8,  totalRevenue: 18500000, lastStay: "2026-04-10", status: "active" },
  { id: 2,  name: "NTTデータ株式会社",         type: "法人",       tier: "スタンダード", contact: "総務部 佐々木 様", deals: 5, totalRevenue: 11200000, lastStay: "2026-05-02", status: "active" },
  { id: 3,  name: "ソニーグループ株式会社",     type: "法人",       tier: "プレミアム", contact: "経営企画室 田中 部長", deals: 12, totalRevenue: 32000000, lastStay: "2026-06-08", status: "active" },
  { id: 4,  name: "JTB法人営業部",             type: "旅行代理店", tier: "スタンダード", contact: "法人部門 鈴木 担当", deals: 20, totalRevenue: 45000000, lastStay: "2026-05-03", status: "active" },
  { id: 5,  name: "東急エージェンシー",         type: "旅行代理店", tier: "スタンダード", contact: "旅行部 川村 様", deals: 15, totalRevenue: 28000000, lastStay: "2026-05-03", status: "active" },
  { id: 6,  name: "経済産業省",                 type: "官公庁",     tier: "スポット",   contact: "庶務担当 坂本 様", deals: 3,  totalRevenue: 2800000,  lastStay: "2026-04-25", status: "prospect" },
  { id: 7,  name: "株式会社サイバーエージェント", type: "法人",     tier: "スタンダード", contact: "人事部 早川 様", deals: 2,  totalRevenue: 3200000,  lastStay: "2026-05-15", status: "prospect" },
  { id: 8,  name: "日本建築学会",               type: "団体",       tier: "スポット",   contact: "事務局 西田 様", deals: 1,  totalRevenue: 0,        lastStay: "—",          status: "lost" },
];

const TIER_BADGE: Record<string, string> = {
  "プレミアム":   "text-violet-700 bg-violet-50 border border-violet-200",
  "スタンダード": "text-blue-600 bg-blue-50 border border-blue-200",
  "スポット":     "text-slate-500 bg-slate-50 border border-slate-200",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:   { label: "アクティブ",  cls: "text-green-600 bg-green-50 border border-green-200" },
  prospect: { label: "見込み",      cls: "text-amber-600 bg-amber-50 border border-amber-200" },
  lost:     { label: "失注",        cls: "text-red-400 bg-red-50 border border-red-200" },
};

function fmt(n: number) {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `¥${Math.round(n / 10_000)}万`;
  return n > 0 ? `¥${n.toLocaleString()}` : "—";
}

export function SalesAccounts({ propertyId: _propertyId }: { propertyId: number }) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const types = Array.from(new Set(ACCOUNTS.map(a => a.type)));

  const filtered = ACCOUNTS.filter(a =>
    (filterType === "all" || a.type === filterType) &&
    (query === "" || a.name.includes(query) || a.contact.includes(query))
  );

  return (
    <div className="space-y-5">
      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "総アカウント数", value: "64社", sub: "+2 今月新規" },
          { label: "プレミアム契約", value: "8社",  sub: "総売上の58%" },
          { label: "累計成約金額",   value: "¥141M", sub: "今年度" },
        ].map(stat => (
          <div key={stat.label} className="yl-card p-4">
            <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* 検索 + フィルター + リスト */}
      <div className="yl-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          {/* 検索 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="アカウント名・担当者名で検索"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          {/* タイプフィルター */}
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {["all", ...types].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  filterType === t ? "bg-white text-slate-800 font-semibold shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t === "all" ? "すべて" : t}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">該当するアカウントがありません</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(acc => {
              const status = STATUS_LABEL[acc.status]!;
              return (
                <div key={acc.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{acc.name}</span>
                          {acc.tier === "プレミアム" && <Star className="w-3 h-3 text-violet-400 fill-violet-400" />}
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0", TIER_BADGE[acc.tier])}>
                            {acc.tier}
                          </span>
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0", status.cls)}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span>{acc.type}</span>
                          <span>担当: {acc.contact}</span>
                          <span>成約 {acc.deals}件</span>
                          <span>最終利用: {acc.lastStay}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{fmt(acc.totalRevenue)}</p>
                        <p className="text-[10px] text-slate-400">累計売上</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] text-slate-400">
            {filtered.length}件表示 / 全64件 ・ フェーズ2でCRM連携・詳細ページを追加予定
          </p>
        </div>
      </div>
    </div>
  );
}
