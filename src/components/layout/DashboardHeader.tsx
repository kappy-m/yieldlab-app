"use client";

import { Settings, Building2, Star, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchProperties } from "@/lib/api";

interface Property {
  id: number;
  name: string;
  brand?: string;
  address?: string;
  star_rating?: number;
  total_rooms?: number;
}

export function DashboardHeader() {
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    fetchProperties().then((list) => {
      if (list && list.length > 0) setProperty(list[0]);
    }).catch(() => {});
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b border-slate-200/80"
      style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%)" }}
    >
      <div className="px-6 py-0 flex items-center justify-between h-14">
        {/* ロゴ・サービス名 */}
        <div className="flex items-center gap-3">
          {/* ロゴマーク */}
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M3 18L9 6L15 14L19 8L21 18H3Z"
                fill="#CA8A04"
                stroke="#CA8A04"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {/* サービス名 */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-semibold text-base tracking-tight leading-none">
              Yieldlab
            </span>
            <span
              className="text-sm font-light leading-none"
              style={{ color: "#CA8A04" }}
            >
              manage
            </span>
          </div>
        </div>

        {/* 右側：自社ホテル情報 + 設定 */}
        <div className="flex items-center gap-3">
          {/* ホテル情報バッジ */}
          {property && (
            <div className="flex items-center gap-2.5 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="text-white text-xs font-medium">{property.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {property.address && (
                    <span className="text-white/50 text-[10px] flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {property.address.replace("東京都", "").split("区")[0]}区
                    </span>
                  )}
                  {property.star_rating && (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: property.star_rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-2.5 h-2.5 fill-current"
                          style={{ color: "#CA8A04" }}
                        />
                      ))}
                    </span>
                  )}
                  {property.total_rooms && (
                    <span className="text-white/50 text-[10px]">{property.total_rooms}室</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 設定 */}
          <Link
            href="/settings"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
            title="設定"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* アバター */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border border-white/20"
            style={{ background: "#CA8A04", color: "#1E3A8A" }}
          >
            KM
          </div>
        </div>
      </div>
    </header>
  );
}
