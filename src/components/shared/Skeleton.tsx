import { cn } from "@/lib/utils";

/** ベーススケルトンブロック */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-slate-200 rounded", className)} />;
}

/** KPIカード4枚分スケルトン */
export function SkeletonKpiCards() {
  return (
    <div className="flex gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="yl-card flex-1 px-4 py-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/** チャートエリアスケルトン */
export function SkeletonChart({ height = 220 }: { height?: number }) {
  return (
    <div className="yl-card p-5">
      <Skeleton className="h-4 w-40 mb-4" />
      <div className="animate-pulse" style={{ height }}>
        <div className="flex items-end gap-1.5 h-full">
          {[60, 40, 75, 55, 80, 50, 70, 45, 85, 60, 72, 58, 90, 65, 78, 48].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-slate-200 rounded-t"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** テーブルスケルトン */
export function SkeletonTable({ rows = 5, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="yl-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2.5 text-left"><Skeleton className="h-3 w-24" /></th>
              {[...Array(cols - 1)].map((_, i) => (
                <th key={i} className="px-3 py-2.5 text-center min-w-[72px]">
                  <Skeleton className="h-3 w-12 mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, r) => (
              <tr key={r} className="border-b border-slate-50">
                <td className="px-4 py-2.5"><Skeleton className="h-3 w-32" /></td>
                {[...Array(cols - 1)].map((_, c) => (
                  <td key={c} className="px-3 py-2.5 text-center">
                    <Skeleton className="h-3 w-14 mx-auto" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** カードグリッドスケルトン（競合セットバッジなど） */
export function SkeletonCardGrid({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid gap-2 grid-cols-${cols}`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="yl-card p-3 flex items-center gap-2">
          <Skeleton className="w-2.5 h-2.5 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

/** AIサマリーカードスケルトン */
export function SkeletonAiCard() {
  return (
    <div className="yl-ai-card mb-5 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-6 h-6 rounded-md" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-5/6" />
      <div className="mt-3 space-y-1.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Skeleton className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** イベントカードスケルトン */
export function SkeletonEventCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="py-2 border-b border-slate-50 last:border-0">
          <div className="flex items-center justify-between mb-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-36 mt-1" />
        </div>
      ))}
    </div>
  );
}
