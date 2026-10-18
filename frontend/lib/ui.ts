/**
 * Shared presentation helpers: colour classes for actions, scores and risk
 * levels, and number formatting. Keeping these here means a colour or format
 * changes in one place for every page.
 */
import type { Limits } from "./types";

/** Badge colours for a Buy / Sell / Hold / Rebalance action. */
export function actionColor(action?: string): string {
  switch (action?.toLowerCase()) {
    case "buy":
    case "buy more":
      return "bg-fern-50 text-fern-700 border-fern-200";
    case "sell":
    case "trim":
      return "bg-brick-50 text-brick-600 border-brick-200";
    case "hold":
      return "bg-gold-50 text-gold-700 border-gold-200";
    case "rebalance":
      return "bg-harbor-50 text-harbor-700 border-harbor-200";
    default:
      return "bg-paper-200 text-ink-600 border-paper-300";
  }
}

/**
 * Default concentration thresholds (% of portfolio), used until the user sets
 * their own maximum position size on the Profile page. The backend returns the
 * user's thresholds as `limits` with the portfolio summary.
 */
export const DEFAULT_LIMITS: Limits = { high: 25, medium: 15 };

/** "High" / "Medium" / "Low" concentration for a portfolio weight. */
export function concentrationLevel(pct: number, limits: Limits = DEFAULT_LIMITS): "High" | "Medium" | "Low" {
  if (pct > limits.high) return "High";
  if (pct > limits.medium) return "Medium";
  return "Low";
}

/** Badge colours for a position's portfolio weight. */
export function concentrationBadge(pct: number, limits: Limits = DEFAULT_LIMITS): string {
  const level = concentrationLevel(pct, limits);
  if (level === "High") return "bg-brick-50 text-brick-600 border-brick-100";
  if (level === "Medium") return "bg-gold-50 text-gold-700 border-gold-100";
  return "bg-fern-50 text-fern-700 border-fern-100";
}

/** Text colour for a HIGH / MEDIUM / LOW concentration flag from the strategy agent. */
export function concentrationFlagColor(flag?: string): string {
  switch (flag?.toUpperCase()) {
    case "HIGH": return "text-brick-500";
    case "MEDIUM": return "text-gold-600";
    default: return "text-fern-600";
  }
}

/** Text colour for a gain (green) or loss (red). */
export function gainColor(value: number): string {
  return value >= 0 ? "text-fern-500" : "text-brick-500";
}

/** Text colour for a 0–100 health score. */
export function healthColor(score: number): string {
  if (score >= 70) return "text-fern-600";
  if (score >= 50) return "text-gold-600";
  return "text-brick-500";
}

/** Stroke colour for the health gauge, matching healthColor. */
export function healthStroke(score: number): string {
  if (score >= 70) return "var(--color-fern-500)";
  if (score >= 50) return "var(--color-gold-400)";
  return "var(--color-brick-400)";
}

/** $331.8B / $12.4M style, for large figures like revenue. */
export function formatCompactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

/** 12.3% style; `signed` adds a + to positive values. */
export function formatPct(value: number, signed = false): string {
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** "AAPL 10-K FY2025, Item 1A Risk Factors" -> "10-K · Item 1A Risk Factors" for compact chips. */
export function shortCitation(citation: string, ticker?: string): string {
  let c = citation.replace(/^\[|\]$/g, "");
  if (ticker) c = c.replace(new RegExp(`^${ticker}\\s+`, "i"), "");
  return c.replace(/\s+FY\d{4}/, "").replace(", ", " · ");
}

/** $1,234.56 style; shows an em dash when the value is missing. */
export function formatMoney(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
