import httpx
import numpy as np
from sqlalchemy.orm import Session
from app.repositories.portfolio_repository import get_holdings
from app.core.config import settings


def fetch_current_price(ticker: str) -> float:
    """
    Fetch current price using Finnhub API.
    60 requests per minute on free tier.
    """
    try:
        url = (
            f"https://finnhub.io/api/v1/quote"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        data = response.json()
        # Finnhub returns 'c' for current price
        price = data.get("c", 0)
        return float(price)
    except Exception:
        return 0.0


def fetch_historical_prices(ticker: str, days: int = 30) -> list:
    """
    Fetch daily closing prices using Alpha Vantage.
    Used for correlation calculation only.
    """
    try:
        url = (
            f"https://www.alphavantage.co/query"
            f"?function=TIME_SERIES_DAILY"
            f"&symbol={ticker}"
            f"&outputsize=compact"
            f"&apikey={settings.ALPHA_VANTAGE_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        data = response.json()
        time_series = data.get("Time Series (Daily)", {})
        prices = []
        for date in sorted(time_series.keys(), reverse=True)[:days]:
            prices.append(float(time_series[date]["4. close"]))
        return prices
    except Exception:
        return []


def compute_correlation(tickers: list[str]) -> dict:
    """
    Compute pairwise correlation between tickers
    using 30 days of historical closing prices.
    Note: uses Alpha Vantage which resets daily at midnight.
    """
    if len(tickers) < 2:
        return {}

    price_data = {}
    for ticker in tickers:
        prices = fetch_historical_prices(ticker)
        if prices:
            price_data[ticker] = prices

    if len(price_data) < 2:
        return {"note": "Insufficient historical data -- try again tomorrow when API resets"}

    min_len = min(len(v) for v in price_data.values())
    if min_len < 2:
        return {}

    result = {}
    ticker_list = list(price_data.keys())
    for i, t1 in enumerate(ticker_list):
        for t2 in ticker_list[i + 1:]:
            prices1 = np.array(price_data[t1][:min_len])
            prices2 = np.array(price_data[t2][:min_len])
            corr = np.corrcoef(prices1, prices2)[0, 1]
            if not np.isnan(corr):
                result[f"{t1}_vs_{t2}"] = round(float(corr), 3)

    return result


def compute_portfolio_summary(db: Session, user_id: str) -> dict:
    """
    Core portfolio-aware computation:
    1. Fetch all holdings for the user
    2. Get live prices via Finnhub
    3. Calculate total portfolio value
    4. Calculate concentration per position
    5. Calculate pairwise correlation across holdings
    """
    holdings = get_holdings(db, user_id)

    if not holdings:
        return {
            "total_value": 0.0,
            "holdings": [],
            "concentration": {},
            "correlation": {}
        }

    # Fetch live prices and calculate position values
    enriched = []
    for h in holdings:
        price = fetch_current_price(h.ticker)
        value = float(h.quantity) * price
        enriched.append({
            "id": str(h.id),
            "ticker": h.ticker,
            "quantity": float(h.quantity),
            "cost_basis": float(h.cost_basis) if h.cost_basis else None,
            "account_type": h.account_type,
            "current_price": price,
            "current_value": value
        })

    # Calculate total portfolio value
    total_value = sum(h["current_value"] for h in enriched)

    # Concentration per position
    concentration = {}
    for h in enriched:
        pct = (h["current_value"] / total_value * 100) if total_value > 0 else 0
        concentration[h["ticker"]] = round(pct, 2)

    # Correlation across all holdings
    tickers = [h["ticker"] for h in enriched]
    correlation = compute_correlation(tickers)

    return {
        "total_value": round(total_value, 2),
        "holdings": enriched,
        "concentration": concentration,
        "correlation": correlation
    }