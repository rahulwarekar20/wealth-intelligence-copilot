/**
 * TypeScript shapes of the backend's JSON responses. Keep in sync with
 * backend/app/api/schemas.py and the agents' output.
 */
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

/** Response of GET /portfolio/summary. */
export interface PortfolioSummary {
  total_value: number;
  holdings: Holding[];
  concentration: Record<string, number>;
  correlation: Record<string, number | string>;
  unpriced_tickers: string[];
  /** The user's concentration thresholds (from their profile). */
  limits: Limits;
  other_assets_total: number;
  /** Portfolio value plus other assets. */
  net_worth: number;
  /** When the oldest price used was fetched (ISO), or null. */
  prices_as_of: string | null;
}

/** Concentration thresholds in % ("high" is the user's maximum position size). */
export interface Limits {
  high: number;
  medium: number;
}

/** The strategy agent's view of one position. */
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

/** Portfolio-wide health assessment (score 0–100). */
export interface PortfolioHealth {
  overall_score?: number;
  diversification?: string;
  top_risk?: string;
  top_opportunity?: string;
  summary?: string;
}

/** One ranked step from the strategy (1 = do first). */
export interface PriorityAction {
  rank: number;
  ticker: string;
  action: string;
  urgency?: string;
  reason?: string;
}

/** Response of GET /decisions/portfolio-strategy. */
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
  limits?: Limits;
  /** When the analysis ran (ISO). */
  generated_at?: string;
  /** Differences from the previous analysis, or null for the first one. */
  changes?: StrategyChanges | null;
}

/** What changed between this strategy and the previous one. */
export interface StrategyChanges {
  previous_at: string | null;
  health_before: number | null;
  health_after: number | null;
  changes: { ticker: string; before: string; after: string }[];
  added: string[];
  removed: string[];
}

export type RiskTolerance = "conservative" | "moderate" | "aggressive";

/** Response of GET/PUT /profile. */
export interface Profile {
  risk_tolerance: RiskTolerance;
  horizon_years: number | null;
  max_position_pct: number;
  limits: Limits;
  /** False until the user saves their profile (defaults are in use). */
  is_set: boolean;
}

export type AssetClass = "cash" | "bonds" | "property" | "other";

/** Something owned outside the stock holdings. */
export interface OtherAsset {
  id: string;
  name: string;
  asset_class: AssetClass;
  value: number;
}

export type AlertKind = "concentration" | "price_drop" | "filing" | "earnings" | "strategy_change";

/** An in-app notification. */
export interface AppAlert {
  id: string;
  kind: AlertKind;
  ticker: string | null;
  message: string;
  created_at: string;
  read: boolean;
}

export type Verdict = "on_track" | "against" | "flat" | "too_early" | "n/a";

/** One past call from GET /decisions/track-record. */
export interface TrackRecordCall {
  ticker: string;
  action: string;
  /** "Portfolio strategy", or the question that produced the call. */
  source: string;
  made_at: string;
  price_then: number;
  price_now: number | null;
  change_pct: number | null;
  verdict: Verdict;
}

/** A holding read from an import file, before it is saved. */
export interface ImportRow {
  ticker: string;
  quantity: number;
  cost_basis: number | null;
  account_type: string;
}

/** A single evidence point with the source it came from. */
export interface EvidencePoint {
  point: string;
  agent?: string;
  citation?: string;
}

/** A source behind an answer; url is null for non-web sources (e.g. portfolio data). */
export interface Source {
  label: string;
  url: string | null;
}

/** Key figures shown with a stock answer (all optional; shown only when present). */
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

/** A Buy/Hold/Sell recommendation for one stock, with its evidence. */
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

/** Answer from the retirement agent. */
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

/** A recommendation tagged with its ticker (used in answers and comparisons). */
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

/** One past decision from GET /decisions/journal. */
export interface JournalEntry {
  decision_id: string;
  ticker: string;
  query: string;
  recommendation: Partial<Recommendation> & Partial<PortfolioStrategy>;
  confidence: number;
  evidence_diversity_score: number;
  created_at: string;
}

/** An uploaded document as listed by the API (no text content). */
export interface StoredDocument {
  id: string;
  filename: string;
  content_type: string;
  size_kb: number;
  characters: number;
  created_at: string;
}

/** One earlier chat message sent for context. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
