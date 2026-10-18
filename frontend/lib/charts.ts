/**
 * Chart data helpers: turn holdings and strategy results into donut slices.
 *
 * Colours were checked with a palette validator (lightness band, chroma,
 * colour-blind separation, contrast against the paper background), so change
 * them only together and re-validate. The ochre slot is below 3:1 contrast on
 * its own, which is why every chart also shows its values in a legend.
 */
import type { Holding, StrategyPosition } from "./types";

/** One segment of a donut chart. */
export interface Slice {
  /** Stable identity (ticker or bucket id); used as the React key. */
  key: string;
  label: string;
  /** Share of the whole, in percent. */
  value: number;
  color: string;
  /** Optional extra text for the legend and tooltip (e.g. tickers in a bucket). */
  detail?: string;
}

/** Categorical colours for tickers, in fixed order (never cycled). */
export const SERIES_COLORS = ["#2f6fa3", "#c8912f", "#b4483a", "#0f9a89", "#8b5aa8", "#5f8f2e"];

/** Neutral colour for the folded "Other" slice. */
export const OTHER_COLOR = "#a99a87";

/** Most slices a donut shows before folding the smallest into "Other". */
export const MAX_SLICES = SERIES_COLORS.length;

/**
 * Portfolio weight per ticker as donut slices, largest first.
 *
 * Tickers held in several accounts are merged. With more than MAX_SLICES
 * tickers, the largest MAX_SLICES - 1 are shown and the rest become "Other".
 * Colours are assigned alphabetically among the shown tickers, so a ticker
 * keeps its colour when weights shift (colour follows the entity, not its rank).
 */
export function allocationSlices(holdings: Holding[]): Slice[] {
  const byTicker = new Map<string, number>();
  for (const h of holdings) {
    if (h.weight_pct === null || h.weight_pct <= 0) continue;
    byTicker.set(h.ticker, (byTicker.get(h.ticker) ?? 0) + h.weight_pct);
  }

  const ranked = [...byTicker.entries()].sort((a, b) => b[1] - a[1]);
  const fold = ranked.length > MAX_SLICES;
  const shown = fold ? ranked.slice(0, MAX_SLICES - 1) : ranked;
  const rest = fold ? ranked.slice(MAX_SLICES - 1) : [];

  const colorOf = tickerColors(shown.map(([t]) => t));
  const slices: Slice[] = shown.map(([ticker, value]) => ({
    key: ticker,
    label: ticker,
    value: round1(value),
    color: colorOf[ticker],
  }));

  if (rest.length) {
    slices.push({
      key: "__other",
      label: "Other",
      value: round1(rest.reduce((sum, [, v]) => sum + v, 0)),
      color: OTHER_COLOR,
      detail: rest.map(([t]) => t).join(", "),
    });
  }
  return slices;
}

/** Ticker → colour, assigned in alphabetical order. At most MAX_SLICES tickers. */
export function tickerColors(tickers: string[]): Record<string, string> {
  const sorted = [...new Set(tickers)].sort();
  return Object.fromEntries(sorted.map((t, i) => [t, SERIES_COLORS[i] ?? OTHER_COLOR]));
}

/** The four recommendation buckets, in donut order (colours validated as a set). */
export const ACTION_BUCKETS = [
  { key: "add", label: "Add", color: "#0f9a89", actions: ["buy", "buy more"] },
  { key: "keep", label: "Keep", color: "#c8912f", actions: ["hold"] },
  { key: "reduce", label: "Reduce", color: "#b4483a", actions: ["trim", "sell"] },
  { key: "rebalance", label: "Rebalance", color: "#8b5aa8", actions: ["rebalance"] },
] as const;

/**
 * How much of the portfolio each recommendation touches: the summed weight of
 * positions the copilot says to add to, keep, reduce or rebalance.
 * Positions without a weight (no live price) or an unknown action are skipped.
 */
export function recommendationSlices(positions: StrategyPosition[]): Slice[] {
  return ACTION_BUCKETS.flatMap((bucket) => {
    const members = positions.filter(
      (p) => p.weight_pct && (bucket.actions as readonly string[]).includes(p.action?.toLowerCase())
    );
    if (!members.length) return [];
    return [{
      key: bucket.key,
      label: bucket.label,
      value: round1(members.reduce((sum, p) => sum + (p.weight_pct ?? 0), 0)),
      color: bucket.color,
      detail: members.map((p) => p.ticker).join(", "),
    }];
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
