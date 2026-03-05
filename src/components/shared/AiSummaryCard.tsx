import { Sparkles } from "lucide-react";

interface AiSummaryCardProps {
  summary: string;
  bullets: string[];
}

export function AiSummaryCard({ summary, bullets }: AiSummaryCardProps) {
  return (
    <div className="yl-ai-card mb-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 bg-[#7C3AED] rounded-md flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-[#5B21B6]">AI分析サマリー</span>
      </div>
      <p className="text-sm text-[#4C1D95] leading-relaxed mb-2">{summary}</p>
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-[#6D28D9] flex items-start gap-1.5">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-[#7C3AED] flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
