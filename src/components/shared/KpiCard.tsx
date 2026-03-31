import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";

interface KpiCardBaseProps {
  label: string;
  value: string;
  unit?: string;
  detail?: boolean;
}

interface KpiCardTrendProps extends KpiCardBaseProps {
  variant?: "trend";
  change?: string;
  changePositive?: boolean;
  accentColor?: "blue" | "red" | "green" | "indigo";
}

interface KpiCardIconProps extends KpiCardBaseProps {
  variant: "icon";
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
}

export type KpiCardProps = KpiCardTrendProps | KpiCardIconProps;

const accentMap = {
  blue: "text-blue-600",
  red: "text-red-500",
  green: "text-green-600",
  indigo: "text-indigo-600",
};

export function KpiCard(props: KpiCardProps) {
  if (props.variant === "icon") {
    const { label, value, sub, icon: Icon, iconBg, iconColor, trend, trendUp } = props;
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBg)}>
            <Icon className={cn("w-4.5 h-4.5", iconColor)} />
          </div>
          {trend && (
            <div className={cn("flex items-center gap-0.5 text-xs font-medium", trendUp ? "text-yl-positive" : "text-yl-negative")}>
              <ArrowUpRight className={cn("w-3.5 h-3.5", !trendUp && "rotate-90")} />
              {trend}
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    );
  }

  // Default "trend" variant
  const { label, value, unit, change, changePositive, accentColor = "blue", detail } = props;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        {detail && (
          <button className="text-xs text-blue-500 hover:underline cursor-pointer">詳細</button>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-bold", accentMap[accentColor])}>{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
        {change && (
          <span className={cn("flex items-center gap-0.5 text-xs font-medium", changePositive ? "text-yl-positive" : "text-yl-negative")}>
            {changePositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
