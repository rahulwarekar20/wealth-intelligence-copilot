/**
 * Chat history helpers: turn structured answers back into text so follow-up
 * questions keep their context when sent to the backend.
 */
import type { AskResponse, ChatTurn, PortfolioStrategy, RetirementResult, TickerRecommendation } from "./types";

/** A structured copilot answer (everything except a clarifying question). */
export type CopilotAnswer = Exclude<AskResponse, { route: "clarify" }>;

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

/** One line per compared stock. */
export function comparisonToText(results: TickerRecommendation[] | undefined): string {
  return (results || []).map(recommendationToText).join("\n");
}

/** Health score, summary and each position's action, on one line. */
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

/** Plain-text version of any structured answer, for the conversation history. */
export function answerToText(answer: CopilotAnswer): string {
  switch (answer.route) {
    case "recommendation": return recommendationToText(answer);
    case "comparison": return comparisonToText(answer.results);
    case "strategy": return strategyToText(answer);
    case "retirement": return retirementToText(answer);
  }
}
