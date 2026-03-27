"use client";

import { useState, useMemo } from "react";
import {
  Users, Calendar, Bed, Mail, Download, ChevronRight,
  X, Send, Clock, CheckCircle2, User, Calculator, BarChart2,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GroupCapacityPanel } from "./GroupCapacityPanel";
import { GroupRateCalculator } from "./GroupRateCalculator";

interface Participant {
  id: string;
  name: string;
  room_no: string;
  room_type: string;
  bed_type: string;
  gender: "M" | "F";
  allergy: string;
  notes: string;
}

interface EmailMessage {
  id: string;
  direction: "sent" | "received";
  sender: string;
  date: string;
  subject: string;
  body: string;
}

interface Group {
  id: string;
  deal_id: string;
  group_name: string;
  client_type: "agency" | "direct";
  contact_person: string;
  contact_email: string;
  check_in: string;
  check_out: string;
  nights: number;
  pax: number;
  rooms: number;
  purpose: string;
  status: "confirmed" | "checked_in" | "checked_out";
  assignee: string;
  participants: Participant[];
  emails: EmailMessage[];
}

const GROUPS: Group[] = [
  {
    id: "G001", deal_id: "D004", group_name: "テックコープ 研修グループ", client_type: "direct",
    contact_person: "伊藤 部長", contact_email: "ito@techcorp.co.jp",
    check_in: "2026-04-25", check_out: "2026-04-26", nights: 1, pax: 20, rooms: 10,
    purpose: "研修・会議", status: "confirmed", assignee: "佐藤",
    participants: [
      { id: "P001", name: "伊藤 健一", room_no: "301", room_type: "スーペリアダブル", bed_type: "ダブル", gender: "M", allergy: "", notes: "禁煙" },
      { id: "P002", name: "山本 美咲", room_no: "302", room_type: "スーペリアダブル", bed_type: "ダブル", gender: "F", allergy: "甲殻類", notes: "" },
      { id: "P003", name: "鈴木 大輔", room_no: "303", room_type: "スーペリアダブル", bed_type: "ダブル", gender: "M", allergy: "", notes: "喫煙" },
      { id: "P004", name: "田中 麻衣", room_no: "304", room_type: "スーペリアダブル", bed_type: "ダブル", gender: "F", allergy: "乳製品", notes: "" },
    ],
    emails: [
      { id: "E001", direction: "received", sender: "ito@techcorp.co.jp", date: "2026-03-20 14:32", subject: "研修グループ宿泊のご確認", body: "先日はお打ち合わせありがとうございました。確定のご連絡です。参加者名簿を添付します。" },
      { id: "E002", direction: "sent", sender: "sales@hotel.jp", date: "2026-03-21 09:15", subject: "Re: 研修グループ宿泊のご確認", body: "ご確認ありがとうございます。参加者名簿を受領いたしました。当日は14時よりチェックイン可能でございます。" },
      { id: "E003", direction: "received", sender: "ito@techcorp.co.jp", date: "2026-03-22 11:05", subject: "懇親会メニューについて", body: "懇親会のメニューについてご相談させてください。和食コースでお願いしたいと思います。" },
    ],
  },
  {
    id: "G002", deal_id: "D001", group_name: "東京第一高校 修学旅行団", client_type: "direct",
    contact_person: "高橋 先生", contact_email: "takahashi@t1high.ed.jp",
    check_in: "2026-06-05", check_out: "2026-06-07", nights: 2, pax: 120, rooms: 40,
    purpose: "修学旅行", status: "confirmed", assignee: "田中",
    participants: [
      { id: "P005", name: "高橋 誠", room_no: "401", room_type: "スタンダードツイン", bed_type: "ツイン", gender: "M", allergy: "", notes: "引率教員" },
      { id: "P006", name: "佐藤 彩", room_no: "402", room_type: "スタンダードツイン", bed_type: "ツイン", gender: "F", allergy: "卵", notes: "引率教員" },
    ],
    emails: [
      { id: "E004", direction: "sent", sender: "sales@hotel.jp", date: "2026-03-24 10:00", subject: "修学旅行ご宿泊のご案内", body: "この度はご利用いただきありがとうございます。詳細スケジュールをお送りします。" },
    ],
  },
];

const ROOM_TYPES = ["スーペリアダブル", "スーペリアツイン", "スタンダードダブル", "スタンダードツイン", "デラックスダブル"];
const BED_TYPES  = ["ダブル", "ツイン", "シングル"];

const STATUS_META = {
  confirmed:   { label: "確定済",       color: "text-blue-700",  bg: "bg-blue-50" },
  checked_in:  { label: "チェックイン済", color: "text-green-700", bg: "bg-green-50" },
  checked_out: { label: "チェックアウト", color: "text-slate-500", bg: "bg-slate-100" },
};

// ─── 参加者フォーム ───────────────────────────────────────────────────────────

type ParticipantFormData = Omit<Participant, "id">;

function ParticipantForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Participant;
  onSave: (data: ParticipantFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ParticipantFormData>({
    name:      initial?.name      ?? "",
    room_no:   initial?.room_no   ?? "",
    room_type: initial?.room_type ?? ROOM_TYPES[0],
    bed_type:  initial?.bed_type  ?? BED_TYPES[0],
    gender:    initial?.gender    ?? "M",
    allergy:   initial?.allergy   ?? "",
    notes:     initial?.notes     ?? "",
  });

  const set = (k: keyof ParticipantFormData, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const canSave = form.name.trim() !== "" && form.room_no.trim() !== "";

  return (
    <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4 space-y-3">
      <p className="text-xs font-semibold text-[#1E3A8A]">
        {initial ? "参加者を編集" : "参加者を追加"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {/* 氏名 */}
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">氏名 <span className="text-red-500">*</span></label>
          <input
            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="山田 太郎"
          />
        </div>
        {/* 部屋番号 */}
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">部屋番号 <span className="text-red-500">*</span></label>
          <input
            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.room_no}
            onChange={(e) => set("room_no", e.target.value)}
            placeholder="301"
          />
        </div>
        {/* 部屋タイプ */}
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">部屋タイプ</label>
          <select
            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.room_type}
            onChange={(e) => set("room_type", e.target.value)}
          >
            {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* ベッドタイプ */}
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">ベッドタイプ</label>
          <select
            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.bed_type}
            onChange={(e) => set("bed_type", e.target.value)}
          >
            {BED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* 性別 */}
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">性別</label>
          <select
            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value as "M" | "F")}
          >
            <option value="M">男性</option>
            <option value="F">女性</option>
          </select>
        </div>
        {/* アレルギー */}
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">アレルギー</label>
          <input
            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.allergy}
            onChange={(e) => set("allergy", e.target.value)}
            placeholder="卵・乳製品など"
          />
        </div>
        {/* 備考 */}
        <div className="col-span-2">
          <label className="text-[10px] text-slate-500 mb-1 block">備考</label>
          <input
            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="禁煙・喫煙・特記事項など"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          キャンセル
        </button>
        <button
          onClick={() => { if (canSave) onSave(form); }}
          disabled={!canSave}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white font-medium hover:bg-[#1e3070] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {initial ? "更新" : "追加"}
        </button>
      </div>
    </div>
  );
}

// ─── グループ詳細パネル ────────────────────────────────────────────────────────

interface GroupDetailProps {
  group: Group;
  onClose: () => void;
}

type DetailPanel = "participants" | "rooms" | "email";

function GroupDetail({ group, onClose }: GroupDetailProps) {
  const [activePanel, setActivePanel]         = useState<DetailPanel>("participants");
  const [localParticipants, setLocalParts]    = useState<Participant[]>(group.participants);
  const [showForm, setShowForm]               = useState(false);
  const [editTarget, setEditTarget]           = useState<Participant | null>(null);
  const [replyBody, setReplyBody]             = useState("");
  const [showReply, setShowReply]             = useState(false);

  const roomMap = useMemo(() => {
    const map: Record<string, Participant[]> = {};
    localParticipants.forEach((p) => {
      if (!map[p.room_no]) map[p.room_no] = [];
      map[p.room_no].push(p);
    });
    return map;
  }, [localParticipants]);

  const handleSave = (data: ParticipantFormData) => {
    if (editTarget) {
      setLocalParts((prev) =>
        prev.map((p) => (p.id === editTarget.id ? { ...editTarget, ...data } : p))
      );
    } else {
      setLocalParts((prev) => [...prev, { id: `P${Date.now()}`, ...data }]);
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleEdit = (p: Participant) => {
    setEditTarget(p);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setLocalParts((prev) => prev.filter((p) => p.id !== id));
  };

  const openAddForm = () => {
    setEditTarget(null);
    setShowForm(true);
  };

  const PANELS: { id: DetailPanel; label: string }[] = [
    { id: "participants", label: `参加者リスト（${localParticipants.length}名）` },
    { id: "rooms",        label: `部屋アサイン（${Object.keys(roomMap).length}室）` },
    { id: "email",        label: `メール履歴（${group.emails.length}件）` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[640px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="border-b border-slate-100 px-5 py-4 flex items-start justify-between flex-shrink-0">
          <div>
            <p className="font-semibold text-slate-800">{group.group_name}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{group.check_in} 〜 {group.check_out}</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{group.pax}名</span>
              <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{group.rooms}室</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer">
              <Download className="w-3 h-3" /> ルーミングリスト
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* パネル切り替え */}
        <div className="flex border-b border-slate-100 flex-shrink-0">
          {PANELS.map((panel) => (
            <button
              key={panel.id}
              onClick={() => { setActivePanel(panel.id); setShowForm(false); }}
              className={cn(
                "px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap",
                activePanel === panel.id
                  ? "text-[#1E3A8A] border-b-2 border-[#1E3A8A]"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">

          {/* ── 参加者リスト ─────────────────────────────── */}
          {activePanel === "participants" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {localParticipants.length}名登録済（全{group.pax}名）
                  {localParticipants.length < group.pax && (
                    <span className="text-orange-500 ml-2">残り{group.pax - localParticipants.length}名未登録</span>
                  )}
                </p>
                {!showForm && (
                  <button
                    onClick={openAddForm}
                    className="flex items-center gap-1 text-xs text-[#1E3A8A] hover:underline cursor-pointer font-medium"
                  >
                    <Plus className="w-3 h-3" /> 参加者追加
                  </button>
                )}
              </div>

              {showForm && (
                <ParticipantForm
                  initial={editTarget ?? undefined}
                  onSave={handleSave}
                  onCancel={() => { setShowForm(false); setEditTarget(null); }}
                />
              )}

              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-100">
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">氏名</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">部屋</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">タイプ</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">アレルギー</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">備考</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {localParticipants.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60 group">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-medium text-slate-700">{p.name}</span>
                          <span className={cn("text-[10px] px-1 rounded",
                            p.gender === "M" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                          )}>{p.gender === "M" ? "男" : "女"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 font-medium">{p.room_no}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-[10px] leading-tight">
                        {p.room_type}<br />{p.bed_type}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.allergy
                          ? <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{p.allergy}</span>
                          : <span className="text-slate-300">―</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{p.notes || "―"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1 rounded text-slate-400 hover:text-[#1E3A8A] hover:bg-blue-50 cursor-pointer"
                            title="編集"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
                            title="削除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {localParticipants.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  参加者がまだ登録されていません
                </div>
              )}
            </div>
          )}

          {/* ── 部屋アサイン ──────────────────────────────── */}
          {activePanel === "rooms" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {Object.keys(roomMap).length}室アサイン済（全{group.rooms}室）
                  {Object.keys(roomMap).length < group.rooms && (
                    <span className="text-orange-500 ml-2">
                      残り{group.rooms - Object.keys(roomMap).length}室未アサイン
                    </span>
                  )}
                </p>
                <button
                  onClick={() => { setActivePanel("participants"); openAddForm(); }}
                  className="flex items-center gap-1 text-xs text-[#1E3A8A] hover:underline cursor-pointer font-medium"
                >
                  <Plus className="w-3 h-3" /> 参加者追加
                </button>
              </div>

              {localParticipants.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <LayoutGrid className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                  参加者を追加すると部屋アサインが表示されます
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(roomMap)
                    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                    .map(([roomNo, occupants]) => (
                      <div key={roomNo} className="bg-white rounded-xl border border-slate-100 p-3 hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 bg-[#1E3A8A]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Bed className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{roomNo}号室</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {occupants[0]?.room_type} / {occupants[0]?.bed_type}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {occupants.map((p) => (
                            <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                              <User className="w-3 h-3 text-slate-300 flex-shrink-0" />
                              <span className="truncate">{p.name}</span>
                              <span className={cn("text-[9px] px-1 rounded flex-shrink-0",
                                p.gender === "M" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                              )}>
                                {p.gender === "M" ? "男" : "女"}
                              </span>
                              {p.allergy && (
                                <span className="text-[9px] text-red-500 bg-red-50 px-1 rounded flex-shrink-0">
                                  {p.allergy}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── メール履歴 ────────────────────────────────── */}
          {activePanel === "email" && (
            <div className="p-4 space-y-3">
              {group.emails.map((email) => (
                <div key={email.id} className={cn("rounded-xl p-4 border",
                  email.direction === "sent"
                    ? "bg-blue-50 border-blue-100 ml-6"
                    : "bg-white border-slate-100 mr-6"
                )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {email.direction === "sent"
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                        : <Mail className="w-3.5 h-3.5 text-slate-400" />
                      }
                      <span className="text-xs font-medium text-slate-600">
                        {email.direction === "sent" ? "送信済み" : email.sender}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />{email.date}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">{email.subject}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{email.body}</p>
                </div>
              ))}

              {showReply ? (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-400 mb-2">宛先: {group.contact_email}</p>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                    rows={5}
                    placeholder="返信内容を入力..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">※ Resend API連携後に実際の送信が有効になります</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setShowReply(false)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer">キャンセル</button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white font-medium hover:bg-[#1e3070] cursor-pointer flex items-center gap-1.5">
                      <Send className="w-3 h-3" /> 送信（スタブ）
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowReply(true)}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-slate-300 hover:text-slate-500 cursor-pointer flex items-center justify-center gap-2 transition-colors"
                >
                  <Mail className="w-4 h-4" /> 返信メールを作成
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SalesGroups（メインコンポーネント）──────────────────────────────────────

type ToolPanel = "capacity" | "rate" | null;

export function SalesGroups({ propertyId: _propertyId }: { propertyId: number }) {
  const [selected, setSelected]       = useState<Group | null>(null);
  const [activePanel, setActivePanel] = useState<ToolPanel>(null);

  const togglePanel = (panel: ToolPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="space-y-4">
      {/* ツールバー: キャパシティ & レート算出 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => togglePanel("capacity")}
          className={cn(
            "flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
            activePanel === "capacity"
              ? "border-[#1E3A8A] bg-[#1E3A8A]/5"
              : "border-slate-100 bg-white hover:border-slate-200"
          )}
        >
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", activePanel === "capacity" ? "bg-[#1E3A8A]/10" : "bg-slate-50")}>
            <BarChart2 className={cn("w-5 h-5", activePanel === "capacity" ? "text-[#1E3A8A]" : "text-slate-400")} />
          </div>
          <div className="text-left flex-1">
            <p className={cn("text-sm font-semibold", activePanel === "capacity" ? "text-[#1E3A8A]" : "text-slate-700")}>キャパシティチェック</p>
            <p className="text-xs text-slate-400 mt-0.5">日程・室数から受入可否を判定</p>
          </div>
          {activePanel === "capacity" ? <ChevronUp className="w-4 h-4 text-[#1E3A8A]" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        <button
          onClick={() => togglePanel("rate")}
          className={cn(
            "flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
            activePanel === "rate"
              ? "border-[#1E3A8A] bg-[#1E3A8A]/5"
              : "border-slate-100 bg-white hover:border-slate-200"
          )}
        >
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", activePanel === "rate" ? "bg-[#1E3A8A]/10" : "bg-slate-50")}>
            <Calculator className={cn("w-5 h-5", activePanel === "rate" ? "text-[#1E3A8A]" : "text-slate-400")} />
          </div>
          <div className="text-left flex-1">
            <p className={cn("text-sm font-semibold", activePanel === "rate" ? "text-[#1E3A8A]" : "text-slate-700")}>グループレート算出</p>
            <p className="text-xs text-slate-400 mt-0.5">リードタイム×ボリューム×季節で推奨レート算出</p>
          </div>
          {activePanel === "rate" ? <ChevronUp className="w-4 h-4 text-[#1E3A8A]" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      {activePanel === "capacity" && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <GroupCapacityPanel />
        </div>
      )}
      {activePanel === "rate" && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <GroupRateCalculator />
        </div>
      )}

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">確定グループ数</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{GROUPS.length}件</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">合計宿泊人数</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{GROUPS.reduce((s, g) => s + g.pax, 0)}名</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">参加者未登録</p>
          <p className="text-xl font-bold text-orange-600 mt-1">
            {GROUPS.reduce((s, g) => s + (g.pax - g.participants.length), 0)}名
          </p>
        </div>
      </div>

      {/* グループ一覧 */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">グループ名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">宿泊日程</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">人数 / 部屋</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">目的</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">参加者</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">メール</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ステータス</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => {
              const statusMeta = STATUS_META[group.status];
              const regRate = Math.round((group.participants.length / group.pax) * 100);
              return (
                <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{group.group_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{group.contact_person}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {group.check_in} 〜 {group.check_out}
                    </div>
                    <p className="text-slate-400 mt-0.5">{group.nights}泊</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" />{group.pax}名</div>
                    <div className="flex items-center gap-1 mt-0.5"><Bed className="w-3.5 h-3.5 text-slate-400" />{group.rooms}室</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{group.purpose}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${regRate}%` }} />
                      </div>
                      <span className={cn("text-xs", regRate < 100 ? "text-orange-500" : "text-green-600")}>
                        {group.participants.length}/{group.pax}名
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />{group.emails.length}件
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium", statusMeta.color, statusMeta.bg)}>
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(group)}
                      className="flex items-center gap-1 text-xs text-[#1E3A8A] hover:underline cursor-pointer"
                    >
                      詳細 <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <GroupDetail group={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
