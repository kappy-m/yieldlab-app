/**
 * (app) Route Group Layout
 * 全プロダクト共通: AppShell は各プロダクトページが自身の DashboardHeader を持つため、
 * ここではシンプルに children をレンダリングするだけ。
 * 将来: ここにグローバルナビゲーション / Toast / AnalyticsProvider を追加できる。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
