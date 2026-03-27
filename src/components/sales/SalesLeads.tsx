"use client";

import { useState } from "react";
import {
  Plus, Search, Filter, Building2, Users, Mail, Phone,
  ChevronRight, Calendar, MessageSquare, X, Send, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser, getInitials } from "@/hooks/useCurrentUser";
import type { SalesRole } from "@/lib/api";

// ────────────────────────────────────────────────────────────────────────────
// SalesRoleBadge — ロール表示バッジ
// ────────────────────────────────────────────────────────────────────────────

const SALES_ROLE_META: Record<SalesRole, { label: string; bg: string; text: string; border: string }> = {
  sales_manager:    { label: "営業",    bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  booking_staff:    { label: "予約担当", bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  revenue_manager:  { label: "Revenue", bg: "bg-[#1E3A8A]/10", text: "text-[#1E3A8A]", border: "border-[#1E3A8A]/20" },
};

function SalesRoleBadge({ role }: { role: SalesRole }) {
  const meta = SALES_ROLE_META[role];
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
      meta.bg, meta.text, meta.border
    )}>
      {meta.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AssigneeBadge — 担当者アバター
// ────────────────────────────────────────────────────────────────────────────

function LeadAssigneeBadge({ name }: { name: string }) {
  const isUnassigned = !name || name === "未割当";
  if (isUnassigned) return <span className="text-xs text-slate-400">— 未割当</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
        {getInitials(name)}
      </span>
      <span className="text-xs text-slate-600">{name}</span>
    </span>
  );
}

type ClientType = "agency" | "direct";
type LeadStatus = "new" | "responding" | "proposed" | "closed_won" | "closed_lost";
type Purpose = "観光" | "修学旅行" | "研修・会議" | "スポーツ合宿" | "婚礼・宴会" | "その他";

interface Lead {
  id: string;
  created_at: string;
  client_name: string;
  client_type: ClientType;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  pax: number;
  check_in: string;
  check_out: string;
  nights: number;
  purpose: Purpose;
  status: LeadStatus;
  notes: string;
  assignee: string;
}

const LEADS: Lead[] = [
  {
    id: "L001", created_at: "2026-03-24", client_name: "JTB法人東京支店", client_type: "agency",
    contact_person: "山田 太郎", contact_email: "yamada@jtb.co.jp", contact_phone: "03-1234-5678",
    pax: 45, check_in: "2026-05-10", check_out: "2026-05-12", nights: 2,
    purpose: "研修・会議", status: "new", notes: "会議室+宴会場の見積もり依頼あり", assignee: "佐藤",
  },
  {
    id: "L002", created_at: "2026-03-22", client_name: "近畿日本ツーリスト", client_type: "agency",
    contact_person: "鈴木 花子", contact_email: "suzuki@knt.co.jp", contact_phone: "06-9876-5432",
    pax: 30, check_in: "2026-04-18", check_out: "2026-04-20", nights: 2,
    purpose: "観光", status: "responding", notes: "ツインルーム指定。バス駐車場要確認", assignee: "田中",
  },
  {
    id: "L003", created_at: "2026-03-20", client_name: "東京第一高等学校", client_type: "direct",
    contact_person: "高橋 先生", contact_email: "takahashi@t1high.ed.jp", contact_phone: "03-5555-1234",
    pax: 120, check_in: "2026-06-05", check_out: "2026-06-07", nights: 2,
    purpose: "修学旅行", status: "proposed", notes: "3食付きプラン要望。アレルギー対応必須", assignee: "田中",
  },
  {
    id: "L004", created_at: "2026-03-18", client_name: "株式会社テックコープ", client_type: "direct",
    contact_person: "伊藤 部長", contact_email: "ito@techcorp.co.jp", contact_phone: "03-8888-9999",
    pax: 20, check_in: "2026-04-25", check_out: "2026-04-26", nights: 1,
    purpose: "研修・会議", status: "closed_won", notes: "会議室フル利用。懇親会あり", assignee: "佐藤",
  },
  {
    id: "L005", created_at: "2026-03-15", client_name: "阪急交通社", client_type: "agency",
    contact_person: "渡辺 次郎", contact_email: "watanabe@hankyu.co.jp", contact_phone: "06-1111-2222",
    pax: 60, check_in: "2026-07-20", check_out: "2026-07-22", nights: 2,
    purpose: "観光", status: "closed_lost", notes: "競合ホテルに決定", assignee: "田中",
  },
  {
    id: "L006", created_at: "2026-03-25", client_name: "〇〇大学体育会", client_type: "direct",
    contact_person: "中村 監督", contact_email: "nakamura@univ.ac.jp", contact_phone: "045-333-4444",
    pax: 35, check_in: "2026-08-10", check_out: "2026-08-13", nights: 3,
    purpose: "スポーツ合宿", status: "new", notes: "朝食早め対応・洗濯機使用希望", assignee: "未割当",
  },
];

const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new:         { label: "新規",   color: "text-blue-700",  bg: "bg-blue-50" },
  responding:  { label: "対応中", color: "text-orange-700", bg: "bg-orange-50" },
  proposed:    { label: "提案済", color: "text-violet-700", bg: "bg-violet-50" },
  closed_won:  { label: "商談化", color: "text-green-700",  bg: "bg-green-50" },
  closed_lost: { label: "失注",   color: "text-slate-500",  bg: "bg-slate-100" },
};

const CLIENT_TYPE_META: Record<ClientType, { label: string; icon: typeof Building2 }> = {
  agency: { label: "代理店", icon: Building2 },
  direct: { label: "直販",   icon: Users },
};

interface QuickReplyModalProps {
  lead: Lead;
  onClose: () => void;
}

function QuickReplyModal({ lead, onClose }: QuickReplyModalProps) {
  const [body, setBody] = useState(
    `${lead.contact_person} 様\n\nこの度はお問い合わせいただきありがとうございます。\n${lead.check_in}〜${lead.check_out}（${lead.nights}泊）、${lead.pax}名様のご宿泊につきまして、喜んで対応させていただきます。\n\n詳細につきまして、改めてご連絡させていただきます。\n\nどうぞよろしくお願いいたします。`
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-800">返信メール作成</p>
            <p className="text-xs text-slate-400 mt-0.5">宛先: {lead.contact_email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">件名</label>
            <input
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              defaultValue={`【${lead.purpose}】${lead.check_in}〜 ${lead.pax}名 お見積りについて`}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">本文</label>
            <textarea
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-slate-400">※ 実際の送信はResend API連携後に有効になります</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer">キャンセル</button>
          <button className="text-sm px-4 py-2 rounded-lg bg-[#1E3A8A] text-white font-medium hover:bg-[#1e3070] cursor-pointer flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> 送信（スタブ）
          </button>
        </div>
      </div>
    </div>
  );
}

export function SalesLeads({ propertyId: _propertyId }: { propertyId: number }) {
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [filterType, setFilterType] = useState<ClientType | "all">("all");
  const [replyTarget, setReplyTarget] = useState<Lead | null>(null);
  const { salesRole, user } = useCurrentUser();

  /**
   * ロールベースのアクション可否。
   * salesRole が null（未設定 or 汎用ロール）の場合は全機能を表示して後方互換を維持。
   */
  const canCreateLead   = !salesRole || salesRole === "sales_manager";
  const canConfirmBooking = !salesRole || salesRole === "booking_staff";
  const canViewRevenue  = !salesRole || salesRole === "revenue_manager";

  const filtered = LEADS.filter((l) => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterType !== "all" && l.client_type !== filterType) return false;
    if (query && !l.client_name.includes(query) && !l.contact_person.includes(query)) return false;
    return true;
  });

  const counts = Object.fromEntries(
    (Object.keys(STATUS_META) as LeadStatus[]).map((s) => [s, LEADS.filter((l) => l.status === s).length])
  );

  return (
    <div className="space-y-4">
      {/* ステータスサマリー */}
      <div className="grid grid-cols-5 gap-3">
        {(Object.entries(STATUS_META) as [LeadStatus, typeof STATUS_META[LeadStatus]][]).map(([status, meta]) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
            className={cn(
              "bg-white rounded-xl border p-3 text-left transition-all cursor-pointer",
              filterStatus === status ? "border-[#1E3A8A] ring-1 ring-[#1E3A8A]/20" : "border-slate-100 hover:border-slate-200"
            )}
          >
            <p className="text-xs text-slate-400">{meta.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{counts[status] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* 検索・フィルター */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="会社名・担当者名で検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              className="border border-slate-200 rounded-lg text-sm px-2 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ClientType | "all")}
            >
              <option value="all">全タイプ</option>
              <option value="agency">代理店</option>
              <option value="direct">直販</option>
            </select>
          </div>

          {/* ロールベースのアクションボタン */}
          {canCreateLead && (
            <button className="flex items-center gap-1.5 bg-[#1E3A8A] text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-[#1e3070] cursor-pointer">
              <Plus className="w-4 h-4" /> 新規リード
            </button>
          )}
          {canConfirmBooking && (
            <button className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 cursor-pointer">
              <BookOpen className="w-4 h-4" /> 予約確定
            </button>
          )}
          {canViewRevenue && (
            <button className="flex items-center gap-1.5 bg-white border border-[#1E3A8A]/30 text-[#1E3A8A] text-sm px-4 py-2 rounded-lg font-medium hover:bg-[#1E3A8A]/5 cursor-pointer">
              <span className="text-xs font-bold">¥</span> レート確認
            </button>
          )}

          {/* 現在のロール表示 */}
          {salesRole && user && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-400">{user.name}</span>
              <SalesRoleBadge role={salesRole} />
            </div>
          )}
        </div>
      </div>

      {/* リード一覧 */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">問い合わせ日</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">会社名 / 担当者</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">区分</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">宿泊日程</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">人数</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">目的</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">担当</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ステータス</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const statusMeta = STATUS_META[lead.status];
              const typeMeta = CLIENT_TYPE_META[lead.client_type];
              const TypeIcon = typeMeta.icon;
              return (
                <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs">{lead.created_at}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 text-sm">{lead.client_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{lead.contact_person}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                      lead.client_type === "agency" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"
                    )}>
                      <TypeIcon className="w-3 h-3" />
                      {typeMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {lead.check_in} 〜 {lead.check_out}
                    </div>
                    <p className="text-slate-400 mt-0.5">{lead.nights}泊</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{lead.pax}名</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{lead.purpose}</span>
                  </td>
                  <td className="px-4 py-3"><LeadAssigneeBadge name={lead.assignee} /></td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium", statusMeta.color, statusMeta.bg)}>
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReplyTarget(lead)}
                        className="text-slate-400 hover:text-[#1E3A8A] transition-colors cursor-pointer"
                        title="返信メール作成"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button className="text-slate-400 hover:text-[#1E3A8A] transition-colors cursor-pointer" title="メモ">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button className="text-slate-400 hover:text-[#1E3A8A] transition-colors cursor-pointer" title="電話">
                        <Phone className="w-4 h-4" />
                      </button>
                      <button className="text-slate-400 hover:text-[#1E3A8A] transition-colors cursor-pointer">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">該当するリードがありません</div>
        )}
      </div>

      {replyTarget && <QuickReplyModal lead={replyTarget} onClose={() => setReplyTarget(null)} />}
    </div>
  );
}
