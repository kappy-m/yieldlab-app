"use client";

import { ChevronLeft, DollarSign, Settings, Building2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchProperties } from "@/lib/api";

interface Property {
  id: number;
  name: string;
}

export function DashboardHeader() {
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    fetchProperties().then((list) => {
      if (list && list.length > 0) setProperty(list[0]);
    }).catch(() => {});
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        {/* ポータルに戻る → yieldlab.dev へのリンク */}
        <Link
          href="https://yieldlab.dev"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          ポータルに戻る
        </Link>
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
        {/* ホテル名をAPIから取得して表示（現在は単一ホテルのみ） */}
        <div
          className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5"
          title="マルチホテル切替は今後対応予定"
        >
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
          <span>{property?.name ?? "読み込み中..."}</span>
        </div>
        <Link
          href="/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          title="設定"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <div className="w-8 h-8 bg-[#7C3AED] rounded-full flex items-center justify-center text-white text-xs font-medium">
          KM
        </div>
      </div>
    </header>
  );
}
