/**
 * Top card of Analyse Portfolio: health gauge, total value, diversification,
 * the copilot's one-paragraph summary, and the top risk / opportunity.
 */
import type { PortfolioStrategy } from "@/lib/types";
import { formatMoney } from "@/lib/ui";
import HealthGauge from "../ui/HealthGauge";
import RiskOpportunity from "./RiskOpportunity";

export default function HealthOverview({ strategy }: { strategy: PortfolioStrategy }) {
  const health = strategy.portfolio_health;
  const unpriced = strategy.unpriced_tickers ?? [];

  return (
    <section className="card animate-rise p-7">
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          <HealthGauge score={health?.overall_score || 0} size={132} />
          <p className="eyebrow mt-2">Health score</p>
        </div>
        <div>
          <div className="grid grid-cols-2 gap-6 border-b border-paper-200 pb-5">
            <div>
              <p className="eyebrow">Total value</p>
              <p className="mt-1 font-display text-3xl tabular-nums text-ink-900">{formatMoney(strategy.total_value)}</p>
            </div>
            <div>
              <p className="eyebrow">Diversification</p>
              <p className="mt-1 font-display text-3xl capitalize text-ink-900">{health?.diversification || "N/A"}</p>
            </div>
          </div>
          <p className="mt-5 font-display text-lg italic leading-relaxed text-ink-700">{health?.summary}</p>
        </div>
      </div>

      {unpriced.length > 0 && (
        <p className="mt-4 text-xs text-gold-600">
          Live prices unavailable for {unpriced.join(", ")} — excluded from value and weights.
        </p>
      )}

      <div className="mt-6">
        <RiskOpportunity risk={health?.top_risk} opportunity={health?.top_opportunity} variant="inset" />
      </div>
    </section>
  );
}
