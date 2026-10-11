import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session, sessionmaker
from app.agents.llm_client import invoke_llm_json
from app.repositories.portfolio_repository import get_holdings
from app.services.evidence_service import gather_evidence
from app.services.portfolio_service import value_holdings
from app.services.sec_service import build_sources, financial_highlights, get_company_financials

logger = logging.getLogger("wealth-copilot.strategy")


def _aggregate_by_ticker(positions: list[dict]) -> list[dict]:
    """Merges holdings of the same ticker held in different accounts."""
    merged: dict = {}
    for p in positions:
        m = merged.setdefault(p["ticker"], {
            "ticker": p["ticker"],
            "quantity": 0.0,
            "cost_total": 0.0,
            "has_cost": False,
            "current_price": p["current_price"],
            "current_value": None,
            "weight_pct": None,
        })
        m["quantity"] += p["quantity"]
        if p["cost_basis"]:
            m["cost_total"] += p["cost_basis"] * p["quantity"]
            m["has_cost"] = True
        if p["current_value"] is not None:
            m["current_value"] = (m["current_value"] or 0) + p["current_value"]
            m["weight_pct"] = round((m["weight_pct"] or 0) + p["weight_pct"], 2)

    result = []
    for m in merged.values():
        price = m["current_price"]
        avg_cost = m["cost_total"] / m["quantity"] if m["has_cost"] and m["quantity"] else None
        m["cost_basis"] = round(avg_cost, 2) if avg_cost else None
        m["gain_loss_pct"] = (
            round((price - avg_cost) / avg_cost * 100, 2) if price is not None and avg_cost else None
        )
        del m["cost_total"], m["has_cost"]
        result.append(m)
    return result


def run_portfolio_strategy(db: Session, user_id: str) -> dict:
    """
    Portfolio Strategy Agent -- evaluates ALL positions simultaneously
    and produces a buy/sell/hold recommendation for each one,
    plus an overall portfolio health assessment.
    """

    # Step 1 -- fetch all holdings
    holdings = get_holdings(db, user_id)
    if not holdings:
        return {
            "error": "No holdings found",
            "no_holdings": True,
            "positions": [],
            "portfolio_health": {},
            "priority_actions": []
        }

    logger.info("[Strategy Agent] Analysing %d holdings", len(holdings))

    # Step 2/3 -- live prices, values and weights
    raw_positions, total_value, unpriced = value_holdings(holdings)
    positions = _aggregate_by_ticker(raw_positions)

    # Step 4 -- gather evidence for each ticker in parallel.
    # SQLAlchemy sessions are not thread-safe, so every worker opens its own
    # session bound to the same engine as the request session.
    WorkerSession = sessionmaker(bind=db.get_bind(), autocommit=False, autoflush=False)

    def fetch_evidence(ticker: str):
        worker_db = WorkerSession()
        try:
            evidence = gather_evidence(ticker, worker_db)
            try:
                fin = get_company_financials(ticker, worker_db)
            except Exception as e:
                logger.warning("SEC data unavailable for %s: %s", ticker, e)
                fin = None
            return ticker, {
                "sec": financial_highlights(fin) if fin else None,
                "sec_sources": build_sources(fin)[:1] if fin else [],
                "sentiment": evidence.get("news_sentiment", {}).get("sentiment", "neutral"),
                "sentiment_score": evidence.get("news_sentiment", {}).get("sentiment_score", 0),
                "trend": evidence.get("price_data", {}).get("trend", "neutral"),
                "daily_change_pct": evidence.get("price_data", {}).get("daily_change_pct", 0),
                "pe_ratio": evidence.get("fundamentals", {}).get("pe_ratio", None),
                "revenue_growth": evidence.get("fundamentals", {}).get("revenue_growth", None),
                "industry": evidence.get("fundamentals", {}).get("industry", "Unknown")
            }
        except Exception as e:
            return ticker, {"error": str(e)}
        finally:
            worker_db.close()

    evidence_by_ticker = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(fetch_evidence, p["ticker"]) for p in positions]
        for future in as_completed(futures):
            ticker, evidence = future.result()
            evidence_by_ticker[ticker] = evidence

    # Step 5 -- build context for the strategy composer
    portfolio_context = f"""
PORTFOLIO SUMMARY
Total Value: ${total_value:,.2f}
Number of Positions: {len(positions)}
"""
    if unpriced:
        portfolio_context += (
            f"NOTE: Live prices are unavailable for {', '.join(unpriced)}; "
            "they are excluded from the total value and weights.\n"
        )
    portfolio_context += "\nPOSITIONS WITH EVIDENCE:\n"

    for pos in positions:
        ev = evidence_by_ticker.get(pos["ticker"], {})
        if pos["current_price"] is None:
            price_lines = "  - Current Price: UNAVAILABLE\n"
        else:
            price_lines = (
                f"  - Current Price: ${pos['current_price']:.2f}\n"
                f"  - Current Value: ${pos['current_value']:,.2f}\n"
                f"  - Portfolio Weight: {pos['weight_pct']}%\n"
            )
        gain = f"{pos['gain_loss_pct']}%" if pos["gain_loss_pct"] is not None else "N/A"
        sec = ev.get("sec") or {}
        if sec.get("revenue"):
            growth = f", growth {sec['revenue_growth_pct']:+.1f}%" if "revenue_growth_pct" in sec else ""
            margin = f", net margin {sec['net_margin_pct']:.1f}%" if "net_margin_pct" in sec else ""
            sec_line = (f"  - SEC 10-K (FY ending {sec['fiscal_year_end']}): revenue "
                        f"${sec['revenue'] / 1e9:,.1f}B{growth}{margin}\n")
        else:
            sec_line = "  - SEC filings: not available (e.g. ETF)\n"
        portfolio_context += f"""
{pos['ticker']}:
  - Quantity: {pos['quantity']} shares
{price_lines}{sec_line}  - Gain/Loss vs Cost Basis: {gain}
  - Daily Change: {ev.get('daily_change_pct') or 0:.2f}%
  - Price Trend: {ev.get('trend', 'neutral')}
  - News Sentiment: {ev.get('sentiment', 'neutral')} (score: {ev.get('sentiment_score', 0)})
  - P/E Ratio: {ev.get('pe_ratio', 'N/A')}
  - Revenue Growth: {ev.get('revenue_growth', 'N/A')}
  - Industry: {ev.get('industry', 'Unknown')}
"""

    # Step 6 -- call the strategy composer LLM
    system_prompt = """You are a Portfolio Strategy Agent for a wealth intelligence platform.

You receive a complete portfolio snapshot with live prices, concentration weights,
gain/loss data, and market evidence for every position.

Your job is to produce a clear, actionable strategy for the ENTIRE portfolio —
a recommendation for every single position plus an overall portfolio assessment.

RULES:
1. Flag any position with weight > 25% as HIGH concentration risk
2. Flag any position with weight > 15% as MEDIUM concentration risk
3. Consider gain/loss % when recommending sell (lock in gains or cut losses)
4. Consider sentiment and trend when recommending buy
5. Consider portfolio balance — don't recommend buying more of already overweight positions
6. Priority actions should be ranked by urgency (highest risk first)
7. If a position's price is UNAVAILABLE, recommend "hold" and say the data is missing

Respond in this EXACT JSON format with no other text:
{
  "positions": [
    {
      "ticker": "AAPL",
      "action": "hold",
      "confidence": 0.75,
      "weight_pct": 16.44,
      "concentration_flag": "MEDIUM",
      "reasoning": "2-3 sentence explanation of the recommendation",
      "key_risk": "main risk for this position",
      "key_opportunity": "main opportunity for this position"
    }
  ],
  "portfolio_health": {
    "overall_score": 72,
    "diversification": "poor|fair|good|excellent",
    "top_risk": "main portfolio-level risk",
    "top_opportunity": "main portfolio-level opportunity",
    "summary": "2-3 sentence overall portfolio assessment"
  },
  "priority_actions": [
    {
      "rank": 1,
      "ticker": "SPY",
      "action": "trim",
      "urgency": "high|medium|low",
      "reason": "brief reason"
    }
  ]
}"""

    user_prompt = f"""Analyse this portfolio and provide a strategy for every position:

{portfolio_context}

Respond with JSON only — no other text."""

    try:
        result = invoke_llm_json(system_prompt, user_prompt, max_tokens=2000, use_small_model=False, reasoning_effort="medium")
    except Exception as e:
        logger.warning("[Strategy Agent] Error: %s", e)
        return {
            "error": f"Could not compose portfolio strategy: {e}",
            "positions": [],
            "portfolio_health": {},
            "priority_actions": [],
            "total_value": round(total_value, 2),
            "position_count": len(positions)
        }

    # Normalise structures the UI relies on
    if not isinstance(result.get("portfolio_health"), dict):
        result["portfolio_health"] = {}
    health = result["portfolio_health"]
    try:
        health["overall_score"] = max(0, min(100, int(float(health.get("overall_score") or 0))))
    except (TypeError, ValueError):
        health["overall_score"] = 0
    if not isinstance(result.get("positions"), list):
        result["positions"] = []
    if not isinstance(result.get("priority_actions"), list):
        result["priority_actions"] = []

    # Attach live data to each position result -- the real weights override the model's
    position_map = {p["ticker"]: p for p in positions}
    for pos_result in result["positions"]:
        live = position_map.get(pos_result.get("ticker"))
        if live:
            for key in ("current_price", "current_value", "quantity", "gain_loss_pct", "weight_pct"):
                pos_result[key] = live[key]

    result["total_value"] = round(total_value, 2)
    result["position_count"] = len(positions)
    result["unpriced_tickers"] = unpriced
    result["sources"] = [s for p in positions for s in evidence_by_ticker.get(p["ticker"], {}).get("sec_sources", [])]
    return result
