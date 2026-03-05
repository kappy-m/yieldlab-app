"use client";

import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { cn } from "@/lib/utils";

const MONTHS = ["当月宿泊実績\n2025年10月（1日〜20日）", "当月オンハンド\n2025年10月（21日〜31日）", "翌月オンハンド\n2025年11月", "翌々月オンハンド\n2025年12月"];
const MONTH_DATA = [
  { revenue: "¥45,820,000", revChange: "+12.5%", budget: "¥42,000,000", budgetRate: "109.1%", rooms: "2,850室", roomChange: "+8.3%", occ: "87%", label: "宿泊実績" },
  { revenue: "¥28,400,000", revChange: "+6.8%", budget: "¥30,000,000", budgetRate: "94.7%", rooms: "1,650室", roomChange: "+4.2%", occ: "68%", label: "オンハンド" },
  { revenue: "¥38,500,000", revChange: "+5.2%", rooms: "2,420室", roomChange: "+3.8%", occ: "74%", label: "オンハンド" },
  { revenue: "¥52,300,000", revChange: "+15.7%", rooms: "2,680室", roomChange: "+12.4%", occ: "82%", label: "オンハンド" },
];

const DATES_HEATMAP = ["10/20月", "10/21火", "10/22水", "10/23木", "10/24金", "10/25土", "10/26日", "10/27月", "10/28火", "10/29水"];
const LEAD_TIMES = ["90日前", "60日前", "45日前", "30日前", "21日前", "14日前", "7日前", "3日前", "0日前"];

const rawHeatmap = [
  [0,20,36,50,49,58,72,59,63],
  [0,23,35,44,55,59,73,70,75],
  [0,22,34,51,57,50,55,62,76],
  [0,22,31,50,46,81,67,59,91],
  [1,23,30,51,53,64,73,69,91],
  [0,25,37,49,65,81,67,93,91],
  [0,26,36,58,72,82,77,93,76],
  [0,21,31,53,59,83,62,76,76],
  [0,24,40,40,55,62,55,64,60],
  [0,21,32,40,48,54,60,70,73],
];

const prevHeatmap = [
  [3,22,35,49,52,55,80,65,63],
  [3,19,44,49,59,68,70,73,82],
  [0,22,42,46,49,50,65,72,86],
  [3,18,28,46,41,77,70,62,69],
  [1,21,34,47,55,65,69,71,69],
  [7,21,47,48,63,86,74,96,100],
  [4,31,35,62,79,70,72,96,82],
  [3,30,36,69,68,70,72,80,80],
  [3,37,37,43,44,62,66,73,65],
  [3,20,28,41,44,54,66,80,75],
];

function getHeatColor(occ: number): string {
  if (occ === 0) return "bg-gray-50 text-gray-300";
  if (occ < 20) return "bg-blue-100 text-blue-700";
  if (occ < 40) return "bg-blue-200 text-blue-800";
  if (occ < 60) return "bg-blue-400 text-white";
  if (occ < 75) return "bg-green-400 text-white";
  if (occ < 85) return "bg-yellow-400 text-gray-800";
  if (occ < 95) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

const ROOM_TYPES_TABLE = ["スタンダードシングル", "スタンダードツイン", "デラックスツイン", "スーペリアダブル", "プレミアムスイート"];
const roomTableData = [
  { revenue: "¥8,500,000", rooms: 680, occ: "88%", adr: "¥12,500" },
  { revenue: "¥12,800,000", rooms: 720, occ: "92%", adr: "¥17,778" },
  { revenue: "¥9,200,000", rooms: 420, occ: "85%", adr: "¥21,905" },
  { revenue: "¥7,100,000", rooms: 380, occ: "79%", adr: "¥18,684" },
  { revenue: "¥8,220,000", rooms: 650, occ: "83%", adr: "¥12,646" },
];

export function BookingTab() {
  return (
    <div>
      <AiSummaryCard
        summary="当月の予約進捗は順調で、宿泊実績・オンハンドともに前年同月比でプラス成長を達成しています。ブッキングカーブ分析では、30日前からの予約獲得が昨年比+5.2%と好調。特にスタンダードツイン・デラックスツインの需要が高く、早期の価格最適化により更なる収益向上が見込めます。"
        bullets={[
          "翌月（12月）のオンハンド稼働率82%は過去3年で最高水準。クリスマス・年末需要を捉えています",
          "翌月（11月）の平日稼働率が前年比-8%。ビジネス客向けの策定強化を推奨",
          "部屋タイプ別では、スタンダードツインが稼働率92%と最も高く、価格調整余地あり",
        ]}
      />

      <div className="grid grid-cols-4 gap-3 mb-5">
        {MONTH_DATA.map((data, i) => (
          <div key={i} className="yl-card p-4">
            <div className="text-xs text-gray-400 mb-3 whitespace-pre-line leading-relaxed">{MONTHS[i]}</div>
            <div className="space-y-2">
              <div>
                <div className="text-lg font-bold text-gray-900">{data.revenue}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-green-600 font-medium">{data.revChange}</span>
                  {data.budget && <span className="text-xs text-gray-400">予算 {data.budget}</span>}
                </div>
                {data.budgetRate && <div className="text-xs text-gray-500">予算対比 {data.budgetRate}</div>}
              </div>
              <div className="pt-2 border-t border-gray-50">
                <div className="text-sm font-semibold text-gray-800">{data.rooms}</div>
                <div className="text-xs text-green-600">{data.roomChange}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">稼働率</span>
                  <span className="text-sm font-bold text-gray-800">{data.occ}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: data.occ }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="yl-card overflow-hidden mb-5">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">ブッキングカーブ ヒートマップ（90日間）</h3>
            <p className="text-xs text-gray-400">各宿泊日の予約獲得推移を朔的に可視化</p>
          </div>
          <select className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
            <option>全部屋タイプ</option>
            <option>スタンダードシングル</option>
            <option>スタンダードツイン</option>
          </select>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 text-xs">
          <span className="text-gray-500">稼働率（今年）：</span>
          {["0-20%", "20-40%", "40-60%", "60-75%", "75-85%", "85-95%", "95-100%"].map((label, i) => (
            <span key={i} className={cn("px-2 py-0.5 rounded text-xs", ["bg-blue-100 text-blue-700","bg-blue-200 text-blue-800","bg-blue-400 text-white","bg-green-400 text-white","bg-yellow-400 text-gray-800","bg-orange-400 text-white","bg-red-500 text-white"][i])}>{label}</span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-[80px]">宿泊日</th>
                {LEAD_TIMES.map((lt) => (
                  <th key={lt} className="px-2 py-2 text-center text-gray-500 font-medium min-w-[70px]">{lt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATES_HEATMAP.map((date, di) => (
                <tr key={date} className="border-b border-gray-50">
                  <td className={cn("px-4 py-1.5 sticky left-0 bg-white font-medium", (di === 5 || di === 6) ? "text-red-500" : "text-gray-700")}>
                    <div>{date.slice(0, 5)}</div>
                    <div className="text-gray-400 font-normal">{date.slice(5)}</div>
                  </td>
                  {(rawHeatmap[di] ?? []).map((occ, li) => {
                    const prev = prevHeatmap[di]?.[li] ?? 0;
                    const diff = occ - prev;
                    return (
                      <td key={li} className={cn("px-1 py-1.5 text-center", getHeatColor(occ))}>
                        <div className="font-medium">{occ}%</div>
                        <div className="text-[10px] opacity-75">前{prev}%</div>
                        <div className={cn("text-[10px] font-bold", diff >= 0 ? "opacity-80" : "opacity-80")}>
                          {diff >= 0 ? "+" : ""}{diff}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-[#F5F3FF]">
          <p className="text-xs text-[#5B21B6]">
            <span className="font-medium">AI分析：</span>
            ヒートマップ分析により、週末（土日）の予約獲得ペースが平日より早いことが確認できます。昨年比では、全体として予約獲得ペースが向上しており、特に30日前時点での稼働率が昨年比+5〜8%と好調です。一方、14日前時点でも稼働率が60%未満かつ昨年比マイナスの日程は、プロモーション施策の検討が推奨されます。
          </p>
        </div>
      </div>

      <div className="yl-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">部屋タイプ別内訳（当月）</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-2.5 text-gray-500 font-medium">部屋タイプ</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">売上</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">室数</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">稼働率</th>
              <th className="text-right px-5 py-2.5 text-gray-500 font-medium">ADR</th>
            </tr>
          </thead>
          <tbody>
            {ROOM_TYPES_TABLE.map((room, i) => (
              <tr key={room} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-5 py-2.5 text-gray-800 font-medium">{room}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{roomTableData[i]?.revenue}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{roomTableData[i]?.rooms}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={cn("font-medium", Number(roomTableData[i]?.occ) > 88 ? "text-green-600" : "text-gray-700")}>{roomTableData[i]?.occ}</span>
                </td>
                <td className="px-5 py-2.5 text-right text-gray-700">{roomTableData[i]?.adr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
