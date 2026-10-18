/**
 * Dashboard card with the portfolio health gauge and diversification read.
 * While the AI strategy is still running it shows a placeholder instead.
 */
import Link from "next/link";
import type { PortfolioHealth } from "@/lib/types";
import HealthGauge from "../ui/HealthGauge";

export default function HealthSummaryCard({
  health,
  failed,
  hasHoldings,
}: {
  /** Health from the finished strategy, or undefined while it is running / unavailable. */
  health?: PortfolioHealth;
  failed: boolean;
  hasHoldings: boolean;
}) {
  return (
    <div className="card animate-rise flex items-center gap-6 p-7 [animation-delay:80ms]">
      {health ? (
        <>
          <HealthGauge score={health.overall_score ?? 0} />
          <div className="min-w-0">
            <p className="eyebrow">Portfolio health</p>
            <p className="mt-2 font-display text-xl capitalize text-ink-900">{health.diversification || "—"}</p>
            <p className="text-xs text-ink-500">diversification</p>
            <Link href="/strategy" className="link mt-3 inline-block text-sm">Full strategy →</Link>
          </div>
        </>
      ) : (
        <div className="w-full">
          <p className="eyebrow">Portfolio health</p>
          {failed ? (
            <p className="mt-3 text-sm text-ink-600">Health score unavailable. Run the analysis to try again.</p>
          ) : hasHoldings ? (
            <div className="mt-4 space-y-2">
              <div className="skeleton h-8 w-24" />
              <p className="text-xs text-ink-500">Scoring your portfolio…</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-600">Add a holding to receive a health score.</p>
          )}
        </div>
      )}
    </div>
  );
}
