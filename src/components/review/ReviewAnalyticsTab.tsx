"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { KEYWORDS, CATEGORY_RATINGS, LANGUAGE_DIST } from "./reviewData";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-100 text-green-700 border-green-200",
  neutral:  "bg-slate-100 text-slate-600 border-slate-200",
  negative: "bg-red-100 text-red-600 border-red-200",
};

const LANG_BAR_COLORS = ["#1E3A8A", "#3B82F6", "#93C5FD", "#BFDBFE", "#DBEAFE"];

export function ReviewAnalyticsTab({ propertyId: _propertyId }: { propertyId: number }) {
  const maxKeywordCount = Math.max(...KEYWORDS.map((k) => k.count));

  return (
    <div className="space-y-5">

      {/* 上段: キーワード + 言語分布 */}
      <div className="grid grid-cols-2 gap-4">

        {/* 頻出キーワード */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">頻出キーワード</h3>
          <p className="text-xs text-slate-400 mb-4">口コミ本文から抽出した頻出ワードと感情傾向</p>
          <div className="flex flex-wrap gap-2">
            {KEYWORDS.map((kw) => {
              const sizeScale = 0.75 + (kw.count / maxKeywordCount) * 0.5;
              return (
                <span
                  key={kw.word}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium cursor-default select-none transition-opacity hover:opacity-80 ${SENTIMENT_COLORS[kw.sentiment]}`}
                  style={{ fontSize: `${Math.round(sizeScale * 12)}px` }}
                  title={`${kw.count} 件`}
                >
                  {kw.word}
                  <span className="opacity-60 text-[10px]">({kw.count})</span>
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-slate-500">ポジティブ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="text-[10px] text-slate-500">ニュートラル</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-[10px] text-slate-500">ネガティブ</span>
            </div>
          </div>
        </div>

        {/* 言語別分布 */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">言語別分布</h3>
          <p className="text-xs text-slate-400 mb-4">口コミの言語構成（全 {LANGUAGE_DIST.reduce((s, l) => s + l.count, 0)} 件）</p>
          <div className="space-y-3">
            {LANGUAGE_DIST.map((item, i) => (
              <div key={item.code}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600">{item.lang}</span>
                  <span className="text-xs text-slate-400">{item.count}件 ({item.pct}%)</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.pct}%`, background: LANG_BAR_COLORS[i] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              インバウンド比率: <strong className="text-slate-600">42%</strong>（先月比 +3%）
            </p>
          </div>
        </div>
      </div>

      {/* カテゴリ別評価スコア */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">カテゴリ別評価スコア</h3>
        <p className="text-xs text-slate-400 mb-4">口コミ内容を AI が分類・集計したカテゴリ別スコア（5.0満点）</p>
        <div className="grid grid-cols-2 gap-6">
          {/* バーチャート */}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={CATEGORY_RATINGS}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} tickCount={6}
                tickFormatter={(v) => v.toFixed(1)} />
              <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${(v as number).toFixed(1)} / 5.0`, "スコア"]} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {CATEGORY_RATINGS.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.score >= 4.5 ? "#22C55E" : entry.score >= 4.0 ? "#1E3A8A" : entry.score >= 3.5 ? "#CA8A04" : "#EF4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* スコアカード一覧 */}
          <div className="flex flex-col justify-center gap-2">
            {CATEGORY_RATINGS.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-28 flex-shrink-0">{c.category}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(c.score / 5) * 100}%`,
                      background: c.score >= 4.5 ? "#22C55E" : c.score >= 4.0 ? "#1E3A8A" : c.score >= 3.5 ? "#CA8A04" : "#EF4444",
                    }}
                  />
                </div>
                <span className={`text-xs font-bold w-8 text-right flex-shrink-0 ${
                  c.score >= 4.5 ? "text-green-600" : c.score >= 4.0 ? "text-blue-700" : c.score >= 3.5 ? "text-amber-600" : "text-red-500"
                }`}>
                  {c.score.toFixed(1)}
                </span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400">
                改善優先度: <span className="text-amber-600 font-semibold">コスパ (3.9)</span> → <span className="text-slate-600">設備 (4.0)</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* プラットフォーム別月次サマリー */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">プラットフォーム別 サマリー（3月）</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { platform: "Google",      total: 87,  positive: 72, negative: 5,  neutral: 10, responded: 21 },
            { platform: "楽天トラベル", total: 118, positive: 89, negative: 15, neutral: 14, responded: 43 },
            { platform: "Expedia",      total: 48,  positive: 38, negative: 3,  neutral: 7,  responded: 12 },
            { platform: "Booking.com",  total: 15,  positive: 11, negative: 2,  neutral: 2,  responded: 3  },
          ].map((p) => (
            <div key={p.platform} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">{p.platform}</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-[10px] text-slate-400">総件数</span>
                  <span className="text-[10px] font-semibold text-slate-700">{p.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-green-500">ポジティブ</span>
                  <span className="text-[10px] font-semibold text-green-600">{p.positive}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-red-400">ネガティブ</span>
                  <span className="text-[10px] font-semibold text-red-500">{p.negative}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-[10px] text-slate-400">返信済み</span>
                  <span className="text-[10px] font-semibold text-blue-600">
                    {p.responded}/{p.total}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
