from app.agents.bedrock_client import invoke_claude
from app.core.config import settings
import httpx


def analyze_market_context(ticker: str) -> dict:
    """
    Market Data Agent -- fetches and interprets current
    market context for a ticker.

    Returns price trend analysis, momentum signals,
    and market context.
    """
    # Fetch current quote from Finnhub
    try:
        url = (
            f"https://finnhub.io/api/v1/quote"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        quote = response.json()

        current_price = quote.get("c", 0)
        prev_close = quote.get("pc", 0)
        high = quote.get("h", 0)
        low = quote.get("l", 0)
        open_price = quote.get("o", 0)

        daily_change_pct = 0.0
        if prev_close and prev_close > 0:
            daily_change_pct = round(
                ((current_price - prev_close) / prev_close) * 100, 2
            )

        # Price position within day's range
        day_range = high - low
        price_position = 0.0
        if day_range > 0:
            price_position = round(
                ((current_price - low) / day_range) * 100, 1
            )

    except Exception as e:
        return {
            "error": str(e),
            "market_signal": "unknown",
            "momentum": "neutral"
        }

    market_context = f"""
Current Market Data for {ticker}:
- Current Price: ${current_price:.2f}
- Open: ${open_price:.2f}
- High: ${high:.2f}
- Low: ${low:.2f}
- Previous Close: ${prev_close:.2f}
- Daily Change: {daily_change_pct:.2f}%
- Price Position in Day Range: {price_position:.1f}%
  (0% = at day low, 100% = at day high)
"""

    system_prompt = """You are the Market Data Agent for a wealth intelligence platform.
Your job is to interpret current market data and identify momentum signals.

Analyze the price action and provide market context.

Price position in day range guide:
- 0-30%: trading near lows, potential weakness
- 30-70%: trading in middle of range, neutral
- 70-100%: trading near highs, potential strength

Respond in this exact JSON format:
{
  "current_price": 327.74,
  "daily_change_pct": 0.35,
  "market_signal": "bullish|bearish|neutral",
  "momentum": "strong|moderate|weak",
  "price_position": "near_high|mid_range|near_low",
  "intraday_analysis": "brief description of today's price action",
  "trading_note": "any notable observation about current price action"
}"""

    user_prompt = f"""Analyze this market data:

{market_context}

Respond with JSON only, no other text."""

    try:
        response = invoke_claude(system_prompt, user_prompt, max_tokens=512)
        import json
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
        return result
    except Exception as e:
        return {
            "current_price": current_price,
            "daily_change_pct": daily_change_pct,
            "market_signal": "neutral",
            "momentum": "weak",
            "price_position": "mid_range",
            "intraday_analysis": "Could not analyze market data",
            "trading_note": str(e)
        }