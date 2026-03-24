"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Star, Wrench } from "lucide-react";

export default function ReviewPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("yl_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const user = JSON.parse(localStorage.getItem("yl_user") ?? "{}");
    if (!user.product_roles?.review) {
      router.replace("/unauthorized");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader propertyId={1} onPropertyChange={() => {}} />
      <main className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="text-center p-12">
          <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Review</h1>
          <p className="text-slate-500 mb-6">口コミ・評価管理プロダクト</p>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
            <Wrench className="w-4 h-4" />
            開発中 — Coming Soon
          </div>
        </div>
      </main>
    </div>
  );
}
