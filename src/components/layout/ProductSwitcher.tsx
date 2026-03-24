"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Building2, Star, ClipboardList, Calendar } from "lucide-react";

const PRODUCTS = [
  {
    code: "yield",
    label: "Yield",
    icon: TrendingUp,
    href: "/yield",
    description: "レベニューマネジメント",
  },
  {
    code: "manage",
    label: "Manage",
    icon: Building2,
    href: "/manage",
    description: "フロント業務管理",
  },
  {
    code: "review",
    label: "Review",
    icon: Star,
    href: "/review",
    description: "口コミ・評価管理",
  },
  {
    code: "reservation",
    label: "Reservation",
    icon: Calendar,
    href: "/reservation",
    description: "予約管理",
  },
] as const;

export function ProductSwitcher() {
  const pathname = usePathname();

  // ログイン済みユーザーのプロダクト権限を取得
  const productRoles: Record<string, string> = (() => {
    if (typeof window === "undefined") return {};
    try {
      const user = JSON.parse(localStorage.getItem("yl_user") ?? "{}");
      return user.product_roles ?? {};
    } catch {
      return {};
    }
  })();

  const accessibleProducts = PRODUCTS.filter((p) => productRoles[p.code]);

  if (accessibleProducts.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 bg-white/10 rounded-lg p-1 border border-white/20">
      {accessibleProducts.map((product) => {
        const Icon = product.icon;
        const isActive = pathname.startsWith(product.href);
        return (
          <Link
            key={product.code}
            href={product.href}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-white/70 hover:text-white hover:bg-white/10"
              }
            `}
            title={product.description}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{product.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
