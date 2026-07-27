from sqlalchemy.orm import Session
from app.agents.bedrock_client import invoke_claude
from app.repositories.portfolio_repository import get_holdings
import json


def analyze_portfolio_impact(ticker: str, action: str, db: Session, user_id: str = "") -> dict:
    try:
        print(f"[Portfolio Agent] user_id received: '{user_id}'")
        holdings = get_holdings(db, user_id)
        print(f"[Portfolio Agent] holdings found: {len(holdings)}")

        if not holdings:
            return {
                "concentration_flag": "LOW",
                "portfolio_impact": "No holdings found in portfolio",
                "warning": None,
                "portfolio_summary": {
                    "total_value": 0,
                    "position_count": 0,
                    "concentration": {}
                }
            }

        total_cost = sum(
            float(h.quantity) * float(h.cost_basis or 0)
            for h in holdings
        )

        holdings_text = ""
        concentration = {}
        for h in holdings:
            value = float(h.quantity) * float(h.cost_basis or 0)
            pct = (value / total_cost * 100) if total_cost > 0 else 0
            concentration[h.ticker] = round(pct, 2)
            holdings_text += f"  - {h.ticker}: {h.quantity} shares, cost basis ${h.cost_basis}, weight {pct:.1f}%\n"

        portfolio_context = f"""
Current Portfolio ({len(holdings)} positions, total cost basis ${total_cost:,.2f}):
{holdings_text}
Concentration by cost basis: {json.dumps(concentration)}
"""

        system_prompt = """You are the Portfolio Agent for a wealth intelligence platform.
Analyze the impact of a proposed investment action on an existing portfolio.

Focus on:
1. Concentration risk -- would this increase exposure too much?
2. Sector overlap -- heavy exposure to this sector already?
3. Portfolio impact -- how would this change the overall balance?

Flag HIGH concentration if any single position would exceed 25%.
Flag MEDIUM concentration if between 15-25%.
Flag LOW concentration if under 15%.

Respond in this exact JSON format with no other text:
{
  "concentration_flag": "HIGH|MEDIUM|LOW",
  "current_weight_pct": 16.44,
  "sector_overlap": "high|medium|low",
  "portfolio_impact": "brief description of impact",
  "recommendation": "brief portfolio-level recommendation",
  "warning": "any specific warning or null"
}"""

        user_prompt = f"""Analyze the portfolio impact of this action:
Ticker: {ticker}
Action: {action}

{portfolio_context}

Respond with JSON only."""

        response = invoke_claude(
            system_prompt,
            user_prompt,
            max_tokens=512,
            use_haiku=True
        )

        print(f"[Portfolio Agent] raw response: {response[:200]}")

        clean = response.strip().replace("```json", "").replace("```", "").strip()
        start = clean.find("{")
        end = clean.rfind("}") + 1
        if start >= 0 and end > start:
            clean = clean[start:end]

        try:
            result = json.loads(clean)
        except json.JSONDecodeError:
            current_weight = concentration.get(ticker.upper(), 0)
            flag = "HIGH" if current_weight > 25 else "MEDIUM" if current_weight > 15 else "LOW"
            result = {
                "concentration_flag": flag,
                "current_weight_pct": current_weight,
                "sector_overlap": "medium",
                "portfolio_impact": f"{ticker} currently represents {current_weight:.1f}% of your portfolio",
                "recommendation": "Consider position sizing carefully",
                "warning": None
            }

        result["portfolio_summary"] = {
            "total_value": total_cost,
            "position_count": len(holdings),
            "concentration": concentration
        }
        return result

    except Exception as e:
        return {
            "concentration_flag": "UNKNOWN",
            "portfolio_impact": f"Error: {str(e)}",
            "warning": str(e),
            "portfolio_summary": {
                "total_value": 0,
                "position_count": 0,
                "concentration": {}
            }
        }