"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRODUCT_LABELS: Record<string, string> = {
  yield: "manage",
  manage: "front",
  review: "review",
  reservation: "reservation",
  sales: "sales",
};

export function DashboardHeader() {
  const pathname = usePathname();

  const currentProductLabel = (() => {
    const segment = pathname.split("/")[1] ?? "";
    return PRODUCT_LABELS[segment] ?? "manage";
  })();

  return (
    <header
      className="sticky top-0 z-50 border-b border-slate-200/80 bg-gradient-to-br from-brand-navy to-blue-800"
    >
      <div className="px-6 py-0 flex items-center h-14">
        <Link href="/yield" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20 group-hover:bg-white/20 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 18L9 6L15 14L19 8L21 18H3Z" fill="#CA8A04" stroke="#CA8A04" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-semibold text-base tracking-tight leading-none">Yieldlab</span>
            <span className="text-sm font-light leading-none" style={{ color: "#CA8A04" }}>{currentProductLabel}</span>
          </div>
        </Link>
      </div>
    </header>
  );
}
