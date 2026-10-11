export function actionColor(action?: string): string {
  switch (action?.toLowerCase()) {
    case "buy":
    case "buy more":
      return "bg-green-900 text-green-300 border-green-700";
    case "sell":
    case "trim":
      return "bg-red-900 text-red-300 border-red-700";
    case "hold":
      return "bg-yellow-900 text-yellow-300 border-yellow-700";
    case "rebalance":
      return "bg-blue-900 text-blue-300 border-blue-700";
    default:
      return "bg-gray-800 text-gray-300 border-gray-700";
  }
}

export function healthColor(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
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

export function formatPct(value: number, signed = false): string {
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** "AAPL 10-K FY2025, Item 1A Risk Factors" -> "10-K · Item 1A Risk Factors" for compact chips. */
export function shortCitation(citation: string, ticker?: string): string {
  let c = citation.replace(/^\[|\]$/g, "");
  if (ticker) c = c.replace(new RegExp(`^${ticker}\\s+`, "i"), "");
  return c.replace(/\s+FY\d{4}/, "").replace(", ", " · ");
}

export function formatMoney(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
