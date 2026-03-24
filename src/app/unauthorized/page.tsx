"use client";

import Link from "next/link";
import { ShieldOff, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">アクセス権限がありません</h1>
        <p className="text-slate-400 mb-8">
          このプロダクトへのアクセス権限が付与されていません。<br />
          管理者にお問い合わせください。
        </p>
        <Link
          href="/yield"
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Yieldに戻る
        </Link>
      </div>
    </div>
  );
}
