"use client";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Building2, Wrench } from "lucide-react";

// JWT ガードは middleware.ts に一元化済み。
export default function ManagePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader propertyId={1} onPropertyChange={() => {}} />
      <main className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="text-center p-12">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Front</h1>
          <p className="text-slate-500 mb-6">フロント業務管理プロダクト</p>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
            <Wrench className="w-4 h-4" />
            開発中 — Coming Soon
          </div>
        </div>
      </main>
    </div>
  );
}
