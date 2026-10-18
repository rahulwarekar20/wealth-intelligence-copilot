/**
 * Analyse Portfolio donut: how much of the portfolio (by weight) the copilot
 * says to add to, keep, reduce or rebalance. Answers "how much of my money is
 * this strategy actually asking me to move?" at a glance.
 */
import { recommendationSlices } from "@/lib/charts";
import type { StrategyPosition } from "@/lib/types";
import DonutChart from "../ui/DonutChart";

export default function RecommendationMix({ positions }: { positions: StrategyPosition[] }) {
  const slices = recommendationSlices(positions);
  if (!slices.length) return null;

  // Everything that isn't "Keep" means a trade
  const toMove = slices.filter((s) => s.key !== "keep").reduce((sum, s) => sum + s.value, 0);

  return (
    <section className="card p-7">
      <h2 className="font-display text-2xl font-medium text-ink-900">Recommendation mix</h2>
      <p className="mb-5 mt-1 text-sm text-ink-500">Share of your portfolio behind each recommendation.</p>
      <DonutChart
        slices={slices}
        title="Portfolio weight by recommendation"
        centerLabel="to act on"
        centerValue={`${Math.round(toMove * 10) / 10}%`}
      />
    </section>
  );
}
