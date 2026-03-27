"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

import { OwnRakutenNoPanel }  from "@/components/settings/OwnRakutenNoPanel";
import { EventAreaPanel }     from "@/components/settings/EventAreaPanel";
import { CompSetPanel }       from "@/components/settings/CompSetPanel";
import { BarLadderPanel }     from "@/components/settings/BarLadderPanel";
import { ApprovalPanel }      from "@/components/settings/ApprovalPanel";
import { IntegrationsPanel }  from "@/components/settings/IntegrationsPanel";
import { CsvImportPanel }     from "@/components/settings/CsvImportPanel";
import { PricingPolicyPanel } from "@/components/settings/PricingPolicyPanel";
import { UserAccessPanel }    from "./UserAccessPanel";
import { CommonSettingsLink } from "@/components/settings/CommonSettingsPanel";

type SettingsSubTab =
  | "compset"
  | "barladder"
  | "pricing_policy"
  | "approval"
  | "data"
  | "integrations"
  | "users";

const SUB_TABS: { id: SettingsSubTab; label: string }[] = [
  { id: "compset",        label: "競合セット管理" },
  { id: "barladder",      label: "BARラダー" },
  { id: "pricing_policy", label: "プライシングポリシー" },
  { id: "approval",       label: "承認設定" },
  { id: "data",           label: "データ管理" },
  { id: "integrations",   label: "外部システム連携" },
  { id: "users",          label: "ユーザー管理" },
];

export function SettingsTab({ propertyId }: { propertyId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>("compset");

  return (
    <div className="space-y-0">
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer",
              activeSubTab === tab.id
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "compset" && (
        <>
          <OwnRakutenNoPanel propertyId={propertyId} />
          <EventAreaPanel    propertyId={propertyId} />
          <CompSetPanel      propertyId={propertyId} />
        </>
      )}
      {activeSubTab === "barladder"      && <BarLadderPanel      propertyId={propertyId} />}
      {activeSubTab === "pricing_policy" && <PricingPolicyPanel  propertyId={propertyId} />}
      {activeSubTab === "approval"       && <ApprovalPanel       propertyId={propertyId} />}
      {activeSubTab === "data"           && <CsvImportPanel      propertyId={propertyId} />}
      {activeSubTab === "integrations"   && <IntegrationsPanel />}
      {activeSubTab === "users"          && <UserAccessPanel />}

      <CommonSettingsLink />
    </div>
  );
}
