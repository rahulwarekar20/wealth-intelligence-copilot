/**
 * Test data builders. Each returns a complete, valid object; pass overrides
 * for just the fields a test cares about.
 */
import type { Holding, PortfolioStrategy, StrategyPosition, TickerRecommendation } from "@/lib/types";

export function holding(overrides: Partial<Holding> = {}): Holding {
  const ticker = overrides.ticker ?? "AAPL";
  return {
    id: overrides.id ?? `id-${ticker}`,
    ticker,
    quantity: 10,
    cost_basis: 100,
    account_type: "taxable",
    current_price: 150,
    current_value: 1500,
    weight_pct: 50,
    gain_loss_pct: 50,
    price_available: true,
    ...overrides,
  };
}

export function position(overrides: Partial<StrategyPosition> = {}): StrategyPosition {
  return {
    ticker: "AAPL",
    action: "hold",
    weight_pct: 20,
    reasoning: "Solid fundamentals.",
    current_price: 150,
    gain_loss_pct: 10,
    ...overrides,
  };
}

export function strategy(overrides: Partial<PortfolioStrategy> = {}): PortfolioStrategy {
  return {
    positions: [position({ ticker: "AAPL", action: "hold" }), position({ ticker: "MSFT", action: "trim" })],
    portfolio_health: {
      overall_score: 72,
      diversification: "moderate",
      summary: "Healthy but concentrated in tech.",
      top_risk: "Tech concentration",
      top_opportunity: "Undervalued search",
    },
    priority_actions: [{ rank: 1, ticker: "MSFT", action: "trim", reason: "Reduce below 25%." }],
    total_value: 10000,
    position_count: 2,
    ...overrides,
  };
}

export function recommendation(overrides: Partial<TickerRecommendation> = {}): TickerRecommendation {
  return {
    ticker: "AAPL",
    action: "hold",
    confidence: 0.7,
    summary: "Fairly valued.",
    evidence_for: [],
    evidence_against: [],
    disagreement_flag: false,
    disclosure: "Informational only.",
    ...overrides,
  };
}
