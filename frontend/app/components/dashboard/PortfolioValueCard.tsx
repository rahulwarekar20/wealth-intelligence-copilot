/**
 * Dashboard headline card: total portfolio value, position count, largest
 * weight, and a stacked allocation bar with a legend. The bar uses the same
 * slices and colours as the Concentration donut (lib/charts.ts), so a ticker
 * looks the same everywhere. Below it: net worth (portfolio + other assets)
 * and when the prices were fetched.
 */
import Link from "next/link";
import { allocationSlices, type Slice } from "@/lib/charts";
import { clockTime } from "@/lib/time";
import type { Holding } from "@/lib/types";
import { formatMoney } from "@/lib/ui";

/** Horizontal bar split by portfolio weight, plus a ticker/percentage legend. */
function AllocationBar({ slices }: { slices: Slice[] }) {
  return (
    <div className="mt-7">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-paper-200 ring-1 ring-paper-300">
        {slices.map((s) => (
          <div key={s.key} title={`${s.label} · ${s.value}%`} className="h-full" style={{ width: `${s.value}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {slices.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-600">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="font-semibold text-ink-800">{s.label}</span>
            <span className="tabular-nums">{s.value}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioValueCard({
  totalValue,
  holdings,
  unpricedTickers,
  otherAssetsTotal = 0,
  pricesAsOf = null,
}: {
  totalValue: number;
  holdings: Holding[];
  unpricedTickers: string[];
  /** Cash, bonds and property from the Profile page. */
  otherAssetsTotal?: number;
  /** When the prices were fetched (ISO), for the freshness label. */
  pricesAsOf?: string | null;
}) {
  const slices = allocationSlices(holdings);
  const largest = slices.find((s) => s.key !== "__other");

  return (
    <div className="card animate-rise p-7">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Total portfolio value</p>
          <p className="mt-2 font-display text-5xl font-medium tracking-tight text-ink-900 tabular-nums">
            {formatMoney(totalValue)}
          </p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <p className="eyebrow">Positions</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{holdings.length}</p>
          </div>
          <div>
            <p className="eyebrow">Largest</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{largest ? `${largest.value}%` : "—"}</p>
          </div>
        </div>
      </div>

      {slices.length > 0 && <AllocationBar slices={slices} />}

      {/* Net worth and freshness */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-paper-200 pt-4 text-sm">
        {otherAssetsTotal > 0 ? (
          <span className="text-ink-600">
            Net worth <span className="font-semibold tabular-nums text-ink-900">{formatMoney(totalValue + otherAssetsTotal, 0)}</span>
            <span className="text-ink-500"> incl. {formatMoney(otherAssetsTotal, 0)} in other assets · </span>
            <Link href="/profile" className="link">Edit</Link>
          </span>
        ) : (
          <Link href="/profile" className="link">Add cash, bonds or property to see your net worth</Link>
        )}
        {pricesAsOf && <span className="text-xs text-ink-500">Prices as of {clockTime(pricesAsOf)}</span>}
      </div>

      {unpricedTickers.length > 0 && (
        <p className="mt-4 text-xs text-gold-600">
          Live prices unavailable for {unpricedTickers.join(", ")} — excluded from the total.
        </p>
      )}
    </div>
  );
}
