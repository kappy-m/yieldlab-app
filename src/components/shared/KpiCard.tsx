import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  change?: string;
  changePositive?: boolean;
  accentColor?: "blue" | "red" | "green" | "purple";
  detail?: boolean;
}

const accentMap = {
  blue: "text-blue-600",
  red: "text-red-500",
  green: "text-green-600",
  purple: "text-[#7C3AED]",
};

export function KpiCard({ label, value, unit, change, changePositive, accentColor = "blue", detail }: KpiCardProps) {
  return (
    <div className="yl-card p-4 flex-1">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        {detail && (
          <button className="text-xs text-blue-500 hover:underline">詳細</button>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-bold", accentMap[accentColor])}>{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
        {change && (
          <span className={cn("flex items-center gap-0.5 text-xs font-medium", changePositive ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {changePositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
