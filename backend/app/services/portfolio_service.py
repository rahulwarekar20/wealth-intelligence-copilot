import time
import logging
from typing import Optional
import httpx
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from app.repositories.portfolio_repository import get_holdings
from app.core.config import settings

logger = logging.getLogger("wealth-copilot.portfolio")

# ── In-memory price cache (5-minute TTL) ──────────────────────────────────────
_price_cache: dict = {}
_CACHE_TTL = 300  # seconds


def fetch_current_price(ticker: str) -> Optional[float]:
    """
    Fetch current price from Finnhub with a 5-minute in-memory cache.
    Returns None when no valid price is available (unknown ticker, API error,
    rate limit) so callers never treat a missing price as $0.
    """
    now = time.time()
    if ticker in _price_cache:
        cached_price, cached_at = _price_cache[ticker]
        if now - cached_at < _CACHE_TTL:
            return cached_price

    try:
        url = (
            f"https://finnhub.io/api/v1/quote"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=8)
        response.raise_for_status()
        price = float(response.json().get("c") or 0)
        if price > 0:
            _price_cache[ticker] = (price, now)
            return price
        logger.warning("No price returned for %s", ticker)
    except Exception as e:
        logger.warning("Price fetch failed for %s: %s", ticker, e)

    # Fall back to the last known price (even if stale), else unavailable
    if ticker in _price_cache:
        return _price_cache[ticker][0]
    return None


def value_holdings(holdings: list) -> tuple[list[dict], float, list[str]]:
    """
    Prices every holding in parallel and computes market value and weight.

    Returns (positions, total_value, unpriced_tickers). Positions whose price
    is unavailable have current_price/current_value/weight_pct/gain_loss_pct
    set to None and are excluded from the total, so they don't distort weights.
    """
    if not holdings:
        return [], 0.0, []

    tickers = list({h.ticker for h in holdings})
    with ThreadPoolExecutor(max_workers=10) as executor:
        prices = dict(zip(tickers, executor.map(fetch_current_price, tickers)))

    positions = []
    for h in holdings:
        price = prices.get(h.ticker)
        quantity = float(h.quantity)
        cost_basis = float(h.cost_basis) if h.cost_basis is not None else None
        value = quantity * price if price is not None else None
        gain = (
            round((price - cost_basis) / cost_basis * 100, 2)
            if price is not None and cost_basis
            else None
        )
        positions.append({
            "id": str(h.id),
            "ticker": h.ticker,
            "quantity": quantity,
            "cost_basis": cost_basis,
            "account_type": h.account_type,
            "current_price": price,
            "current_value": value,
            "gain_loss_pct": gain,
            "price_available": price is not None,
        })

    total_value = sum(p["current_value"] for p in positions if p["current_value"] is not None)
    for p in positions:
        p["weight_pct"] = (
            round(p["current_value"] / total_value * 100, 2)
            if p["current_value"] is not None and total_value > 0
            else None
        )

    unpriced = sorted({p["ticker"] for p in positions if not p["price_available"]})
    return positions, total_value, unpriced


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
    Fetched in parallel to avoid sequential API delays.
    """
    if len(tickers) < 2:
        return {}

    price_data = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_historical_prices, t): t for t in tickers}
        for future in as_completed(futures):
            ticker = futures[future]
            prices = future.result()
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
    2. Get live prices in PARALLEL via Finnhub (with cache)
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
            "correlation": {},
            "unpriced_tickers": []
        }

    positions, total_value, unpriced = value_holdings(holdings)

    # Sum weights per ticker (a ticker can appear in several accounts)
    concentration: dict = {}
    for p in positions:
        if p["weight_pct"] is not None:
            concentration[p["ticker"]] = round(concentration.get(p["ticker"], 0) + p["weight_pct"], 2)

    correlation = compute_correlation(list({h.ticker for h in holdings}))

    return {
        "total_value": round(total_value, 2),
        "holdings": positions,
        "concentration": concentration,
        "correlation": correlation,
        "unpriced_tickers": unpriced
    }
