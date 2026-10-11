import re
import httpx
import time
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.repositories.evidence_repository import (
    save_evidence_item,
    get_evidence_by_ticker,
    get_latest_evidence
)

# Evidence younger than this is reused instead of re-fetched and re-stored
EVIDENCE_FRESHNESS = timedelta(minutes=10)

POSITIVE_WORDS = [
    "beat", "beats", "surge", "surges", "gain", "gains", "growth", "profit", "profits",
    "record", "upgrade", "upgraded", "strong", "exceed", "exceeds", "rise", "rises",
    "rally", "outperform", "bullish", "soar", "soars", "jump", "jumps"
]
NEGATIVE_WORDS = [
    "miss", "misses", "drop", "drops", "fall", "falls", "loss", "losses", "decline",
    "declines", "downgrade", "downgraded", "weak", "plunge", "plunges", "cut", "cuts",
    "lawsuit", "probe", "underperform", "bearish", "slump", "slumps", "tumble", "tumbles"
]
_POS_RE = re.compile(r"\b(" + "|".join(POSITIVE_WORDS) + r")\b", re.IGNORECASE)
_NEG_RE = re.compile(r"\b(" + "|".join(NEGATIVE_WORDS) + r")\b", re.IGNORECASE)


def score_headlines(headlines: list[str]) -> tuple[str, float]:
    """
    Scores headline sentiment using whole-word matches (so "up" no longer
    matches "update"), counting every occurrence in every headline.
    Returns (sentiment_label, score in [-1, 1]).
    """
    pos = sum(len(_POS_RE.findall(h)) for h in headlines)
    neg = sum(len(_NEG_RE.findall(h)) for h in headlines)
    total = pos + neg
    if total == 0:
        return "neutral", 0.0
    score = round((pos - neg) / total, 2)
    if score > 0.2:
        return "positive", score
    if score < -0.2:
        return "negative", score
    return "neutral", score


def _fresh_payload(db: Session, ticker: str, source_type: str):
    item = get_latest_evidence(db, ticker, source_type)
    if item and item.retrieved_at and datetime.now(timezone.utc) - item.retrieved_at < EVIDENCE_FRESHNESS:
        return item.payload
    return None


def fetch_company_news(ticker: str, db: Session) -> dict:
    cached = _fresh_payload(db, ticker, "sentiment")
    if cached is not None:
        return cached
    try:
        end = int(time.time())
        start = end - (7 * 24 * 60 * 60)
        start_date = datetime.fromtimestamp(start, tz=timezone.utc).strftime("%Y-%m-%d")
        end_date = datetime.fromtimestamp(end, tz=timezone.utc).strftime("%Y-%m-%d")

        url = (
            f"https://finnhub.io/api/v1/company-news"
            f"?symbol={ticker}"
            f"&from={start_date}"
            f"&to={end_date}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        articles = response.json()
        if not isinstance(articles, list):
            raise ValueError(f"Unexpected news response: {str(articles)[:100]}")

        if not articles:
            return {
                "headline_count": 0,
                "headlines": [],
                "sentiment": "neutral",
                "sentiment_score": 0.0
            }

        top_headlines = [
            {
                "headline": a.get("headline", ""),
                "source": a.get("source", ""),
                "datetime": a.get("datetime", 0)
            }
            for a in articles[:5]
        ]

        sentiment, score = score_headlines([a.get("headline", "") for a in articles[:10]])

        result = {
            "headline_count": len(articles),
            "headlines": top_headlines,
            "sentiment": sentiment,
            "sentiment_score": score
        }

        save_evidence_item(db=db, ticker=ticker, source_type="sentiment", payload=result, reliability_weight=0.7)
        return result

    except Exception as e:
        return {
            "headline_count": 0,
            "headlines": [],
            "sentiment": "neutral",
            "sentiment_score": 0.0,
            "error": str(e)
        }


def fetch_company_fundamentals(ticker: str, db: Session) -> dict:
    cached = _fresh_payload(db, ticker, "filing")
    if cached is not None:
        return cached
    try:
        profile_url = (
            f"https://finnhub.io/api/v1/stock/profile2"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        profile_response = httpx.get(profile_url, timeout=10)
        profile_response.raise_for_status()
        profile = profile_response.json() or {}

        metrics_url = (
            f"https://finnhub.io/api/v1/stock/metric"
            f"?symbol={ticker}"
            f"&metric=all"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        metrics_response = httpx.get(metrics_url, timeout=10)
        metrics_response.raise_for_status()
        metrics = (metrics_response.json() or {}).get("metric") or {}

        result = {
            "company_name": profile.get("name") or ticker,
            "industry": profile.get("finnhubIndustry") or "Unknown",
            "market_cap": profile.get("marketCapitalization") or 0,
            "pe_ratio": metrics.get("peBasicExclExtraTTM"),
            "52_week_high": metrics.get("52WeekHigh"),
            "52_week_low": metrics.get("52WeekLow"),
            "revenue_growth": metrics.get("revenueGrowthTTMYoy"),
            "profit_margin": metrics.get("netProfitMarginTTM")
        }

        save_evidence_item(db=db, ticker=ticker, source_type="filing", payload=result, reliability_weight=0.9)
        return result

    except Exception as e:
        return {"error": str(e)}


def fetch_price_trend(ticker: str, db: Session) -> dict:
    cached = _fresh_payload(db, ticker, "price_volume")
    if cached is not None:
        return cached
    try:
        url = (
            f"https://finnhub.io/api/v1/quote"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        current_price = data.get("c") or 0
        open_price = data.get("o") or 0
        high_price = data.get("h") or 0
        low_price = data.get("l") or 0
        prev_close = data.get("pc") or 0

        if current_price <= 0:
            return {"error": f"No price data available for {ticker}"}

        daily_change_pct = 0.0
        if prev_close > 0:
            daily_change_pct = round(((current_price - prev_close) / prev_close) * 100, 2)

        if daily_change_pct > 1.5:
            trend = "bullish"
        elif daily_change_pct < -1.5:
            trend = "bearish"
        else:
            trend = "neutral"

        result = {
            "current_price": current_price,
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "prev_close": prev_close,
            "daily_change_pct": daily_change_pct,
            "trend": trend
        }

        save_evidence_item(db=db, ticker=ticker, source_type="price_volume", payload=result, reliability_weight=1.0)
        return result

    except Exception as e:
        return {"error": str(e)}


def gather_evidence(ticker: str, db: Session) -> dict:
    ticker = ticker.upper()

    price_data = fetch_price_trend(ticker, db)
    news_sentiment = fetch_company_news(ticker, db)
    fundamentals = fetch_company_fundamentals(ticker, db)
    evidence_items = get_evidence_by_ticker(db, ticker)

    return {
        "ticker": ticker,
        "price_data": price_data,
        "news_sentiment": news_sentiment,
        "fundamentals": fundamentals,
        "evidence_items": [
            {
                "id": str(e.id),
                "ticker": e.ticker,
                "source_type": e.source_type,
                "payload": e.payload,
                "reliability_weight": float(e.reliability_weight or 0),
                "retrieved_at": str(e.retrieved_at)
            }
            for e in evidence_items
        ]
    }
