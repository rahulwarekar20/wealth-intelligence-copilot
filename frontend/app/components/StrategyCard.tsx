import type { PortfolioStrategy } from "@/lib/types";
import { actionColor } from "@/lib/ui";
import SourceList from "./SourceList";

export default function StrategyCard({ strategy }: { strategy: PortfolioStrategy }) {
  const score = strategy.portfolio_health?.overall_score ?? 0;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-teal-400 font-bold">Portfolio Strategy</span>
        <span className={`px-2 py-1 rounded text-xs font-bold ${
          score >= 70 ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"
        }`}>
          Health: {score}/100
        </span>
      </div>
      <p className="text-gray-100 text-[15px] leading-relaxed mb-3">{strategy.portfolio_health?.summary}</p>
      <div className="grid gap-2 md:grid-cols-2">
        {strategy.positions?.map((pos) => (
          <div key={pos.ticker} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
            <span className="text-teal-400 font-bold w-14">{pos.ticker}</span>
            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${actionColor(pos.action)}`}>
              {pos.action}
            </span>
            <p className="text-gray-300 text-xs flex-1 line-clamp-2">{pos.reasoning}</p>
          </div>
        ))}
      </div>
      <SourceList sources={strategy.sources} />
    </div>
  );
}
