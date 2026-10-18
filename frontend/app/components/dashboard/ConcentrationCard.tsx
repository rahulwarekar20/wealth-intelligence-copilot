/**
 * Concentration risk: a donut of how the portfolio is split across tickers,
 * with a legend that labels each position High / Medium / Low risk using the
 * user's own limits (set on the Profile page).
 */
import { allocationSlices } from "@/lib/charts";
import type { Holding, Limits } from "@/lib/types";
import { DEFAULT_LIMITS, concentrationBadge, concentrationLevel } from "@/lib/ui";
import DonutChart from "../ui/DonutChart";

export default function ConcentrationCard({ holdings, limits = DEFAULT_LIMITS }: { holdings: Holding[]; limits?: Limits }) {
  const slices = allocationSlices(holdings);
  if (!slices.length) return null;

  const largest = slices.filter((s) => s.key !== "__other").reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <section className="card p-6">
      <h2 className="font-display text-2xl font-medium text-ink-900">Concentration risk</h2>
      <p className="mb-5 mt-1 text-sm text-ink-500">How much of your wealth rides on each position.</p>

      <DonutChart
        slices={slices}
        title="Portfolio weight by position"
        centerLabel={`Largest · ${largest.label}`}
        centerValue={`${largest.value}%`}
        renderExtra={(s) =>
          s.key === "__other" ? null : (
            <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${concentrationBadge(s.value, limits)}`}>
              {concentrationLevel(s.value, limits)}
            </span>
          )
        }
      />

      <p className="mt-5 border-t border-paper-200 pt-4 text-xs text-ink-500">
        Your limits — High: over {limits.high}% of the portfolio · Medium: {limits.medium}–{limits.high}% · Low: under {limits.medium}%
      </p>
    </section>
  );
}
