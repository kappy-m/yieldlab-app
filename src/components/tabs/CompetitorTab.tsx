"use client";

import { AiSummaryCard } from "@/components/shared/AiSummaryCard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const DATES_CHART = ["10/21", "10/22", "10/23", "10/24", "10/25", "10/26", "10/27", "10/28", "10/29", "10/30", "10/31", "11/1", "11/2", "11/3", "11/4", "11/5"];

const priceData = DATES_CHART.map((date, i) => ({
  date,
  自社: 15000 + Math.sin(i * 0.5) * 2000 + (i > 4 && i < 7 ? 3000 : 0),
  ホテルA: 16000 + Math.cos(i * 0.4) * 2500 + (i > 3 && i < 8 ? 4000 : 0),
  ホテルB: 14500 + Math.sin(i * 0.6) * 1500,
  ホテルC: 17000 + Math.cos(i * 0.3) * 3000,
  ホテルD: 18000 + Math.sin(i * 0.7) * 2000,
  ホテルE: 16500 + Math.cos(i * 0.5) * 2500,
}));

const COMP_HOTELS = ["自社ホテル", "ホテルA", "ホテルB", "ホテルC", "ホテルD", "ホテルE"];
const COMP_COLORS = ["#2563EB", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

const TABLE_DATES = ["10/20月", "10/21火", "10/22水", "10/23木", "10/24金", "10/25土", "10/26日", "10/27月"];

const tableData = COMP_HOTELS.map((hotel, hi) => ({
  hotel,
  color: COMP_COLORS[hi],
  prices: TABLE_DATES.map((_, di) => ({
    price: Math.round((14000 + hi * 1200 + Math.sin(di * 0.7 + hi) * 2000) / 1000),
    stock: Math.round(40 - hi * 1.5 - di * 0.5 + Math.random() * 5),
  })),
}));

export function CompetitorTab() {
  return (
    <div>
      <AiSummaryCard
        summary="競合6社の価格動向を分析した結果、過去7日間で平均12%の値上げトレンドが確認されています。特にホテルA・Cが積極的な価格改定を実施中。当ホテルの現在価格は市場平均より8%低く、ブランド価値を考慮すると価格上げの余地があります。週末を中心に値上げ実施が推奨されます。"
        bullets={[
          "ホテルAは10/23-25を+15%値上げ。当ホテルも追随で推定+¥1.2M収取可能",
          "ホテルC・Dの残室数が急減。11月前半の需要変増が予想され、早期対応が有効",
          "競合平均ADRは¥18,200で、当ホテルは¥16,800。ギャップ縮小により収益性向上",
        ]}
      />

      <div className="yl-card p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">競合価格推移（直近30日間）</h3>
        <p className="text-xs text-gray-400 mb-4">自社と競合6社の掲載価格トレンド比較</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}K`} domain={[8000, 32000]} />
            <Tooltip formatter={(v) => `¥${Number(v).toLocaleString()}`} />
            <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
            {COMP_HOTELS.map((hotel, i) => (
              <Line
                key={hotel}
                type="monotone"
                dataKey={hotel}
                stroke={COMP_COLORS[i]}
                strokeWidth={hotel === "自社ホテル" ? 2.5 : 1.5}
                dot={false}
                strokeDasharray={hotel === "自社ホテル" ? undefined : "0"}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="yl-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">競合ホテル価格・在庫モニタリング</h3>
            <p className="text-xs text-gray-400">競合6社の掲載価格・残室数を90日間追跡</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 text-xs">
              {COMP_HOTELS.map((h, i) => (
                <span key={h} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: COMP_COLORS[i] }} />
                  {h}
                </span>
              ))}
            </div>
            <select className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 ml-3">
              <option>掲載価格</option>
              <option>残室数</option>
            </select>
            <button className="text-xs border border-gray-200 rounded px-3 py-1 text-gray-600 hover:bg-gray-50">エクスポート</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-[120px]">ホテル名</th>
                {TABLE_DATES.map((d, i) => (
                  <th key={d} className={`px-3 py-2.5 text-center text-gray-500 font-medium min-w-[80px] ${(i === 5 || i === 6) ? "text-red-500" : ""}`}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.hotel} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 sticky left-0 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                      <span className={`font-medium ${row.hotel === "自社ホテル" ? "text-blue-600" : "text-gray-700"}`}>{row.hotel}</span>
                    </div>
                  </td>
                  {row.prices.map((p, di) => (
                    <td key={di} className="px-3 py-2.5 text-center">
                      <div className="font-medium text-gray-800">¥{p.price}K</div>
                      <div className="text-gray-400">{p.stock}室</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">※ データは予約サイトから1日3回自動収集されます。</p>
        </div>
      </div>
    </div>
  );
}
