/**
 * Compact portfolio-strategy answer shown inside the chat: health score,
 * summary and the action for each position. The full version lives on the
 * Analyse Portfolio page.
 */
import type { PortfolioStrategy } from "@/lib/types";
import { actionColor } from "@/lib/ui";
import SourceList from "./SourceList";

export default function StrategyCard({ strategy }: { strategy: PortfolioStrategy }) {
  const score = strategy.portfolio_health?.overall_score ?? 0;
  return (
    <div className="card p-6 w-full">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-display text-xl font-medium text-ink-900">Portfolio strategy</span>
        <span className={`px-2 py-1 rounded-md border text-xs font-bold ${
          score >= 70 ? "bg-fern-50 text-fern-700 border-fern-200" : "bg-gold-50 text-gold-700 border-gold-200"
        }`}>
          Health: {score}/100
        </span>
      </div>
      <p className="text-ink-800 text-[15px] leading-relaxed mb-4">{strategy.portfolio_health?.summary}</p>
      <div className="grid gap-2 md:grid-cols-2">
        {strategy.positions?.map((pos) => (
          <div key={pos.ticker} className="card-inset flex items-center gap-3 p-3">
            <span className="text-ink-900 font-bold w-14">{pos.ticker}</span>
            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase border ${actionColor(pos.action)}`}>
              {pos.action}
            </span>
            <p className="text-ink-700 text-xs flex-1 line-clamp-2">{pos.reasoning}</p>
          </div>
        ))}
      </div>
      <SourceList sources={strategy.sources} />
    </div>
  );
}
