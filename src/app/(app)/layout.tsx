import { ProductSidebar } from "@/components/layout/ProductSidebar";

/**
 * (app) Route Group Layout
 * 全プロダクト共通シェル: 左サイドバー（アクセス可能プロダクトが2つ以上の場合のみ表示）
 * 1プロダクトのみのユーザーはサイドバーなしのフルワイドレイアウトになる。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ProductSidebar />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
