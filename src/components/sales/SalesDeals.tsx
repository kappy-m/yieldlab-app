"use client";

import { useState } from "react";
import { Calendar, Users, Banknote, UserCircle, ChevronRight, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type DealStage = "proposal" | "negotiation" | "contract" | "won" | "lost";

interface Deal {
  id: string;
  lead_id: string;
  client_name: string;
  client_type: "agency" | "direct";
  contact_person: string;
  contact_email: string;
  pax: number;
  rooms: number;
  room_type: string;
  unit_price: number;
  total_amount: number;
  check_in: string;
  check_out: string;
  nights: number;
  purpose: string;
  stage: DealStage;
  assignee: string;
  next_action: string;
  next_action_date: string;
  memo: string;
}

const DEALS: Deal[] = [
  {
    id: "D001", lead_id: "L003", client_name: "東京第一高等学校", client_type: "direct",
    contact_person: "高橋 先生", contact_email: "takahashi@t1high.ed.jp",
    pax: 120, rooms: 40, room_type: "スタンダードツイン", unit_price: 15000, total_amount: 1800000,
    check_in: "2026-06-05", check_out: "2026-06-07", nights: 2, purpose: "修学旅行",
    stage: "proposal", assignee: "田中", next_action: "アレルギー対応メニュー送付",
    next_action_date: "2026-03-28", memo: "3食付き・バス3台・アレルギー対応",
  },
  {
    id: "D002", lead_id: "L002", client_name: "近畿日本ツーリスト", client_type: "agency",
    contact_person: "鈴木 花子", contact_email: "suzuki@knt.co.jp",
    pax: 30, rooms: 15, room_type: "スタンダードツイン", unit_price: 18000, total_amount: 540000,
    check_in: "2026-04-18", check_out: "2026-04-20", nights: 2, purpose: "観光",
    stage: "negotiation", assignee: "田中", next_action: "バス駐車場確認・回答",
    next_action_date: "2026-03-27", memo: "駐車場2台分確保要。朝食ビュッフェ",
  },
  {
    id: "D003", lead_id: "L001", client_name: "JTB法人東京支店", client_type: "agency",
    contact_person: "山田 太郎", contact_email: "yamada@jtb.co.jp",
    pax: 45, rooms: 20, room_type: "スタンダードツイン", unit_price: 22000, total_amount: 990000,
    check_in: "2026-05-10", check_out: "2026-05-12", nights: 2, purpose: "研修・会議",
    stage: "contract", assignee: "佐藤", next_action: "契約書最終確認・署名",
    next_action_date: "2026-03-30", memo: "会議室A+宴会場。AV機器レンタル",
  },
  {
    id: "D004", lead_id: "L004", client_name: "株式会社テックコープ", client_type: "direct",
    contact_person: "伊藤 部長", contact_email: "ito@techcorp.co.jp",
    pax: 20, rooms: 10, room_type: "スーペリアダブル", unit_price: 28000, total_amount: 280000,
    check_in: "2026-04-25", check_out: "2026-04-26", nights: 1, purpose: "研修・会議",
    stage: "won", assignee: "佐藤", next_action: "チェックイン案内メール送付",
    next_action_date: "2026-04-20", memo: "懇親会（和食）。個室希望",
  },
  {
    id: "D005", lead_id: "L005", client_name: "阪急交通社", client_type: "agency",
    contact_person: "渡辺 次郎", contact_email: "watanabe@hankyu.co.jp",
    pax: 60, rooms: 25, room_type: "デラックスツイン", unit_price: 25000, total_amount: 1500000,
    check_in: "2026-07-20", check_out: "2026-07-22", nights: 2, purpose: "観光",
    stage: "lost", assignee: "田中", next_action: "―",
    next_action_date: "―", memo: "競合ホテルに決定。次回改めてアプローチ",
  },
];

const STAGES: { id: DealStage; label: string; color: string; headerBg: string }[] = [
  { id: "proposal",    label: "提案中",   color: "text-blue-700",   headerBg: "bg-blue-50" },
  { id: "negotiation", label: "交渉中",   color: "text-orange-700", headerBg: "bg-orange-50" },
  { id: "contract",    label: "契約待ち", color: "text-violet-700", headerBg: "bg-violet-50" },
  { id: "won",         label: "成立",     color: "text-green-700",  headerBg: "bg-green-50" },
  { id: "lost",        label: "失注",     color: "text-slate-500",  headerBg: "bg-slate-100" },
];

function DaysUntil({ dateStr }: { dateStr: string }) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return <span className="text-red-500 text-[10px]">期限超過</span>;
  if (diff <= 7) return <span className="text-orange-500 text-[10px]">{diff}日後</span>;
  return <span className="text-slate-400 text-[10px]">{diff}日後</span>;
}

interface DealDetailProps {
  deal: Deal;
  onClose: () => void;
}

function DealDetail({ deal, onClose }: DealDetailProps) {
  const stage = STAGES.find((s) => s.id === deal.stage)!;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[420px] bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">{deal.client_name}</p>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block", stage.color, stage.headerBg)}>
              {stage.label}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-5">
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">基本情報</h4>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex justify-between"><span className="text-slate-400">担当者</span><span>{deal.contact_person}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">メール</span><a href={`mailto:${deal.contact_email}`} className="text-blue-600 hover:underline">{deal.contact_email}</a></div>
              <div className="flex justify-between"><span className="text-slate-400">目的</span><span>{deal.purpose}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">区分</span><span>{deal.client_type === "agency" ? "代理店" : "直販"}</span></div>
            </div>
          </section>
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">宿泊・金額</h4>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex justify-between"><span className="text-slate-400">宿泊日程</span><span>{deal.check_in} 〜 {deal.check_out}（{deal.nights}泊）</span></div>
              <div className="flex justify-between"><span className="text-slate-400">人数 / 部屋数</span><span>{deal.pax}名 / {deal.rooms}室</span></div>
              <div className="flex justify-between"><span className="text-slate-400">部屋タイプ</span><span>{deal.room_type}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">単価</span><span>¥{deal.unit_price.toLocaleString()}/室</span></div>
              <div className="flex justify-between font-semibold"><span className="text-slate-600">合計金額</span><span className="text-brand-navy">¥{deal.total_amount.toLocaleString()}</span></div>
            </div>
          </section>
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">次アクション</h4>
            <div className="bg-orange-50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-orange-800 font-medium">{deal.next_action}</p>
                <p className="text-xs text-orange-500 mt-0.5">{deal.next_action_date}</p>
              </div>
            </div>
          </section>
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">メモ</h4>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed">{deal.memo}</p>
          </section>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">編集</button>
            <button className="flex-1 py-2 rounded-lg bg-brand-navy text-white text-sm font-medium hover:bg-brand-navy/90 cursor-pointer">メール送信</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SalesDeals({ propertyId: _propertyId }: { propertyId: number }) {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const totalPipeline = DEALS.filter((d) => d.stage !== "lost").reduce((s, d) => s + d.total_amount, 0);
  const wonAmount = DEALS.filter((d) => d.stage === "won").reduce((s, d) => s + d.total_amount, 0);

  return (
    <div className="space-y-4">
      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">パイプライン総額</p>
          <p className="text-xl font-bold text-slate-800 mt-1">¥{(totalPipeline / 10000).toFixed(0)}万</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">成立金額（今月）</p>
          <p className="text-xl font-bold text-green-700 mt-1">¥{(wonAmount / 10000).toFixed(0)}万</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">成約率</p>
          <p className="text-xl font-bold text-brand-navy mt-1">
            {Math.round((DEALS.filter((d) => d.stage === "won").length / DEALS.filter((d) => d.stage !== "lost").length) * 100)}%
          </p>
        </div>
      </div>

      {/* カンバンボード */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const stageDeals = DEALS.filter((d) => d.stage === stage.id);
          return (
            <div key={stage.id} className="flex-shrink-0 w-64">
              <div className={cn("rounded-t-lg px-3 py-2 flex items-center justify-between", stage.headerBg)}>
                <span className={cn("text-xs font-semibold", stage.color)}>{stage.label}</span>
                <span className={cn("text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center bg-white", stage.color)}>
                  {stageDeals.length}
                </span>
              </div>
              <div className="bg-slate-50 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {stageDeals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="w-full bg-white rounded-lg border border-slate-100 p-3 text-left hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{deal.client_name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{deal.contact_person}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Users className="w-3 h-3" />{deal.pax}名
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Banknote className="w-3 h-3" />¥{(deal.total_amount / 10000).toFixed(0)}万
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Calendar className="w-3 h-3" />{deal.check_in}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <UserCircle className="w-3 h-3" />{deal.assignee}
                      </div>
                    </div>
                    {deal.next_action_date !== "―" && (
                      <div className="mt-1.5 flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 truncate flex-1">{deal.next_action}</p>
                        <DaysUntil dateStr={deal.next_action_date} />
                      </div>
                    )}
                    <ChevronRight className="w-3 h-3 text-slate-300 mt-1 ml-auto" />
                  </button>
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-center py-8 text-slate-300 text-xs">なし</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDeal && <DealDetail deal={selectedDeal} onClose={() => setSelectedDeal(null)} />}
    </div>
  );
}
