"use client";

import { ChevronLeft, DollarSign, ChevronDown, Settings } from "lucide-react";
import Link from "next/link";

export function DashboardHeader() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          ポータルに戻る
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#7C3AED] rounded-lg flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">レベニューダッシュボード</div>
            <div className="text-xs text-gray-400 leading-tight">Revenue Management Dashboard</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors">
          <span>東京・渋谷ホテル</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
        <Link
          href="/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="設定"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-medium">
          田中
        </div>
      </div>
    </header>
  );
}
