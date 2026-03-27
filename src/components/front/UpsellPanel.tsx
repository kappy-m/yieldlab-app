"use client";

import { useState } from "react";
import {
  Gift, BedDouble, TrendingUp, CheckCircle2, Clock,
  ChevronDown, ChevronUp, Send, X, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser, getInitials } from "@/hooks/useCurrentUser";

// ────────────────────────────────────────────────────────────────────────────
// Types & Mock data
// ────────────────────────────────────────────────────────────────────────────

type UpsellStatus = "pending" | "offered" | "accepted" | "declined";

interface UpsellGuest {
  id: string;
  room: string;
  name: string;
  occasion: string;
  currentType: string;
  upgradeType: string;
  roomAvailable: boolean;
  addedCost: number;
  checkIn: string;
  nights: number;
  status: UpsellStatus;
  notes: string;
  /** 担当スタッフ名（未割当の場合は undefined） */
  assignedTo?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// AssigneeBadge コンポーネント
// ────────────────────────────────────────────────────────────────────────────

interface AssigneeBadgeProps {
  name: string;
  size?: "sm" | "md";
}

function AssigneeBadge({ name, size = "sm" }: AssigneeBadgeProps) {
  const initials = getInitials(name);
  const avatarSize = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-xs";
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          "rounded-full bg-[#1E3A8A] text-white font-bold flex items-center justify-center flex-shrink-0",
          avatarSize
        )}
      >
        {initials}
      </span>
      <span className="text-xs text-slate-600 whitespace-nowrap">{name}</span>
    </span>
  );
}

const INITIAL_UPSELL_GUESTS: UpsellGuest[] = [
  {
    id: "u1",
    room: "302",
    name: "田中 裕子 様",
    occasion: "結婚記念日",
    currentType: "スタンダードダブル",
    upgradeType: "スーペリアダブル",
    roomAvailable: true,
    addedCost: 5000,
    checkIn: "3/27",
    nights: 2,
    status: "pending",
    notes: "予約備考に「記念日」の記載あり",
    assignedTo: undefined,
  },
  {
    id: "u2",
    room: "415",
    name: "鈴木 健太 様",
    occasion: "誕生日",
    currentType: "スタンダードシングル",
    upgradeType: "デラックス",
    roomAvailable: true,
    addedCost: 8000,
    checkIn: "3/27",
    nights: 1,
    status: "offered",
    notes: "楽天予約備考「誕生日旅行」より検知",
    assignedTo: "佐藤 花子",
  },
  {
    id: "u3",
    room: "518",
    name: "山本 夫妻 様",
    occasion: "ハネムーン",
    currentType: "ツイン",
    upgradeType: "スイート",
    roomAvailable: true,
    addedCost: 38000,
    checkIn: "3/27",
    nights: 3,
    status: "accepted",
    notes: "Booking.com備考「Honeymoon trip」より検知",
    assignedTo: "田村 誠",
  },
  {
    id: "u4",
    room: "121",
    name: "中村 浩二 様",
    occasion: "誕生日",
    currentType: "スタンダードシングル",
    upgradeType: "ツイン",
    roomAvailable: false,
    addedCost: 2000,
    checkIn: "3/28",
    nights: 2,
    status: "pending",
    notes: "メモ欄「妻の誕生日プレゼント」より検知",
    assignedTo: undefined,
  },
];

const OCCASION_BADGES: Record<string, { bg: string; text: string }> = {
  "結婚記念日": { bg: "bg-rose-100",   text: "text-rose-700" },
  "誕生日":     { bg: "bg-amber-100",  text: "text-amber-700" },
  "ハネムーン": { bg: "bg-pink-100",   text: "text-pink-700" },
  "入籍記念日": { bg: "bg-purple-100", text: "text-purple-700" },
};

const STATUS_CONFIG: Record<UpsellStatus, { label: string; bg: string; text: string }> = {
  pending:  { label: "未提案",   bg: "bg-slate-100",  text: "text-slate-600" },
  offered:  { label: "提案中",   bg: "bg-blue-50",    text: "text-blue-700" },
  accepted: { label: "承諾",     bg: "bg-green-50",   text: "text-green-700" },
  declined: { label: "辞退",     bg: "bg-red-50",     text: "text-red-600" },
};

// ────────────────────────────────────────────────────────────────────────────
// Offer Modal (simple inline expand)
// ────────────────────────────────────────────────────────────────────────────

interface GuestRowProps {
  guest: UpsellGuest;
  onClaim: (id: string, assigneeName: string) => void;
  currentUserName: string | null;
  canAssign: boolean;
}

function GuestRow({ guest, onClaim, currentUserName, canAssign }: GuestRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<UpsellStatus>(guest.status);

  const badge = OCCASION_BADGES[guest.occasion] ?? { bg: "bg-slate-100", text: "text-slate-600" };
  const statusCfg = STATUS_CONFIG[status];

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-all",
      status === "accepted" ? "border-green-200" :
      status === "offered"  ? "border-blue-200" :
      "border-slate-100"
    )}>
      {/* 行 */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <Gift className={cn("w-4 h-4 flex-shrink-0", badge.text)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">{guest.room}号室</span>
            <span className="text-sm font-medium text-slate-800">{guest.name}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", badge.bg, badge.text)}>
              {guest.occasion}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">{guest.currentType} → {guest.upgradeType}</span>
            <span className={cn("text-xs font-medium", guest.roomAvailable ? "text-green-600" : "text-red-500")}>
              {guest.roomAvailable ? "空室あり" : "空室なし"}
            </span>
            {/* 担当者表示エリア */}
            <span
              className="ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {guest.assignedTo ? (
                <AssigneeBadge name={guest.assignedTo} size="sm" />
              ) : canAssign && currentUserName ? (
                <button
                  onClick={() => onClaim(guest.id, currentUserName)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-300 text-amber-700 bg-amber-50 text-[10px] font-medium hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  自分に割当て
                </button>
              ) : (
                <span className="text-[10px] text-slate-400">— 未担当</span>
              )}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-[#1E3A8A]">+¥{guest.addedCost.toLocaleString()}<span className="text-xs font-normal text-slate-400">/泊</span></p>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusCfg.bg, statusCfg.text)}>
            {statusCfg.label}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        }
      </div>

      {/* 展開パネル */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">
          {/* 詳細情報 */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-400">チェックイン</p>
              <p className="font-medium text-slate-700 mt-0.5">{guest.checkIn}（{guest.nights}泊）</p>
            </div>
            <div>
              <p className="text-slate-400">追加合計</p>
              <p className="font-medium text-slate-700 mt-0.5">
                ¥{(guest.addedCost * guest.nights).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-slate-400">検知メモ</p>
              <p className="font-medium text-slate-700 mt-0.5">{guest.notes}</p>
            </div>
          </div>

          {/* 提案文テンプレート */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">提案メッセージ（編集可）</p>
            <textarea
              rows={3}
              defaultValue={`${guest.name}、${guest.occasion}おめでとうございます。本日は特別なご記念にぴったりな${guest.upgradeType}をご用意できます。+¥${guest.addedCost.toLocaleString()}/泊でアップグレードされませんか？`}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none bg-white"
            />
          </div>

          {/* アクションボタン */}
          {status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={() => setStatus("offered")}
                disabled={!guest.roomAvailable}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors",
                  guest.roomAvailable
                    ? "bg-[#1E3A8A] text-white hover:bg-[#1e3070]"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                <Send className="w-3.5 h-3.5" />
                アップグレード提案
              </button>
              <button
                onClick={() => setStatus("declined")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 border border-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                スキップ
              </button>
            </div>
          )}
          {status === "offered" && (
            <div className="flex gap-2">
              <button
                onClick={() => setStatus("accepted")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                承諾済みとしてマーク
              </button>
              <button
                onClick={() => setStatus("declined")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 border border-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                辞退
              </button>
            </div>
          )}
          {(status === "accepted" || status === "declined") && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
              status === "accepted" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
            )}>
              {status === "accepted"
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> アップグレード確定</>
                : <><X className="w-3.5 h-3.5" /> 今回は辞退されました</>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

type FilterTab = "all" | UpsellStatus;

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all",      label: "全件" },
  { id: "pending",  label: "未提案" },
  { id: "offered",  label: "提案中" },
  { id: "accepted", label: "承諾" },
  { id: "declined", label: "辞退" },
];

export function UpsellPanel() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("pending");
  const [guests, setGuests] = useState<UpsellGuest[]>(INITIAL_UPSELL_GUESTS);
  const { user, canAssign } = useCurrentUser();

  /** 自分にアサインする（将来的には API PATCH /upsell/{id}/assign に変更） */
  const handleClaim = (id: string, assigneeName: string) => {
    setGuests((prev) =>
      prev.map((g) => g.id === id ? { ...g, assignedTo: assigneeName } : g)
    );
  };

  const counts: Record<FilterTab, number> = {
    all:      guests.length,
    pending:  guests.filter((g) => g.status === "pending").length,
    offered:  guests.filter((g) => g.status === "offered").length,
    accepted: guests.filter((g) => g.status === "accepted").length,
    declined: guests.filter((g) => g.status === "declined").length,
  };

  const totalRevenue = guests
    .filter((g) => g.status === "accepted")
    .reduce((sum, g) => sum + g.addedCost * g.nights, 0);

  const filtered = activeFilter === "all"
    ? guests
    : guests.filter((g) => g.status === activeFilter);

  const userCanAssign = canAssign("manage");

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div>
        <h2 className="text-sm font-bold text-slate-800">アップセルパネル</h2>
        <p className="text-xs text-slate-400 mt-0.5">記念日・特別な機会を検知して、最適なアップグレードを提案します</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "対象ゲスト",    value: `${guests.length}名`, icon: Gift,         color: "bg-rose-50 text-rose-600" },
          { label: "未提案",        value: `${counts.pending}名`,       icon: Clock,         color: "bg-slate-50 text-slate-500" },
          { label: "提案中",        value: `${counts.offered}名`,       icon: TrendingUp,    color: "bg-blue-50 text-blue-600" },
          { label: "承諾・追加収益", value: `¥${totalRevenue.toLocaleString()}`, icon: CheckCircle2, color: "bg-green-50 text-green-600" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn(
              "rounded-xl p-3 border",
              stat.color.includes("rose")  ? "border-rose-100"  :
              stat.color.includes("blue")  ? "border-blue-100"  :
              stat.color.includes("green") ? "border-green-100" : "border-slate-100"
            )}>
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", stat.color.split(" ")[0])}>
                <Icon className={cn("w-3.5 h-3.5", stat.color.split(" ")[1])} />
              </div>
              <p className="text-base font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* ゲスト一覧 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">本日のアップグレード候補</h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <BedDouble className="w-3.5 h-3.5" />
            空室連動でリアルタイム更新
          </div>
        </div>

        {/* ステータスフィルタタブ */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activeFilter === tab.id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  activeFilter === tab.id
                    ? tab.id === "pending" ? "bg-slate-100 text-slate-600"
                      : tab.id === "offered" ? "bg-blue-50 text-blue-600"
                      : tab.id === "accepted" ? "bg-green-50 text-green-600"
                      : "bg-slate-100 text-slate-500"
                    : "bg-slate-200 text-slate-500"
                )}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400 bg-white rounded-xl border border-slate-100">
            <Gift className="w-7 h-7 text-slate-200" />
            <span className="text-sm">該当するゲストがいません</span>
          </div>
        ) : (
          filtered.map((guest) => (
            <GuestRow
              key={guest.id}
              guest={guest}
              onClaim={handleClaim}
              currentUserName={user?.name ?? null}
              canAssign={userCanAssign}
            />
          ))
        )}
      </div>
    </div>
  );
}
