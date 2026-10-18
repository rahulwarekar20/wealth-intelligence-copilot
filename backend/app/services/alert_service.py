"""
In-app alerts.

check_alerts() looks at the user's holdings and records an alert for:
  - concentration  a ticker above the user's position limit (once a week per ticker)
  - price_drop     a holding down DROP_ALERT_PCT or more today (once a day per ticker)
  - filing         a new 10-K or 10-Q filed in the last FILING_WINDOW_DAYS (once per filing)
  - earnings       an earnings report in the next EARNINGS_WINDOW_DAYS (once per date)
Strategy changes are recorded separately by add_alert() when a strategy is saved.

Checks are throttled to once per CHECK_INTERVAL per user, and every alert has a
dedupe_key, so running the checks repeatedly never repeats an alert.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.models import Alert
from app.repositories.portfolio_repository import get_holdings
from app.services.evidence_service import fetch_price_trend
from app.services.portfolio_service import value_holdings
from app.services.profile_service import get_profile
from app.services.sec_service import get_company_financials

logger = logging.getLogger("wealth-copilot.alerts")

CHECK_INTERVAL = timedelta(minutes=30)
DROP_ALERT_PCT = 5.0
FILING_WINDOW_DAYS = 14
EARNINGS_WINDOW_DAYS = 14
EARNINGS_CACHE_SECONDS = 12 * 3600
MAX_ALERTS_RETURNED = 50

# user_id -> when the checks last ran (in memory: a restart just means one extra check)
_last_checked: dict[str, datetime] = {}
# ticker -> (fetched_at, upcoming earnings dates)
_earnings_cache: dict[str, tuple[float, list[str]]] = {}


def add_alert(db: Session, user_id: str, kind: str, message: str, dedupe_key: str, ticker: Optional[str] = None) -> bool:
    """Records an alert unless one with the same key already exists. Returns True if it was new."""
    if db.query(Alert.id).filter(Alert.user_id == user_id, Alert.dedupe_key == dedupe_key).first():
        return False
    db.add(Alert(user_id=user_id, kind=kind, ticker=ticker, message=message, dedupe_key=dedupe_key))
    try:
        db.commit()
        return True
    except IntegrityError:  # created concurrently by another request
        db.rollback()
        return False


def _upcoming_earnings(ticker: str) -> list[str]:
    """Earnings dates (YYYY-MM-DD) in the next EARNINGS_WINDOW_DAYS from Finnhub, cached for 12 hours."""
    cached = _earnings_cache.get(ticker)
    if cached and time.time() - cached[0] < EARNINGS_CACHE_SECONDS:
        return cached[1]
    today = date.today()
    response = httpx.get(
        "https://finnhub.io/api/v1/calendar/earnings",
        params={"from": today.isoformat(), "to": (today + timedelta(days=EARNINGS_WINDOW_DAYS)).isoformat(),
                "symbol": ticker, "token": settings.FINNHUB_API_KEY},
        timeout=8,
    )
    response.raise_for_status()
    dates = sorted({e["date"] for e in response.json().get("earningsCalendar", []) if e.get("date")})
    _earnings_cache[ticker] = (time.time(), dates)
    return dates


def _ticker_events(ticker: str, make_session) -> list[dict]:
    """Price-drop, filing and earnings events for one ticker (runs in a worker thread, own DB session)."""
    events = []
    db = make_session()
    try:
        try:
            change = fetch_price_trend(ticker, db).get("daily_change_pct")
            if change is not None and change <= -DROP_ALERT_PCT:
                events.append({"kind": "price_drop", "key": f"drop:{ticker}:{date.today()}",
                               "message": f"{ticker} is down {abs(change):.1f}% today."})
        except Exception as e:
            logger.warning("Price check failed for %s: %s", ticker, e)

        try:
            fin = get_company_financials(ticker, db)  # None for ETFs and non-US companies
            for filing in ((fin or {}).get("filings") or {}).values():
                filed = date.fromisoformat(filing["filing_date"])
                if (date.today() - filed).days <= FILING_WINDOW_DAYS:
                    events.append({
                        "kind": "filing", "key": f"filing:{ticker}:{filing['accession']}",
                        "message": f"{ticker} filed its {filing['form']} on {filed:%b %d}. "
                                   f"Ask the copilot what changed.",
                    })
        except Exception as e:
            logger.warning("Filing check failed for %s: %s", ticker, e)

        try:
            for day in _upcoming_earnings(ticker):
                events.append({"kind": "earnings", "key": f"earnings:{ticker}:{day}",
                               "message": f"{ticker} reports earnings on {date.fromisoformat(day):%a %b %d}."})
        except Exception as e:
            logger.warning("Earnings check failed for %s: %s", ticker, e)
    finally:
        db.close()
    return events


def check_alerts(db: Session, user_id: str, force: bool = False) -> int:
    """Runs every check (unless they ran within CHECK_INTERVAL) and returns how many new alerts were added."""
    now = datetime.now(timezone.utc)
    last = _last_checked.get(user_id)
    if not force and last and now - last < CHECK_INTERVAL:
        return 0
    _last_checked[user_id] = now

    holdings = get_holdings(db, user_id)
    if not holdings:
        return 0
    added = 0

    # Concentration, against the user's own limit
    limit = get_profile(db, user_id)["limits"]["high"]
    positions, _, _ = value_holdings(holdings)
    weights: dict = {}
    for p in positions:
        if p["weight_pct"] is not None:
            weights[p["ticker"]] = weights.get(p["ticker"], 0) + p["weight_pct"]
    week = now.strftime("%G-W%V")
    for ticker, weight in weights.items():
        if weight > limit:
            added += add_alert(db, user_id, "concentration",
                               f"{ticker} is {weight:.1f}% of your portfolio, above your {limit:g}% limit.",
                               f"concentration:{ticker}:{week}", ticker)

    # Per-ticker market events, fetched in parallel
    make_session = sessionmaker(bind=db.get_bind(), autocommit=False, autoflush=False)
    tickers = sorted(weights) or sorted({h.ticker for h in holdings})
    with ThreadPoolExecutor(max_workers=5) as pool:
        for ticker, events in zip(tickers, pool.map(lambda t: _ticker_events(t, make_session), tickers)):
            for e in events:
                added += add_alert(db, user_id, e["kind"], e["message"], e["key"], ticker)
    return added


def list_alerts(db: Session, user_id: str) -> dict:
    """The newest alerts and how many are unread."""
    rows = (
        db.query(Alert)
        .filter(Alert.user_id == user_id)
        .order_by(Alert.created_at.desc())
        .limit(MAX_ALERTS_RETURNED)
        .all()
    )
    unread = db.query(Alert).filter(Alert.user_id == user_id, Alert.read_at.is_(None)).count()
    return {
        "alerts": [
            {"id": str(a.id), "kind": a.kind, "ticker": a.ticker, "message": a.message,
             "created_at": a.created_at.isoformat(), "read": a.read_at is not None}
            for a in rows
        ],
        "unread": unread,
    }


def mark_read(db: Session, user_id: str, alert_id: Optional[str] = None) -> None:
    """Marks one alert (or, with no id, all of the user's alerts) as read."""
    query = db.query(Alert).filter(Alert.user_id == user_id, Alert.read_at.is_(None))
    if alert_id:
        query = query.filter(Alert.id == alert_id)
    query.update({Alert.read_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
