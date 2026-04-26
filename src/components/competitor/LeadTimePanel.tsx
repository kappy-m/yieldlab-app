"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AlertCircle, Info } from "lucide-react";
import {
  fetchLeadTimeCurves,
  type LeadTimeCurveOut,
  type CompetitorStrategy,
} from "@/lib/api/competitor";

const COMP_COLORS = ["#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

function formatPrice(p: number) {
  return `¥${p.toLocaleString()}`;
}

const STRATEGY_LABELS: Record<CompetitorStrategy, string> = {
  premium_holder: "プレミアム維持型",
  demand_follower: "需要追従型",
  last_minute_discounter: "直前値引き型",
  stable_pricer: "安定価格型",
  insufficient_data: "データ不足",
};

const STRATEGY_COLORS: Record<CompetitorStrategy, string> = {
  premium_holder: "bg-violet-50 text-violet-700 border-violet-200",
  demand_follower: "bg-green-50 text-green-700 border-green-200",
  last_minute_discounter: "bg-red-50 text-red-700 border-red-200",
  stable_pricer: "bg-blue-50 text-blue-700 border-blue-200",
  insufficient_data: "bg-slate-50 text-slate-500 border-slate-200",
};

const STRATEGY_DESCRIPTIONS: Record<CompetitorStrategy, string> = {
  premium_holder: "リードタイム全体で高価格を維持。値引きしない強気戦略。競合わせると不利になりやすい。",
  demand_follower: "遠い時点では低価格、チェックインが近づくほど値上げ。需要に応じた適切な価格調整。",
  last_minute_discounter: "直前14日以内に急落する傾向あり。空室を最後に安売りするパターン。値引き競争に巻き込まれないよう注意。",
  stable_pricer: "変動が小さく一定価格帯を維持。戦略的な動きが少ない。",
  insufficient_data: "分析に必要なデータが不足しています（5件未満）。",
};

interface LeadTimePanelProps {
  propertyId: number;
}

export function LeadTimePanel({ propertyId }: LeadTimePanelProps) {
  const [data, setData] = useState<LeadTimeCurveOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetchLeadTimeCurves(propertyId)
      .then((res) => {
        setData(res);
        setSelectedCompetitors(new Set(res.map((c) => c.competitor_name)));
      })
      .catch(() => setError("リードタイムデータの取得に失敗しました。"))
      .finally(() => setLoading(false));
  }, [propertyId]);

  // 全days_before値のユニーク集合（X軸用）
  const allDays = useMemo(() => {
    const s = new Set<number>();
    for (const comp of data) {
      for (const pt of comp.curves) s.add(pt.days_before);
    }
    return Array.from(s).sort((a, b) => b - a); // 降順: 遠い→近い
  }, [data]);

  // recharts 用フラットデータ
  const chartData = useMemo(() => {
    return allDays.map((d) => {
      const row: Record<string, number | string | null> = { days_before: d };
      for (const comp of data) {
        if (!selectedCompetitors.has(comp.competitor_name)) continue;
        const pt = comp.curves.find((c) => c.days_before === d);
        row[comp.competitor_name] = pt ? pt.avg_price : null;
      }
      return row;
    });
  }, [allDays, data, selectedCompetitors]);

  const toggleCompetitor = (name: string) => {
    setSelectedCompetitors((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-40 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-10 text-slate-500 text-sm">
        <AlertCircle className="w-4 h-4 text-red-400" />
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
        <Info className="w-8 h-8" />
        <p className="text-sm">データがありません。パイプラインを実行して競合価格を取得してください。</p>
      </div>
    );
  }

  const allSelected = data.every((c) => selectedCompetitors.has(c.competitor_name));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedCompetitors(new Set());
    } else {
      setSelectedCompetitors(new Set(data.map((c) => c.competitor_name)));
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 戦略バッジ一覧 */}
      <div className="yl-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">競合の値付け戦略</h3>
          <button
            onClick={toggleAll}
            className="text-[11px] text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md px-2 py-0.5 transition-colors cursor-pointer"
          >
            {allSelected ? "全て非表示" : "全て表示"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((comp, i) => {
            const samples = comp.total_samples;
            const sampleQuality =
              samples >= 30
                ? { label: `${samples}件`, cls: "text-green-600 bg-green-50 border-green-200" }
                : samples >= 10
                  ? { label: `${samples}件`, cls: "text-amber-600 bg-amber-50 border-amber-200" }
                  : { label: `${samples}件（少）`, cls: "text-red-500 bg-red-50 border-red-200" };

            return (
              <button
                key={comp.competitor_name}
                type="button"
                onClick={() => toggleCompetitor(comp.competitor_name)}
                className={`p-3 rounded-lg border cursor-pointer transition-all text-left w-full ${
                  selectedCompetitors.has(comp.competitor_name)
                    ? "ring-2 ring-offset-1 ring-brand-navy/30 bg-white"
                    : "opacity-40 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: COMP_COLORS[i % COMP_COLORS.length] }}
                    />
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {comp.competitor_name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      STRATEGY_COLORS[comp.strategy]
                    }`}
                  >
                    {STRATEGY_LABELS[comp.strategy]}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {STRATEGY_DESCRIPTIONS[comp.strategy]}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${sampleQuality.cls}`}>
                    {sampleQuality.label}
                  </span>
                  {comp.strategy === "last_minute_discounter" && (
                    <span className="text-[10px] text-red-600 font-medium">直前14日は値引き競争に注意</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* リードタイム曲線チャート */}
      <div className="yl-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-800">チェックイン直前ほど価格はどう変わるか</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            横軸: 予約リードタイム（遠い ← → 直前）／縦軸: 楽天最安値の平均
          </p>
        </div>

        {/* 楽天最安値の注釈 */}
        <div className="flex items-start gap-2 px-3 py-2 mb-4 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            楽天トラベルの最安値（2名1室・税込）を基準とした<strong>相対比較</strong>です。
            絶対値より価格変動のトレンドを参考にしてください。
          </span>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="days_before"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                tickFormatter={(v) => `${v}日前`}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                tickFormatter={(v) => v >= 1000 ? `¥${Math.round(v / 1000)}K` : `¥${v}`}
                width={55}
              />
              {/* 直前14日の境界線 — last_minute_discounter の判定基準 */}
              <ReferenceLine
                x={14}
                stroke="#EF4444"
                strokeDasharray="4 2"
                strokeOpacity={0.5}
                label={{ value: "直前14日", position: "insideTopRight", fontSize: 10, fill: "#EF4444" }}
              />
              <Tooltip
                formatter={(v: number | undefined, name: string | undefined) => [
                  v != null ? formatPrice(v) : "—",
                  name ?? "",
                ]}
                labelFormatter={(label) => `チェックイン ${label}日前`}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }}
              />
              <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
              {data.map((comp, i) =>
                selectedCompetitors.has(comp.competitor_name) ? (
                  <Line
                    key={comp.competitor_name}
                    type="monotone"
                    dataKey={comp.competitor_name}
                    stroke={COMP_COLORS[i % COMP_COLORS.length]}
                    strokeWidth={1.8}
                    dot={false}
                    connectNulls={false}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <Info className="w-4 h-4" />
            <span>上の競合カードをクリックして表示</span>
          </div>
        )}
      </div>
    </div>
  );
}
