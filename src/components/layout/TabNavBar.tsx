"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  /** オプション: 右端に配置するアイコン付きタブ（設定ボタンなど）に使用 */
  icon?: React.ComponentType<{ className?: string }>;
  /** true の場合このタブを右端に配置 */
  alignRight?: boolean;
}

interface TabNavBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /**
   * true: タブ数が少ない（2〜4個）場合の等幅モード（セグメントコントロール風）
   * false（デフォルト）: 自然幅＋最小幅モード（タブ数が多い場合向け）
   */
  equalWidth?: boolean;
}

/**
 * 全プロダクト共通のタブナビゲーション。
 * 統一規格:
 *   - ボタン幅: min-w-[110px] + text-center（短ラベルも最小幅を確保）
 *   - ボタンパディング: px-4 py-3
 *   - フォント: text-sm font-medium
 *   - アクティブ色: #1E3A8A（Yieldlab Navy）
 *   - インジケーター: h-0.5 scale-y transition
 *   - nav左余白: px-6（DashboardHeader の px-6 と揃える）
 */
export function TabNavBar({ tabs, activeTab, onTabChange, equalWidth = false }: TabNavBarProps) {
  const leftTabs = tabs.filter((t) => !t.alignRight);
  const rightTabs = tabs.filter((t) => t.alignRight);

  return (
    <nav className="sticky top-14 z-30 bg-white border-b border-slate-200 shadow-sm overflow-x-auto">
      <div className="flex items-center justify-between px-6 min-w-max">
        {/* 左側タブ群 */}
        <div className="flex items-center">
          {leftTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={onTabChange}
              equalWidth={equalWidth}
            />
          ))}
        </div>

        {/* 右端タブ群（設定など） */}
        {rightTabs.length > 0 && (
          <div className="flex items-center ml-2">
            {rightTabs.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={onTabChange}
                equalWidth={false}
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onClick: (id: string) => void;
  equalWidth: boolean;
}

function TabButton({ tab, isActive, onClick, equalWidth }: TabButtonProps) {
  const Icon = tab.icon;
  return (
    <button
      onClick={() => onClick(tab.id)}
      className={cn(
        "relative flex items-center justify-center gap-1.5",
        "py-3 px-4",
        // equalWidth: 等幅モード（タブ数が少ない場合）
        // 通常: 自然幅＋最小幅（タブ数が多い場合）
        equalWidth ? "w-[140px]" : "min-w-[110px]",
        "text-sm font-medium whitespace-nowrap text-center",
        "transition-colors duration-150 cursor-pointer",
        isActive
          ? "text-[#1E3A8A]"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 rounded-t"
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{tab.label}</span>

      {/* アクティブインジケーター（下線） */}
      <span
        className={cn(
          "absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A8A] rounded-t",
          "transition-transform duration-200 origin-bottom",
          isActive ? "scale-y-100" : "scale-y-0"
        )}
      />
    </button>
  );
}
