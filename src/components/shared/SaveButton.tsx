"use client";

import { useState } from "react";
import { Save, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  onSave?: () => void;
  label?: string;
  savedLabel?: string;
}

export function SaveButton({ onSave, label = "変更を保存", savedLabel = "保存しました" }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const handle = () => {
    onSave?.();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="flex justify-end mt-6">
      <button
        onClick={handle}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
          saved
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-brand-navy text-white hover:bg-brand-navy/90"
        )}
      >
        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? savedLabel : label}
      </button>
    </div>
  );
}
