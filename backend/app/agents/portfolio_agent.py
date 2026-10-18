"""
Portfolio Agent: how a single ticker fits the user's portfolio — current
weight, concentration level, and what a buy or sell would do to it.
"""

import logging
from sqlalchemy.orm import Session
from app.repositories.portfolio_repository import get_holdings
from app.services.portfolio_service import value_holdings
from app.services.profile_service import concentration_flag, describe_profile, get_profile

logger = logging.getLogger("wealth-copilot.portfolio_agent")


def analyze_portfolio_impact(ticker: str, action: str, db: Session, user_id: str = "") -> dict:
    """
    Portfolio Agent -- how a position fits the user's portfolio, using live
    market-value weights (the same basis as the dashboard).

    Rule-based: it applies the user's concentration limits (from their profile)
    to exact weights, so it spends no LLM call restating numbers.
    """
    ticker = ticker.upper()
    try:
        profile = get_profile(db, user_id)
        limits = profile["limits"]
        limit = limits["high"]
        holdings = get_holdings(db, user_id)
        empty_summary = {"total_value": 0, "position_count": 0, "concentration": {}}
        if not holdings:
            return {
                "concentration_flag": "LOW",
                "current_weight_pct": 0,
                "portfolio_impact": "You have no holdings yet, so any position would be your whole portfolio.",
                "warning": None,
                "portfolio_summary": empty_summary,
                "investor_profile": describe_profile(profile),
            }

        positions, total_value, unpriced = value_holdings(holdings)
        concentration: dict = {}
        for p in positions:
            if p["weight_pct"] is not None:
                concentration[p["ticker"]] = round(concentration.get(p["ticker"], 0) + p["weight_pct"], 2)

        weight = concentration.get(ticker, 0.0)
        flag = concentration_flag(weight, limits)
        largest_ticker, largest_weight = max(concentration.items(), key=lambda kv: kv[1], default=(None, 0))

        if ticker not in concentration:
            impact = f"You don't hold {ticker}; buying it would add a new position and diversify your holdings."
        elif flag == "HIGH":
            impact = (f"{ticker} is {weight:.1f}% of your portfolio — above the {limit:g}% "
                      f"concentration limit. Adding more increases single-stock risk.")
        elif flag == "MEDIUM":
            impact = (f"{ticker} is {weight:.1f}% of your portfolio — moderate concentration; "
                      f"keep additions small to stay under {limit:g}%.")
        else:
            impact = f"{ticker} is {weight:.1f}% of your portfolio — a modest position with room to add."

        warning = None
        if flag == "HIGH":
            warning = f"{ticker} exceeds {limit:g}% of the portfolio."
        elif largest_ticker and largest_ticker != ticker and largest_weight > limit:
            warning = f"Your largest position, {largest_ticker}, is {largest_weight:.1f}% of the portfolio."
        if unpriced:
            note = f"Live prices unavailable for: {', '.join(unpriced)}"
            warning = f"{warning} {note}" if warning else note

        return {
            "concentration_flag": flag,
            "current_weight_pct": weight,
            "portfolio_impact": impact,
            "warning": warning,
            "portfolio_summary": {
                "total_value": round(total_value, 2),
                "position_count": len(holdings),
                "concentration": concentration,
            },
            "investor_profile": describe_profile(profile),
        }

    except Exception as e:
        logger.exception("Portfolio agent failed")
        return {
            "concentration_flag": "UNKNOWN",
            "portfolio_impact": f"Error: {str(e)}",
            "warning": str(e),
            "portfolio_summary": {"total_value": 0, "position_count": 0, "concentration": {}},
        }
