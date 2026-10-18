/**
 * "Since your last analysis" note: which calls changed (e.g. MSFT HOLD → TRIM),
 * tickers added or removed, and the health-score move. Shows a quiet
 * "no changes" line when nothing changed, and nothing for a first analysis.
 */
import type { StrategyChanges } from "@/lib/types";
import { timeAgo } from "@/lib/time";

export default function StrategyChangesNote({ changes }: { changes?: StrategyChanges | null }) {
  if (!changes) return null;

  const { health_before: before, health_after: after } = changes;
  const scoreMoved = before !== null && after !== null && before !== after;
  const nothingChanged = !changes.changes.length && !changes.added.length && !changes.removed.length && !scoreMoved;
  const since = changes.previous_at ? ` (${timeAgo(changes.previous_at)})` : "";

  if (nothingChanged) {
    return <p className="text-xs text-ink-500">No changes since your last analysis{since}.</p>;
  }

  return (
    <div className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-ink-700">
      <p className="eyebrow text-gold-600">Since your last analysis{since}</p>
      <ul className="mt-1.5 space-y-0.5">
        {changes.changes.map((c) => (
          <li key={c.ticker}>
            <span className="font-semibold text-ink-900">{c.ticker}</span> {c.before.toUpperCase()} →{" "}
            <span className="font-semibold text-ink-900">{c.after.toUpperCase()}</span>
          </li>
        ))}
        {changes.added.length > 0 && <li>New in the analysis: {changes.added.join(", ")}</li>}
        {changes.removed.length > 0 && <li>No longer held: {changes.removed.join(", ")}</li>}
        {scoreMoved && (
          <li>
            Health score {before} → <span className={after! > before! ? "text-fern-600" : "text-brick-500"}>{after}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
