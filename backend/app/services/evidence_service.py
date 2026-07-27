import httpx
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.repositories.evidence_repository import (
    save_evidence_item,
    get_evidence_by_ticker
)


def fetch_company_news(ticker: str, db: Session) -> dict:
    try:
        end = int(time.time())
        start = end - (7 * 24 * 60 * 60)
        start_date = datetime.fromtimestamp(start).strftime("%Y-%m-%d")
        end_date = datetime.fromtimestamp(end).strftime("%Y-%m-%d")

        url = (
            f"https://finnhub.io/api/v1/company-news"
            f"?symbol={ticker}"
            f"&from={start_date}"
            f"&to={end_date}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        articles = response.json()

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

        positive_words = [
            "beat", "surge", "gain", "growth", "profit", "record",
            "upgrade", "buy", "strong", "exceed", "rise", "up"
        ]
        negative_words = [
            "miss", "drop", "fall", "loss", "decline", "downgrade",
            "sell", "weak", "below", "cut", "down", "risk"
        ]

        all_text = " ".join(
            [a.get("headline", "").lower() for a in articles[:10]]
        )

        pos_count = sum(1 for w in positive_words if w in all_text)
        neg_count = sum(1 for w in negative_words if w in all_text)
        total = pos_count + neg_count

        if total == 0:
            sentiment = "neutral"
            score = 0.0
        elif pos_count > neg_count:
            sentiment = "positive"
            score = round(pos_count / total, 2)
        else:
            sentiment = "negative"
            score = round(-neg_count / total, 2)

        result = {
            "headline_count": len(articles),
            "headlines": top_headlines,
            "sentiment": sentiment,
            "sentiment_score": score
        }

        save_evidence_item(
            db=db,
            ticker=ticker,
            source_type="sentiment",
            payload=result,
            reliability_weight=0.7
        )

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
    try:
        profile_url = (
            f"https://finnhub.io/api/v1/stock/profile2"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        profile_response = httpx.get(profile_url, timeout=10)
        profile = profile_response.json()

        metrics_url = (
            f"https://finnhub.io/api/v1/stock/metric"
            f"?symbol={ticker}"
            f"&metric=all"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        metrics_response = httpx.get(metrics_url, timeout=10)
        metrics_data = metrics_response.json()
        metrics = metrics_data.get("metric", {})

        result = {
            "company_name": profile.get("name", ticker),
            "industry": profile.get("finnhubIndustry", "Unknown"),
            "market_cap": profile.get("marketCapitalization", 0),
            "pe_ratio": metrics.get("peBasicExclExtraTTM", None),
            "52_week_high": metrics.get("52WeekHigh", None),
            "52_week_low": metrics.get("52WeekLow", None),
            "revenue_growth": metrics.get("revenueGrowthTTMYoy", None),
            "profit_margin": metrics.get("netProfitMarginTTM", None)
        }

        save_evidence_item(
            db=db,
            ticker=ticker,
            source_type="filing",
            payload=result,
            reliability_weight=0.9
        )

        return result

    except Exception as e:
        return {"error": str(e)}


def fetch_price_trend(ticker: str, db: Session) -> dict:
    try:
        url = (
            f"https://finnhub.io/api/v1/quote"
            f"?symbol={ticker}"
            f"&token={settings.FINNHUB_API_KEY}"
        )
        response = httpx.get(url, timeout=10)
        data = response.json()

        current_price = data.get("c", 0)
        open_price = data.get("o", 0)
        high_price = data.get("h", 0)
        low_price = data.get("l", 0)
        prev_close = data.get("pc", 0)

        daily_change_pct = 0.0
        if prev_close and prev_close > 0:
            daily_change_pct = round(
                ((current_price - prev_close) / prev_close) * 100, 2
            )

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

        save_evidence_item(
            db=db,
            ticker=ticker,
            source_type="price_volume",
            payload=result,
            reliability_weight=1.0
        )

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
                "reliability_weight": float(e.reliability_weight),
                "retrieved_at": str(e.retrieved_at)
            }
            for e in evidence_items
        ]
    }