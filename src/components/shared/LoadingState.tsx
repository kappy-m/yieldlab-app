"use client";

import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "データを読み込み中..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Loader2 className="w-8 h-8 text-brand-navy animate-spin mb-3" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
