"""
Market Data Agent: fetches the live quote from Finnhub and interprets the
day's price action (signal, momentum, position in the day's range). Rule-based,
no LLM call.
"""

from app.core.config import settings
import httpx


def interpret_quote(current_price: float, prev_close: float, high: float, low: float) -> dict:
    """
    Rule-based reading of today's price action. This used to be an LLM call,
    but it only restated these numbers -- doing it in code is instant, exact,
    and saves AI rate-limit budget for the agents that need language.
    """
    daily_change_pct = round((current_price - prev_close) / prev_close * 100, 2) if prev_close > 0 else 0.0
    day_range = high - low
    position_pct = round((current_price - low) / day_range * 100, 1) if day_range > 0 else 50.0

    if daily_change_pct >= 1.0 or (daily_change_pct > 0 and position_pct >= 70):
        signal = "bullish"
    elif daily_change_pct <= -1.0 or (daily_change_pct < 0 and position_pct <= 30):
        signal = "bearish"
    else:
        signal = "neutral"

    move = abs(daily_change_pct)
    momentum = "strong" if move >= 2.0 else "moderate" if move >= 0.75 else "weak"
    position = "near_high" if position_pct >= 70 else "near_low" if position_pct <= 30 else "mid_range"
    position_text = {"near_high": "near the top of", "near_low": "near the bottom of", "mid_range": "mid-way through"}[position]
    direction = "up" if daily_change_pct > 0 else "down" if daily_change_pct < 0 else "flat"

    return {
        "current_price": current_price,
        "daily_change_pct": daily_change_pct,
        "market_signal": signal,
        "momentum": momentum,
        "price_position": position,
        "intraday_analysis": (
            f"{direction.capitalize()} {move:.2f}% today, trading {position_text} the day's "
            f"${low:.2f}–${high:.2f} range."
        ),
    }


def analyze_market_context(ticker: str) -> dict:
    """
    Market Data Agent -- fetches the current quote and interprets the day's
    price action (signal, momentum, position in the day's range).
    """
    try:
        url = (
            f"https://finnhub.io/api/v1/quote"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        quote = response.json()
    except Exception as e:
        return {"error": str(e), "market_signal": "unknown", "momentum": "neutral"}

    current_price = quote.get("c") or 0
    if current_price <= 0:
        # Finnhub returns zeros for unknown tickers
        return {"error": f"No market data available for {ticker}", "market_signal": "unknown", "momentum": "neutral"}

    return interpret_quote(
        current_price=current_price,
        prev_close=quote.get("pc") or 0,
        high=quote.get("h") or current_price,
        low=quote.get("l") or current_price,
    )
