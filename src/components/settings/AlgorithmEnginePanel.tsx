"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAlgorithmSettings,
  updateAlgorithmSettings,
  AlgorithmSettings,
} from "@/lib/api/properties";
import {
  fetchCircuitBreakerStatus,
  releaseCircuitBreaker,
  CircuitBreakerStatus,
} from "@/lib/api/pricing";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="yl-card p-5 mb-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  desc: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        checked
          ? "border-blue-500 bg-blue-50"
          : "border-slate-200 hover:border-slate-300"
      )}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-blue-600"
      />
      <div>
        <p className="text-xs font-semibold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
      </div>
    </label>
  );
}

export function AlgorithmEnginePanel({ propertyId }: { propertyId: number }) {
  const [settings, setSettings] = useState<AlgorithmSettings | null>(null);
  const [freeze, setFreeze] = useState<CircuitBreakerStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetchAlgorithmSettings(propertyId).then(setSettings).catch(() => {});
    fetchCircuitBreakerStatus(propertyId).then(setFreeze).catch(() => {});
  }, [propertyId]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateAlgorithmSettings(propertyId, settings);
      setSettings(updated);
      setSaveMsg({ type: "ok", text: "保存しました" });
    } catch {
      setSaveMsg({ type: "err", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!confirm("Circuit Breaker を手動解除しますか？\n解除後は値上げ推奨が再び生成されます。")) return;
    setReleasing(true);
    try {
      await releaseCircuitBreaker(propertyId);
      const updated = await fetchCircuitBreakerStatus(propertyId);
      setFreeze(updated);
    } catch {
      alert("解除に失敗しました");
    } finally {
      setReleasing(false);
    }
  };

  if (!settings) {
    return (
      <div className="yl-card p-5 mb-4">
        <p className="text-xs text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      {/* エンジン設定 */}
      <Section
        title="エンジン設定"
        desc="推奨価格生成に使うアルゴリズムを選択します"
      >
        <div className="flex flex-col gap-2">
          <RadioOption
            checked={settings.use_v2_engine}
            onChange={() => setSettings({ ...settings, use_v2_engine: true })}
            label="v2 ML エンジン（推奨）"
            desc="需要予測・競合分析・予約ペースを自動学習し、最適な価格変動量を算出します"
          />
          <RadioOption
            checked={!settings.use_v2_engine}
            onChange={() => setSettings({ ...settings, use_v2_engine: false })}
            label="v1 ルールベース"
            desc="ペース比率・在庫率・競合価格差などの固定ルールで BAR レベルを調整します"
          />
        </div>
      </Section>

      {/* コールドスタートモード */}
      <Section
        title="コールドスタートモード"
        desc="自社の予約実績データが少ない場合の動作モードを選択します"
      >
        <div className="flex flex-col gap-2">
          <RadioOption
            checked={settings.cold_start_mode === "full"}
            onChange={() => setSettings({ ...settings, cold_start_mode: "full" })}
            label="フル学習モード"
            desc="過去180日の予約実績・稼働率・競合価格から重みを自動学習します（30件以上のデータが必要）"
          />
          <RadioOption
            checked={settings.cold_start_mode === "market_only"}
            onChange={() =>
              setSettings({ ...settings, cold_start_mode: "market_only" })
            }
            label="市場専用モード"
            desc="自社データ不要。競合価格と予約ペースのみを使って推奨を生成します（開業直後・新規登録に最適）"
          />
        </div>
      </Section>

      {/* Circuit Breaker ステータス */}
      <Section
        title="Rating Circuit Breaker"
        desc="評価スコアが急落した際に値上げ推奨を自動停止する安全装置です"
      >
        {freeze === null ? (
          <p className="text-xs text-slate-400">読み込み中...</p>
        ) : freeze.is_frozen ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-600">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-semibold">値上げ凍結中</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
              <p className="text-[11px] text-slate-600">
                <span className="font-medium">理由:</span>{" "}
                {freeze.trigger_reason ?? "—"}
              </p>
              {freeze.baseline_overall != null && freeze.trigger_overall != null && (
                <p className="text-[11px] text-slate-600">
                  <span className="font-medium">評価スコア:</span>{" "}
                  {freeze.baseline_overall.toFixed(2)} → {freeze.trigger_overall.toFixed(2)}
                  （変化: {(freeze.trigger_overall - freeze.baseline_overall).toFixed(2)}）
                </p>
              )}
              {freeze.frozen_from && (
                <p className="text-[11px] text-slate-600">
                  <span className="font-medium">凍結開始:</span>{" "}
                  {new Date(freeze.frozen_from).toLocaleDateString("ja-JP")}
                </p>
              )}
            </div>
            <button
              onClick={handleRelease}
              disabled={releasing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-md transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              {releasing ? "解除中..." : "手動解除"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">正常稼働中（凍結なし）</span>
          </div>
        )}
      </Section>

      {/* 保存ボタン */}
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        {saveMsg && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              saveMsg.type === "ok" ? "text-emerald-600" : "text-red-500"
            )}
          >
            {saveMsg.type === "ok" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {saveMsg.text}
          </span>
        )}
      </div>
    </div>
  );
}
