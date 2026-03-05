interface PlaceholderTabProps {
  label: string;
  phase: string;
}

export function PlaceholderTab({ label, phase }: PlaceholderTabProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
        <span className="text-2xl">🔧</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{label}</h3>
      <p className="text-xs text-gray-400">{phase} 実装予定</p>
    </div>
  );
}
