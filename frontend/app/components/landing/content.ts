/**
 * Copy for the public landing page. Edit wording here without touching layout.
 * Every claim should match what the product actually does (see the README).
 */
import {
  IconCompass,
  IconDocument,
  IconLayers,
  IconQuote,
  IconScale,
  IconSunrise,
} from "../ui/Icons";

/** "How it works" — three steps from adding holdings to deciding. */
export const CHAPTERS = [
  {
    n: "01",
    title: "Bring your portfolio",
    body: "Add the positions you hold — taxable, IRA, Roth or 401(k). Live prices, weights and concentration risk update instantly.",
  },
  {
    n: "02",
    title: "Ask in plain English",
    body: "“Should I buy more Apple?” “Can I retire at 60?” No ticker codes, no forms. The copilot works out what you mean.",
  },
  {
    n: "03",
    title: "Decide with evidence",
    body: "Every Buy, Hold, Sell or Trim arrives with its reasoning, the risks against it, and citations to the filings behind it.",
  },
];

/** "What it does" — feature grid. */
export const FEATURES = [
  {
    Icon: IconQuote,
    title: "Grounded in SEC filings",
    body: "10-K financials, Risk Factors and MD&A are pulled from SEC EDGAR automatically and quoted, section by section.",
  },
  {
    Icon: IconLayers,
    title: "Specialist agents, in parallel",
    body: "Portfolio, evidence and market-data agents analyse each stock side by side, then a composer weighs their views.",
  },
  {
    Icon: IconScale,
    title: "Honest about uncertainty",
    body: "When the agents disagree, you're told — and confidence drops. No false certainty dressed up as advice.",
  },
  {
    Icon: IconCompass,
    title: "Whole-portfolio strategy",
    body: "A health score, diversification read, and a ranked list of what to rebalance first, across every position.",
  },
  {
    Icon: IconSunrise,
    title: "Retirement, in context",
    body: "Plan against what you actually own. The copilot remembers the details you've shared, so it never asks twice.",
  },
  {
    Icon: IconDocument,
    title: "Your own research, cited",
    body: "Upload notes or reports as PDF, TXT or CSV. They're cited alongside the filings when a company they mention comes up.",
  },
];

/** "Why trust it" — the two guarantee blocks on the dark band. */
export const TRUST_BLOCKS = [
  {
    title: "Evidence-first architecture",
    items: [
      "Every point tagged to its source section",
      "Links straight to the filing on SEC EDGAR",
      "Positives and risks shown side by side",
    ],
  },
  {
    title: "Guardrails, built in",
    items: [
      "Agent disagreement is flagged, not hidden",
      "Confidence falls when signals conflict",
      "Every recommendation logged as an audit trail",
    ],
  },
];

/** Headline figures under the hero text. */
export const HERO_STATS: [string, string][] = [
  ["10-K", "filings quoted & linked"],
  ["3", "stocks compared at once"],
  ["1", "chat for stocks, portfolio & retirement"],
];

/** Demo login shown on the sign-in card (seeded by `python -m app.seed`). */
export const DEMO_CREDENTIALS = { email: "test@example.com", password: "testpass123" };
