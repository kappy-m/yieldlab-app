"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TrendingUp, Building2, Star, Calendar } from "lucide-react";

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

export function ProductSidebar() {
  const pathname = usePathname();
  // null = 未マウント（SSR・ハイドレーション中はレンダリング抑制）
  const [productRoles, setProductRoles] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("yl_user") ?? "{}");
      setProductRoles(user.product_roles ?? {});
    } catch {
      setProductRoles({});
    }
  }, []);

  // SSR/ハイドレーション中は何もレンダリングしない
  if (productRoles === null) return null;

  const accessibleProducts = PRODUCTS.filter((p) => productRoles[p.code]);

  // 1つ以下のプロダクトしかない場合はサイドバー非表示（フルワイドレイアウト）
  if (accessibleProducts.length <= 1) return null;

  return (
    <aside
      className="sticky top-0 h-screen w-12 flex-shrink-0 flex flex-col border-r border-white/10 z-40"
      style={{ background: "linear-gradient(180deg, #1E3A8A 0%, #1e40af 100%)" }}
    >
      {/* ヘッダー（h-14 = 56px）分の余白 — ヘッダーと視覚的に揃える */}
      <div className="h-14 flex-shrink-0" />

      {/* プロダクトナビゲーション */}
      <nav className="flex flex-col items-center py-3 gap-0.5" aria-label="プロダクト切り替え">
        {accessibleProducts.map((product) => {
          const Icon = product.icon;
          const isActive = pathname.startsWith(product.href);

          return (
            <div key={product.code} className="relative group w-full">
              {/* アクティブインジケーター — ゴールドの左ボーダーバー */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full transition-all duration-200"
                style={{
                  height: isActive ? "28px" : "0px",
                  background: "#CA8A04",
                  opacity: isActive ? 1 : 0,
                }}
              />

              <Link
                href={product.href}
                className={`
                  flex items-center justify-center w-12 h-11 transition-all duration-200 rounded-none
                  ${isActive
                    ? "text-white"
                    : "text-white/40 hover:text-white/90 hover:bg-white/10"
                  }
                `}
                aria-label={product.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
              </Link>

              {/* ホバーツールチップ */}
              <div
                className="
                  absolute left-full top-1/2 -translate-y-1/2 ml-2
                  px-3 py-2 rounded-lg
                  opacity-0 group-hover:opacity-100
                  pointer-events-none whitespace-nowrap
                  transition-opacity duration-150 z-50
                  shadow-xl
                "
                style={{ background: "rgba(15, 23, 42, 0.95)" }}
              >
                <p className="text-white text-xs font-semibold leading-none">{product.label}</p>
                <p className="text-white/50 text-[10px] mt-0.5 leading-none">{product.description}</p>
                {/* 左向き矢印 */}
                <div
                  className="absolute right-full top-1/2 -translate-y-1/2"
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderRight: "5px solid rgba(15, 23, 42, 0.95)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
