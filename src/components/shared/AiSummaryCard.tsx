import { Sparkles } from "lucide-react";

interface AiSummaryCardProps {
  summary: string;
  bullets: string[];
}

export function AiSummaryCard({ summary, bullets }: AiSummaryCardProps) {
  return (
    <div className="yl-ai-card mb-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-blue-800">AI分析サマリー</span>
      </div>
      <p className="text-sm text-blue-900 leading-relaxed mb-2">{summary}</p>
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-blue-800 flex items-start gap-1.5">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-600 flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
