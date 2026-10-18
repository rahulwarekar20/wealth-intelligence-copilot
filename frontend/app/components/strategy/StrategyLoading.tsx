/**
 * Full-card waiting state for Analyse Portfolio while the AI strategy runs.
 */
import { IconCompass } from "../ui/Icons";

export default function StrategyLoading() {
  return (
    <div className="card p-10">
      <div className="mx-auto max-w-md text-center">
        <IconCompass size={32} className="mx-auto animate-spin text-gold-400 [animation-duration:3s]" />
        <p className="mt-4 font-display text-2xl text-ink-900">Analysing every position…</p>
        <p className="mt-2 text-sm text-ink-600">
          Fetching live prices, SEC filings and news for each ticker, then composing a portfolio-wide strategy.
        </p>
        <p className="mt-4 text-xs text-ink-400">Usually 10–20 seconds — you can switch screens and come back.</p>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
    </div>
  );
}
