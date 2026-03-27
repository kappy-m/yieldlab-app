"use client";

import { useState, useEffect } from "react";
import { Check, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingPolicy {
  min_rate: string;
  max_rate: string;
  min_rate_gap: string;
  enforce_room_order: boolean;
  max_daily_change_pct: string;
  mlos_enabled: boolean;
  mlos_threshold_occ: string;
  mlos_min_nights: string;
}

const POLICY_STORAGE_KEY = (propertyId: number) => `yl_pricing_policy_${propertyId}`;

const DEFAULT_POLICY: PricingPolicy = {
  min_rate: "8000",
  max_rate: "120000",
  min_rate_gap: "500",
  enforce_room_order: true,
  max_daily_change_pct: "30",
  mlos_enabled: false,
  mlos_threshold_occ: "85",
  mlos_min_nights: "2",
};

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 border-b border-slate-100 last:border-b-0">
      <div>
        <p className="text-xs font-medium text-slate-700">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberInput({
  value, onChange, prefix, suffix, min, max,
}: {
  value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-28 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

export function PricingPolicyPanel({ propertyId }: { propertyId: number }) {
  const [form, setForm] = useState<PricingPolicy>(DEFAULT_POLICY);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POLICY_STORAGE_KEY(propertyId));
      if (raw) setForm(JSON.parse(raw) as PricingPolicy);
    } catch { /* ignore */ }
  }, [propertyId]);

  const update = <K extends keyof PricingPolicy>(key: K, value: PricingPolicy[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    localStorage.setItem(POLICY_STORAGE_KEY(propertyId), JSON.stringify(form));
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">プライシングポリシー</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ブランドとしての価格の幅・ルール・AI推奨の動作範囲を設定します
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              未保存の変更があります
            </span>
          )}
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-medium transition-colors",
              saved
                ? "bg-green-500 text-white"
                : "bg-slate-900 text-white hover:bg-slate-700"
            )}
          >
            {saved ? (
              <><CheckCircle2 className="w-3.5 h-3.5" />保存済み</>
            ) : (
              <><Check className="w-3.5 h-3.5" />保存</>
            )}
          </button>
        </div>
      </div>

      <Section
        title="価格幅ルール"
        desc="ブランドとして許容する最低価格・最高価格を設定します。AI推奨はこの範囲内で生成されます"
      >
        <Field label="ブランド最低価格（Min Rate）" hint="どのレートランクでも下回ってはならない底値">
          <NumberInput value={form.min_rate} onChange={v => update("min_rate", v)} prefix="¥" suffix="/ 泊" min={0} />
        </Field>
        <Field label="ブランド最高価格（Max Rate）" hint="レートランク1の上限価格">
          <NumberInput value={form.max_rate} onChange={v => update("max_rate", v)} prefix="¥" suffix="/ 泊" min={0} />
        </Field>
        <Field label="レートランク間の最小価格差" hint="隣り合うランクの差がこの金額を下回らないよう制約">
          <NumberInput value={form.min_rate_gap} onChange={v => update("min_rate_gap", v)} prefix="¥" suffix="以上" min={0} />
        </Field>
      </Section>

      <Section
        title="部屋タイプ価格順序ルール"
        desc="部屋タイプ間の価格逆転（例: デラックス < スタンダード）を防ぐかどうかを設定します"
      >
        <Field label="部屋タイプ価格順序を強制する" hint="ONにすると、格上の部屋タイプが格下より安くなることを防止">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.enforce_room_order}
              onChange={e => update("enforce_room_order", e.target.checked)}
            />
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5",
              "after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all",
              "peer-checked:after:translate-x-5",
              form.enforce_room_order ? "bg-[#1E3A8A]" : "bg-slate-200"
            )} />
          </label>
        </Field>
        {form.enforce_room_order && (
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            部屋タイプの価格順序はプライシンググリッドへの適用時に自動検証されます。逆転が検出された場合、警告が表示されます。
          </div>
        )}
      </Section>

      <Section
        title="価格変動上限"
        desc="前日比での価格変動を制限します。急激な価格変動を防ぎブランド価値を保護します"
      >
        <Field label="1日あたり最大変動幅" hint="AI推奨がこの変動幅を超える場合は承認必須になります">
          <NumberInput
            value={form.max_daily_change_pct}
            onChange={v => update("max_daily_change_pct", v)}
            suffix="% 以内"
            min={1}
            max={100}
          />
        </Field>
      </Section>

      <Section
        title="最低宿泊日数 (MinLOS) ルール"
        desc="高稼働期に自動でMinLOSを設定し、短泊による機会損失を防ぎます"
      >
        <Field label="MinLOS自動設定を有効にする" hint="繁忙期に自動でMinLOS制限を適用">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.mlos_enabled}
              onChange={e => update("mlos_enabled", e.target.checked)}
            />
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5",
              "after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all",
              "peer-checked:after:translate-x-5",
              form.mlos_enabled ? "bg-[#1E3A8A]" : "bg-slate-200"
            )} />
          </label>
        </Field>
        {form.mlos_enabled && (
          <>
            <Field label="MinLOS発動 稼働率閾値" hint="この稼働率を超えた日付に対してMinLOSを適用">
              <NumberInput
                value={form.mlos_threshold_occ}
                onChange={v => update("mlos_threshold_occ", v)}
                suffix="% 以上"
                min={50}
                max={100}
              />
            </Field>
            <Field label="最低宿泊日数" hint="発動時に設定されるMinLOS値">
              <NumberInput
                value={form.mlos_min_nights}
                onChange={v => update("mlos_min_nights", v)}
                suffix="泊以上"
                min={2}
                max={7}
              />
            </Field>
          </>
        )}
      </Section>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">注意事項</p>
            <p>現在のプライシングポリシーはブラウザに保存されています。複数デバイスでの共有や、システム全体への自動適用はフェーズ2で対応予定です。設定後は手動でプライシンググリッドの内容を確認してください。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
