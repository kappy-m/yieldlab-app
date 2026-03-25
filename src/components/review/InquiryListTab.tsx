"use client";

import { useState, useMemo } from "react";
import { Mail, PhoneCall, FileText, Search, ChevronDown, AlertCircle } from "lucide-react";
import {
  MOCK_INQUIRIES, STATUS_CONFIG, PRIORITY_CONFIG, CHANNEL_CONFIG,
  type Inquiry, type InquiryChannel, type InquiryStatus, type InquiryPriority,
} from "./inquiryData";
import { InquirySlidePanel } from "./InquirySlidePanel";

const CHANNEL_ICONS: Record<InquiryChannel, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  form:  <FileText className="w-4 h-4" />,
  phone: <PhoneCall className="w-4 h-4" />,
};

const CHANNEL_BG: Record<InquiryChannel, string> = {
  email: "bg-blue-100 text-blue-600",
  form:  "bg-violet-100 text-violet-600",
  phone: "bg-green-100 text-green-600",
};

export function InquiryListTab({ propertyId: _propertyId }: { propertyId: number }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>(MOCK_INQUIRIES);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [channelFilter, setChannelFilter] = useState<InquiryChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<InquiryPriority | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return inquiries.filter((inq) => {
      if (channelFilter !== "all" && inq.channel !== channelFilter) return false;
      if (statusFilter !== "all" && inq.status !== statusFilter) return false;
      if (priorityFilter !== "all" && inq.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inq.subject.toLowerCase().includes(q) &&
            !inq.customerName.toLowerCase().includes(q) &&
            !inq.content.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [inquiries, channelFilter, statusFilter, priorityFilter, search]);

  const handleStatusChange = (id: number, status: InquiryStatus) => {
    setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : prev);
  };

  const handlePriorityChange = (id: number, priority: InquiryPriority) => {
    setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, priority } : i));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, priority } : prev);
  };

  // ステータス別カウント
  const counts = useMemo(() => ({
    new:         inquiries.filter((i) => i.status === "new").length,
    in_progress: inquiries.filter((i) => i.status === "in_progress").length,
    resolved:    inquiries.filter((i) => i.status === "resolved").length,
    closed:      inquiries.filter((i) => i.status === "closed").length,
  }), [inquiries]);

  return (
    <>
      <div className="space-y-4">

        {/* サマリーバー */}
        <div className="grid grid-cols-4 gap-3">
          {(["new", "in_progress", "resolved", "closed"] as InquiryStatus[]).map((status) => {
            const cfg = STATUS_CONFIG[status];
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(isActive ? "all" : status)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  isActive ? "ring-2 ring-blue-300 ring-offset-1" : "hover:border-slate-200"
                } ${cfg.color}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div>
                  <p className="text-xs font-semibold">{cfg.label}</p>
                  <p className="text-lg font-bold leading-none mt-0.5">{counts[status]}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* フィルターバー */}
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 検索 */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="件名・顧客名・内容で検索..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>

            {/* チャネル */}
            <div className="relative">
              <select value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as InquiryChannel | "all")}
                className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="all">全チャネル</option>
                {(["email", "form", "phone"] as InquiryChannel[]).map((c) => (
                  <option key={c} value={c}>{CHANNEL_CONFIG[c].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            {/* 優先度 */}
            <div className="relative">
              <select value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as InquiryPriority | "all")}
                className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="all">全優先度</option>
                {(["high", "medium", "low"] as InquiryPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            <span className="text-xs text-slate-400 ml-auto">{filtered.length} 件表示</span>
          </div>
        </div>

        {/* リスト */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">条件に合う問い合わせが見つかりません</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((inq) => {
                const isSelected = selected?.id === inq.id;
                return (
                  <li key={inq.id}>
                    <button
                      onClick={() => setSelected(inq)}
                      className={`w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer ${isSelected ? "bg-blue-50/50" : ""}`}
                    >
                      {/* チャネルアイコン */}
                      <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 mt-0.5 ${CHANNEL_BG[inq.channel]}`}>
                        {CHANNEL_ICONS[inq.channel]}
                      </div>

                      {/* メインコンテンツ */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {/* ステータスドット */}
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_CONFIG[inq.status].dot}`} />
                          <span className="text-sm font-semibold text-slate-800 truncate">{inq.subject}</span>
                          {inq.priority === "high" && (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0">高</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-500">{inq.customerName}</span>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CONFIG[inq.status].color}`}>
                            {STATUS_CONFIG[inq.status].label}
                          </span>
                          {inq.assignee && (
                            <><span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-400">{inq.assignee}</span></>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-1">{inq.content.split("\n")[0]}</p>
                        {inq.tags && inq.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {inq.tags.map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 右側メタ */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-slate-400">{inq.date}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CHANNEL_BG[inq.channel]}`}>
                          {CHANNEL_CONFIG[inq.channel].label}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* スライドパネル */}
      <InquirySlidePanel
        inquiry={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
      />
    </>
  );
}
