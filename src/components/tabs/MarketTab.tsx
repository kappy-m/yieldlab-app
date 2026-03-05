"use client";

import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { Calendar, TrendingUp, Building2, Music, Briefcase, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENTS = [
  {
    name: "東京モーターショー",
    type: "イベント",
    dates: "10/23〜10/25",
    venue: "東京ビッグサイト",
    desc: "大規模イベント。周辺ホテルの稼働率上昇が予想されます。",
    impact: "影響大",
    impactAmount: "+¥17.0M",
    icon: Building2,
    color: "text-purple-600 bg-purple-50",
    impactColor: "text-green-600",
  },
  {
    name: "日本医師会総会",
    type: "会議",
    dates: "10/28〜10/30",
    venue: "パシフィコ横浜",
    desc: "医療関係者3,000名が参加予定。ビジネス需要が見込まれます。",
    impact: "影響大",
    impactAmount: "+¥9.2M",
    icon: Briefcase,
    color: "text-blue-600 bg-blue-50",
    impactColor: "text-green-600",
  },
  {
    name: "人気アーティストライブ",
    type: "コンサート",
    dates: "11/5〜11/6",
    venue: "東京ドーム",
    desc: "2日間で10万人規模のライブイベント。若年層の宿泊需要が増加します。",
    impact: "影響大",
    impactAmount: "+¥13.0M",
    icon: Music,
    color: "text-pink-600 bg-pink-50",
    impactColor: "text-green-600",
  },
  {
    name: "国際IT展示会",
    type: "会議",
    dates: "11/12〜11/14",
    venue: "幕張メッセ",
    desc: "テクノロジー系のビジネス客が中心。平日需要が高まります。",
    impact: "影響中",
    impactAmount: "+¥5.8M",
    icon: Briefcase,
    color: "text-indigo-600 bg-indigo-50",
    impactColor: "text-yellow-600",
  },
  {
    name: "クリスマスマーケット開催",
    type: "イベント",
    dates: "12/1〜12/25",
    venue: "日比谷公園",
    desc: "長期イベント。週末の観光客増加が見込まれます。",
    impact: "影響中",
    impactAmount: "+¥8.5M",
    icon: Calendar,
    color: "text-red-600 bg-red-50",
    impactColor: "text-yellow-600",
  },
  {
    name: "年末年始の交通規制",
    type: "注意",
    dates: "12/28〜1/3",
    venue: "都心部全域",
    desc: "交通規制により一部アクセスに影響。事前の案内が必要です。",
    impact: "影響小",
    impactAmount: "¥-0.2M",
    icon: AlertTriangle,
    color: "text-orange-600 bg-orange-50",
    impactColor: "text-red-500",
  },
];

const impactBadge: Record<string, string> = {
  "影響大": "text-green-700 bg-green-50 border border-green-200",
  "影響中": "text-yellow-700 bg-yellow-50 border border-yellow-200",
  "影響小": "text-gray-500 bg-gray-50 border border-gray-200",
};

export function MarketTab() {
  const bigImpact = EVENTS.filter((e) => e.impact === "影響大");
  const totalImpact = EVENTS.filter((e) => e.impactAmount.startsWith("+"))
    .reduce((sum, e) => sum + parseFloat(e.impactAmount.replace(/[^0-9.]/g, "")), 0);

  return (
    <div>
      <AiSummaryCard
        summary="今後90日間で6件の大型イベントが検出されており、合計+¥53.3Mの売上インパクトが見込まれます。特に10月23-25日の東京モーターショーは周辺ホテル稼働率95%近えの予測で、当ホテルへの需要集中が期待されます。また、11月5-6日の東京ドームライブは若年層中心のため、SNS映えする体験型プラン追加が効果的です。"
        bullets={[
          "影響大イベント3件により、デラックス以上の部屋タイプで20-30%の価格引き上げ推薦",
          "国際医療機器展（11/18-20）は新規検出。ビジネス客向けの早期対応で先行予約確得",
          "12/28-1/3の交通規制について、宿泊者への事前案内でキャンセル率低減を図ります",
        ]}
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="yl-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">今後のイベント</div>
            <div className="text-2xl font-bold text-gray-900">{EVENTS.length}件</div>
          </div>
        </div>
        <div className="yl-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">影響大イベント</div>
            <div className="text-2xl font-bold text-gray-900">{bigImpact.length}件</div>
          </div>
        </div>
        <div className="yl-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">予想売上インパクト</div>
            <div className="text-2xl font-bold text-green-600">+¥{totalImpact.toFixed(1)}M</div>
          </div>
        </div>
      </div>

      <div className="yl-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">周辺イベント・ニュース</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {EVENTS.map((ev) => (
            <div key={ev.name} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", ev.color)}>
                  <ev.icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{ev.name}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{ev.type}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded", impactBadge[ev.impact])}>{ev.impact}</span>
                      <span className={cn("text-sm font-bold", ev.impactColor)}>{ev.impactAmount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-1.5">
                    <span>📅 {ev.dates}</span>
                    <span>📍 {ev.venue}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{ev.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
