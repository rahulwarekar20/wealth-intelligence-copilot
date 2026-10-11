export interface Holding {
  id: string;
  ticker: string;
  quantity: number;
  cost_basis: number | null;
  account_type: string;
  current_price: number | null;
  current_value: number | null;
  weight_pct: number | null;
  gain_loss_pct: number | null;
  price_available: boolean;
}

export interface PortfolioSummary {
  total_value: number;
  holdings: Holding[];
  concentration: Record<string, number>;
  correlation: Record<string, number | string>;
  unpriced_tickers: string[];
}

export interface StrategyPosition {
  ticker: string;
  action: string;
  confidence?: number;
  weight_pct: number | null;
  concentration_flag?: string;
  reasoning?: string;
  key_risk?: string;
  key_opportunity?: string;
  current_price?: number | null;
  current_value?: number | null;
  quantity?: number;
  gain_loss_pct?: number | null;
}

export interface PortfolioHealth {
  overall_score?: number;
  diversification?: string;
  top_risk?: string;
  top_opportunity?: string;
  summary?: string;
}

export interface PriorityAction {
  rank: number;
  ticker: string;
  action: string;
  urgency?: string;
  reason?: string;
}

export interface PortfolioStrategy {
  positions: StrategyPosition[];
  portfolio_health: PortfolioHealth;
  priority_actions: PriorityAction[];
  total_value?: number;
  position_count?: number;
  unpriced_tickers?: string[];
  sources?: Source[];
  no_holdings?: boolean;
  error?: string;
}

export interface EvidencePoint {
  point: string;
  agent?: string;
  citation?: string;
}

export interface Source {
  label: string;
  url: string | null;
}

export interface StockMetrics {
  company?: string;
  price?: number;
  daily_change_pct?: number;
  portfolio_weight_pct?: number;
  fiscal_year_end?: string;
  revenue?: number;
  revenue_growth_pct?: number;
  net_margin_pct?: number;
  pe_ratio?: number;
}

export interface Recommendation {
  decision_id?: string;
  answer?: string;
  key_points?: EvidencePoint[];
  metrics?: StockMetrics;
  action: string;
  confidence: number;
  confidence_label?: string;
  summary: string;
  evidence_for: EvidencePoint[];
  evidence_against: EvidencePoint[];
  portfolio_impact?: string;
  disagreement_flag: boolean;
  disagreement_note?: string | null;
  evidence_diversity_score?: number;
  disclosure: string;
  prompt_version?: string;
  sources?: Source[];
}

export interface RetirementResult {
  answer: string;
  portfolio_assessment?: string;
  action_items: string[];
  needs_more_info?: boolean;
  follow_up_question?: string | null;
  confidence: "high" | "medium" | "low";
  disclaimer: string;
  total_portfolio_value: number;
  unpriced_tickers?: string[];
}

export interface TickerRecommendation extends Recommendation {
  ticker: string;
}

/** Response of POST /decisions/ask, discriminated by `route`. */
export type AskResponse =
  | ({ route: "recommendation"; note?: string | null } & TickerRecommendation)
  | {
      route: "comparison";
      results: TickerRecommendation[];
      verdict?: string | null;
      preferred?: string | null;
      note?: string | null;
    }
  | ({ route: "strategy" } & PortfolioStrategy)
  | ({ route: "retirement" } & RetirementResult)
  | { route: "clarify"; message: string };

export interface JournalEntry {
  decision_id: string;
  ticker: string;
  query: string;
  recommendation: Partial<Recommendation> & Partial<PortfolioStrategy>;
  confidence: number;
  evidence_diversity_score: number;
  created_at: string;
}

export interface StoredDocument {
  id: string;
  filename: string;
  content_type: string;
  size_kb: number;
  characters: number;
  created_at: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
