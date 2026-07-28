from sqlalchemy.orm import Session
from app.agents.bedrock_client import invoke_claude
from app.repositories.portfolio_repository import get_holdings
from app.services.evidence_service import gather_evidence
from app.services.portfolio_service import fetch_current_price
import json


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
            "positions": [],
            "portfolio_health": {},
            "priority_actions": []
        }

    print(f"[Strategy Agent] Analysing {len(holdings)} positions...")

    # Step 2 -- fetch live prices and build portfolio snapshot
    positions = []
    total_value = 0.0

    for h in holdings:
        price = fetch_current_price(h.ticker)
        value = float(h.quantity) * price
        total_value += value
        positions.append({
            "ticker": h.ticker,
            "quantity": float(h.quantity),
            "cost_basis": float(h.cost_basis or 0),
            "current_price": price,
            "current_value": value,
            "gain_loss_pct": round(
                ((price - float(h.cost_basis or price)) / float(h.cost_basis or price)) * 100, 2
            ) if h.cost_basis else 0
        })

    # Step 3 -- compute concentration for each position
    for pos in positions:
        pos["weight_pct"] = round(
            (pos["current_value"] / total_value * 100) if total_value > 0 else 0, 2
        )

    # Step 4 -- gather evidence for each ticker
    print(f"[Strategy Agent] Gathering evidence for all tickers...")
    evidence_by_ticker = {}
    for pos in positions:
        ticker = pos["ticker"]
        try:
            evidence = gather_evidence(ticker, db)
            evidence_by_ticker[ticker] = {
                "sentiment": evidence.get("news_sentiment", {}).get("sentiment", "neutral"),
                "sentiment_score": evidence.get("news_sentiment", {}).get("sentiment_score", 0),
                "trend": evidence.get("price_data", {}).get("trend", "neutral"),
                "daily_change_pct": evidence.get("price_data", {}).get("daily_change_pct", 0),
                "pe_ratio": evidence.get("fundamentals", {}).get("pe_ratio", None),
                "revenue_growth": evidence.get("fundamentals", {}).get("revenue_growth", None),
                "industry": evidence.get("fundamentals", {}).get("industry", "Unknown")
            }
            print(f"[Strategy Agent] Evidence gathered for {ticker}")
        except Exception as e:
            evidence_by_ticker[ticker] = {"error": str(e)}

    # Step 5 -- build context for the strategy composer
    portfolio_context = f"""
PORTFOLIO SUMMARY
Total Value: ${total_value:,.2f}
Number of Positions: {len(positions)}

POSITIONS WITH EVIDENCE:
"""
    for pos in positions:
        ev = evidence_by_ticker.get(pos["ticker"], {})
        portfolio_context += f"""
{pos['ticker']}:
  - Current Price: ${pos['current_price']:.2f}
  - Quantity: {pos['quantity']} shares
  - Current Value: ${pos['current_value']:,.2f}
  - Portfolio Weight: {pos['weight_pct']}%
  - Gain/Loss vs Cost Basis: {pos['gain_loss_pct']}%
  - Daily Change: {ev.get('daily_change_pct', 0):.2f}%
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

    print(f"[Strategy Agent] Composing portfolio strategy...")

    try:
        response = invoke_claude(
            system_prompt,
            user_prompt,
            max_tokens=2000,
            use_haiku=False  # Use best model for portfolio strategy
        )

        clean = response.strip().replace("```json", "").replace("```", "").strip()
        start = clean.find("{")
        end = clean.rfind("}") + 1
        if start >= 0 and end > start:
            clean = clean[start:end]

        result = json.loads(clean)

        # Attach live data to each position result
        position_map = {p["ticker"]: p for p in positions}
        for pos_result in result.get("positions", []):
            ticker = pos_result.get("ticker")
            if ticker in position_map:
                pos_result["current_price"] = position_map[ticker]["current_price"]
                pos_result["current_value"] = position_map[ticker]["current_value"]
                pos_result["quantity"] = position_map[ticker]["quantity"]
                pos_result["gain_loss_pct"] = position_map[ticker]["gain_loss_pct"]

        result["total_value"] = round(total_value, 2)
        result["position_count"] = len(positions)
        return result

    except Exception as e:
        print(f"[Strategy Agent] Error: {str(e)}")
        return {
            "error": str(e),
            "positions": [],
            "portfolio_health": {},
            "priority_actions": [],
            "total_value": round(total_value, 2),
            "position_count": len(positions)
        }