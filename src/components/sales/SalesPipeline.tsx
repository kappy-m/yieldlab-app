"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Building2, Users, CalendarDays, ChevronRight } from "lucide-react";

// ----------------------------------------------------------------
// ダミーデータ
// ----------------------------------------------------------------
const PIPELINE_DEALS = [
  { id: 1,  stage: "リード",   name: "大手IT企業 オフサイト",        account: "株式会社サイバーエージェント", rooms: 30, nights: 2, revenue: 2100000, date: "2026-05-15", assignee: "田中 M", probability: 20 },
  { id: 2,  stage: "リード",   name: "経産省 視察団",                account: "経済産業省",               rooms: 15, nights: 1, revenue: 600000,  date: "2026-04-25", assignee: "佐藤 A", probability: 30 },
  { id: 3,  stage: "提案中",   name: "NTTデータ 社員旅行",           account: "NTTデータ株式会社",         rooms: 60, nights: 2, revenue: 4500000, date: "2026-05-02", assignee: "田中 M", probability: 60 },
  { id: 4,  stage: "提案中",   name: "旅行代理店 GWパッケージ",       account: "東急エージェンシー",         rooms: 40, nights: 3, revenue: 3600000, date: "2026-05-03", assignee: "鈴木 K", probability: 55 },
  { id: 5,  stage: "提案中",   name: "ウェディング 秋シーズン",       account: "山田 花子 様",             rooms: 25, nights: 1, revenue: 1800000, date: "2026-09-20", assignee: "佐藤 A", probability: 45 },
  { id: 6,  stage: "交渉中",   name: "ブライダルフェア 週末",         account: "鈴木 次郎 様",             rooms: 20, nights: 2, revenue: 1200000, date: "2026-04-18", assignee: "佐藤 A", probability: 75 },
  { id: 7,  stage: "交渉中",   name: "グローバル企業 役員合宿",      account: "ソニーグループ株式会社",      rooms: 12, nights: 3, revenue: 2400000, date: "2026-06-08", assignee: "田中 M", probability: 80 },
  { id: 8,  stage: "成約",     name: "三菱商事 春季研修合宿",        account: "三菱商事株式会社",           rooms: 45, nights: 3, revenue: 3800000, date: "2026-04-10", assignee: "田中 M", probability: 100 },
  { id: 9,  stage: "成約",     name: "旅行代理店 GW枠確保",          account: "JTB法人営業部",             rooms: 30, nights: 4, revenue: 5600000, date: "2026-05-03", assignee: "鈴木 K", probability: 100 },
  { id: 10, stage: "失注",     name: "学術学会 年次大会",            account: "日本建築学会",               rooms: 80, nights: 3, revenue: 0,       date: "2026-06-20", assignee: "佐藤 A", probability: 0 },
];

const STAGES = ["リード", "提案中", "交渉中", "成約", "失注"] as const;

const STAGE_META: Record<string, { cls: string; dotColor: string; count: number; value: number }> = {
  "リード":   { cls: "text-slate-600 bg-slate-100 border-slate-200", dotColor: "bg-slate-400", count: 0, value: 0 },
  "提案中":   { cls: "text-blue-600 bg-blue-50 border-blue-200",     dotColor: "bg-blue-400",  count: 0, value: 0 },
  "交渉中":   { cls: "text-amber-600 bg-amber-50 border-amber-200",  dotColor: "bg-amber-400", count: 0, value: 0 },
  "成約":     { cls: "text-green-600 bg-green-50 border-green-200",  dotColor: "bg-green-500", count: 0, value: 0 },
  "失注":     { cls: "text-red-500 bg-red-50 border-red-200",        dotColor: "bg-red-400",   count: 0, value: 0 },
};

function fmt(n: number) {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `¥${Math.round(n / 10_000)}万`;
  return `¥${n.toLocaleString()}`;
}

export function SalesPipeline({ propertyId: _propertyId }: { propertyId: number }) {
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  const assignees = Array.from(new Set(PIPELINE_DEALS.map(d => d.assignee)));

  const filtered = PIPELINE_DEALS.filter(d =>
    (filterStage === "all" || d.stage === filterStage) &&
    (filterAssignee === "all" || d.assignee === filterAssignee)
  );

  // ステージ別集計
  const stageSummary = STAGES.map(stage => ({
    stage,
    count: PIPELINE_DEALS.filter(d => d.stage === stage).length,
    value: PIPELINE_DEALS.filter(d => d.stage === stage).reduce((s, d) => s + d.revenue, 0),
    meta: STAGE_META[stage]!,
  }));

  const totalPipeline = PIPELINE_DEALS
    .filter(d => d.stage !== "失注" && d.stage !== "成約")
    .reduce((s, d) => s + d.revenue * d.probability / 100, 0);

  return (
    <div className="space-y-5">
      {/* ファネルサマリー */}
      <div className="yl-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">パイプラインファネル</h3>
            <p className="text-xs text-slate-400 mt-0.5">期待売上（確率加重）: <span className="font-semibold text-slate-700">{fmt(totalPipeline)}</span></p>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-end gap-1">
            {stageSummary.filter(s => s.stage !== "失注").map((s, idx, arr) => {
              const maxCount = Math.max(...arr.map(x => x.count), 1);
              const widthPct = Math.max((s.count / maxCount) * 100, 20);
              return (
                <button
                  key={s.stage}
                  onClick={() => setFilterStage(filterStage === s.stage ? "all" : s.stage)}
                  className={cn(
                    "flex flex-col items-center gap-1 cursor-pointer transition-all group flex-1",
                    filterStage === s.stage && "opacity-100",
                    filterStage !== "all" && filterStage !== s.stage && "opacity-40",
                  )}
                >
                  <span className="text-xs text-slate-500 font-medium">{s.count}件</span>
                  <div
                    className={cn("w-full rounded-t transition-all group-hover:opacity-80", {
                      "bg-slate-300": s.stage === "リード",
                      "bg-blue-400": s.stage === "提案中",
                      "bg-amber-400": s.stage === "交渉中",
                      "bg-green-500": s.stage === "成約",
                    })}
                    style={{ height: `${Math.max(widthPct * 0.5, 16)}px` }}
                  />
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border", s.meta.cls)}>{s.stage}</span>
                  <span className="text-[10px] text-slate-400">{fmt(s.value)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* フィルター + リスト */}
      <div className="yl-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-900">
            商談一覧
            <span className="text-xs font-normal text-slate-400 ml-2">{filtered.length}件</span>
          </h3>
          <div className="flex items-center gap-2">
            {/* ステージフィルター */}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
              {["all", ...STAGES].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStage(s)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-md transition-all cursor-pointer",
                    filterStage === s ? "bg-white text-slate-800 font-semibold shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {s === "all" ? "すべて" : s}
                </button>
              ))}
            </div>
            {/* 担当者フィルター */}
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">担当者: 全員</option>
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">該当する商談がありません</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(deal => {
              const meta = STAGE_META[deal.stage]!;
              return (
                <div key={deal.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", meta.dotColor)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{deal.name}</span>
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0", meta.cls)}>
                            {deal.stage}
                          </span>
                          {deal.stage !== "失注" && deal.stage !== "成約" && (
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              確度 {deal.probability}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{deal.account}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{deal.rooms}室 × {deal.nights}泊</span>
                          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{deal.date}</span>
                          <span>担当: {deal.assignee}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div>
                        <p className={cn("text-sm font-bold", deal.stage === "失注" ? "text-slate-300 line-through" : "text-slate-900")}>
                          {deal.revenue > 0 ? fmt(deal.revenue) : "—"}
                        </p>
                        {deal.stage !== "失注" && deal.stage !== "成約" && deal.revenue > 0 && (
                          <p className="text-[10px] text-slate-400">期待値 {fmt(deal.revenue * deal.probability / 100)}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
