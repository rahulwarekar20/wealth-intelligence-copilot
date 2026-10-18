/**
 * Dashboard panel with the copilot's portfolio strategy: summary, a
 * recommendation per position and the top three priority actions.
 * Handles every state: no holdings, running, failed and finished.
 */
import { timeAgo } from "@/lib/time";
import type { PortfolioStrategy } from "@/lib/types";
import StrategyChangesNote from "../strategy/StrategyChangesNote";
import Callout from "../ui/Callout";
import ActionBadge from "../ui/ActionBadge";
import { IconCompass, IconRefresh, IconSparkle } from "../ui/Icons";

/** Shown while the strategy runs (and in the moment before the automatic run starts). */
function StrategyLoading() {
  return (
    <div className="space-y-4">
      <div className="card-inset px-4 py-3">
        <p className="text-sm font-medium text-ink-800">Reading filings, prices and news for every position…</p>
        <p className="mt-0.5 text-xs text-ink-500">Usually 10–20 seconds — you can keep using the app meanwhile.</p>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-6 w-14" />
          <div className="skeleton h-6 w-16" />
          <div className="skeleton h-6 flex-1" />
        </div>
      ))}
    </div>
  );
}

/** The finished strategy: summary quote, per-position calls, priority actions. */
function StrategyResult({ strategy }: { strategy: PortfolioStrategy }) {
  const summary = strategy.portfolio_health?.summary;
  return (
    <div className="space-y-6">
      <StrategyChangesNote changes={strategy.changes} />
      {summary && (
        <p className="border-l-2 border-gold-300 pl-4 font-display text-[17px] italic leading-relaxed text-ink-700">
          {summary}
        </p>
      )}

      <div>
        <p className="eyebrow mb-2">Position recommendations</p>
        <div className="divide-y divide-paper-200 border-y border-paper-200">
          {strategy.positions?.map((pos) => (
            <div key={pos.ticker} className="flex items-start gap-3 py-3">
              <span className="w-14 pt-0.5 text-sm font-semibold text-ink-900">{pos.ticker}</span>
              <ActionBadge action={pos.action} size="sm" className="w-[4.5rem] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug text-ink-700">{pos.reasoning}</p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {pos.weight_pct === null || pos.weight_pct === undefined ? "weight n/a" : `${pos.weight_pct}% of portfolio`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {strategy.priority_actions?.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Priority actions</p>
          <ol className="space-y-2">
            {strategy.priority_actions.slice(0, 3).map((a) => (
              <li key={`${a.rank}-${a.ticker}`} className="card-inset flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="font-display text-lg italic leading-none text-gold-500">{a.rank}</span>
                <span className="font-semibold text-ink-900">{a.ticker}</span>
                <ActionBadge action={a.action} size="sm" />
                <span className="flex-1 text-ink-600">{a.reason}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function StrategyPanel({
  strategy,
  running,
  error,
  hasHoldings,
  onRun,
}: {
  strategy: PortfolioStrategy | null;
  running: boolean;
  error: string;
  hasHoldings: boolean;
  onRun: () => void;
}) {
  const waitingToStart = !strategy && !error && hasHoldings;

  return (
    <section className="card p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-gold-500"><IconSparkle size={14} /> Copilot</p>
          <h2 className="mt-1 font-display text-2xl font-medium text-ink-900">Portfolio strategy</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Buy, hold or sell across every position
            {strategy?.generated_at && !running && <> · analysed {timeAgo(strategy.generated_at)}</>}
          </p>
        </div>
        <button onClick={onRun} disabled={running || !hasHoldings} className="btn-secondary shrink-0 px-3.5 py-2 text-sm">
          <IconRefresh size={15} className={running ? "animate-spin" : ""} />
          {running ? "Analysing" : strategy ? "Refresh" : "Analyse"}
        </button>
      </div>

      {!strategy && !running && !error && !hasHoldings && (
        <div className="card-inset py-10 text-center">
          <IconCompass size={28} className="mx-auto text-gold-400" />
          <p className="mx-auto mt-3 max-w-xs text-sm text-ink-600">
            Add a holding and the copilot will analyse your whole portfolio automatically.
          </p>
        </div>
      )}
      {(running || waitingToStart) && <StrategyLoading />}
      {error && <Callout tone="error">{error}</Callout>}
      {strategy && !running && <StrategyResult strategy={strategy} />}
    </section>
  );
}
