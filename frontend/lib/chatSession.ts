import type { ChatTurn, PortfolioStrategy, RetirementResult, TickerRecommendation } from "./types";

// The backend accepts at most 4000 characters per history message
const MAX_HISTORY_CHARS = 2000;

// Converts a structured agent response into plain text so it can be sent
// back to the backend as conversation history.
export function retirementToText(r: RetirementResult | undefined): string {
  if (!r) return "";
  const parts = [r.answer];
  if (r.portfolio_assessment) parts.push(`Assessment: ${r.portfolio_assessment}`);
  if (r.action_items?.length) parts.push(`Actions: ${r.action_items.join("; ")}`);
  if (r.follow_up_question) parts.push(`Question for user: ${r.follow_up_question}`);
  return parts.filter(Boolean).join("\n");
}

// The ticker is included so follow-ups like "should I sell it?" can be resolved
export function recommendationToText(r: TickerRecommendation | undefined): string {
  if (!r) return "";
  return `[${r.ticker}] ${(r.action || "").toUpperCase()} — ${r.summary || ""}`.trim();
}

export function comparisonToText(results: TickerRecommendation[] | undefined): string {
  return (results || []).map(recommendationToText).join("\n");
}

export function strategyToText(s: PortfolioStrategy | undefined): string {
  if (!s) return "";
  const positions = (s.positions || []).map((p) => `${p.ticker}: ${p.action}`).join(", ");
  return `Portfolio health ${s.portfolio_health?.overall_score ?? "?"}/100. ${s.portfolio_health?.summary || ""} ${positions}`.trim();
}

/** Keeps the last `limit` non-empty turns, truncated to what the API accepts. */
export function toHistory(turns: ChatTurn[], limit: number): ChatTurn[] {
  return turns
    .filter((t) => t.content)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_HISTORY_CHARS) }))
    .slice(-limit);
}
