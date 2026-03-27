"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { fetchApprovalSettings, updateApprovalSettings } from "@/lib/api";
import { cn } from "@/lib/utils";

const THRESHOLD_OPTIONS = [
  { value: "0", label: "すべて承認が必要",              desc: "AI推奨は全件手動承認" },
  { value: "1", label: "1ランク変動まで自動承認（推奨）", desc: "例: C→B は自動反映" },
  { value: "2", label: "2ランク変動まで自動承認",        desc: "例: C→A も自動反映" },
];

export function ApprovalPanel({ propertyId }: { propertyId: number }) {
  const [form, setForm] = useState({ threshold: "1", channel: "email", email: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetchApprovalSettings(propertyId).then(s => {
      if (s) {
        setForm({
          threshold: String(s.auto_approve_threshold_levels),
          channel: s.notification_channel,
          email: s.notification_email ?? "",
        });
      }
    });
  }, [propertyId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateApprovalSettings(propertyId, {
        auto_approve_threshold_levels: parseInt(form.threshold),
        notification_channel: form.channel,
        notification_email: form.email || undefined,
      });
      setSaveMsg({ type: "ok", text: "設定を保存しました" });
    } catch {
      setSaveMsg({ type: "err", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">承認設定</h2>
        <p className="text-xs text-gray-400 mt-0.5">自動承認の閾値と通知先を設定します</p>
      </div>
      <div className="yl-card p-6 max-w-lg">
        {saveMsg && (
          <div className={cn(
            "mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-medium",
            saveMsg.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          )}>
            {saveMsg.type === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {saveMsg.text}
          </div>
        )}
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">自動承認の閾値</label>
            <div className="space-y-2">
              {THRESHOLD_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    form.threshold === opt.value
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="threshold"
                    value={opt.value}
                    checked={form.threshold === opt.value}
                    onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <div className="text-xs font-medium text-gray-800">{opt.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">承認待ちの通知チャネル</label>
            <select
              value={form.channel}
              onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="email">Email</option>
              <option value="slack">Slack（近日対応予定）</option>
              <option value="line">LINE（近日対応予定）</option>
            </select>
          </div>

          {form.channel === "email" && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">通知先メールアドレス</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="rm@yourhotel.com"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full text-sm font-medium text-white bg-gray-900 rounded-lg py-2.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "設定を保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
