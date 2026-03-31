"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "データの取得に失敗しました",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-yl-negative" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">エラーが発生しました</h3>
      <p className="text-xs text-slate-400 max-w-xs mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-navy hover:text-brand-navy/80 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          再試行
        </button>
      )}
    </div>
  );
}
