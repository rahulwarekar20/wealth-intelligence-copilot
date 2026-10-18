"""
Portfolio strategy lifecycle: reuse, run, save, pre-load.

get_or_run_strategy() returns the user's most recent strategy when nothing it
depends on has changed in the last REUSE_MINUTES (holdings, profile, other
assets), instead of running the multi-agent analysis again. This keeps the
dashboard instant on every visit, leaves AI capacity for chat questions, and
keeps the calls stable between visits. `refresh=True` always runs a new one.

After a fresh run, the 10-K filings of every holding are pre-loaded in the
background, so first chat questions about them skip the ~3 s download.
"""
import hashlib
import json
import logging
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Callable

from sqlalchemy.orm import Session, sessionmaker

from app.models.models import Decision
from app.repositories.portfolio_repository import get_holdings
from app.services.alert_service import add_alert
from app.services.history_service import STRATEGY_TICKER, describe_changes, latest_strategy, strategy_changes
from app.services.profile_service import assets_by_class, get_profile

logger = logging.getLogger("wealth-copilot.strategy_service")

REUSE_MINUTES = 30


def strategy_fingerprint(db: Session, user_id: str) -> str:
    """
    A hash of everything a strategy depends on apart from live prices:
    holdings, the investor profile and other assets. If it changes, a saved
    strategy is out of date.
    """
    holdings = sorted(
        (h.ticker, float(h.quantity), float(h.cost_basis or 0), h.account_type or "") for h in get_holdings(db, user_id)
    )
    profile = get_profile(db, user_id)
    payload = {
        "holdings": holdings,
        "profile": [profile["risk_tolerance"], profile["horizon_years"], profile["max_position_pct"]],
        "assets": sorted((k, round(v, 2)) for k, v in assets_by_class(db, user_id).items()),
    }
    return hashlib.sha256(json.dumps(payload).encode()).hexdigest()[:16]


def save_strategy(db: Session, user_id: str, result: dict) -> None:
    """
    Journals a portfolio-wide strategy result. First compares it with the
    previous strategy: the differences are attached as result["changes"] (shown
    as "since your last analysis"), and an alert is raised if any call changed.
    """
    if not result.get("positions"):
        return
    previous = latest_strategy(db, user_id)
    changes = strategy_changes(previous.recommendation_json if previous else None, result,
                               previous.created_at if previous else None)
    result["changes"] = changes
    if changes and (message := describe_changes(changes)):
        add_alert(db, user_id, "strategy_change", message, f"strategy:{result.get('generated_at') or uuid.uuid4()}")

    health = result.get("portfolio_health") or {}
    db.add(Decision(
        user_id=user_id,
        ticker=STRATEGY_TICKER,
        query_text="Portfolio-wide strategy analysis",
        recommendation_json=result,
        confidence=(health.get("overall_score") or 0) / 100,
        evidence_diversity_score=0.8,
        prompt_version="v1"
    ))
    db.commit()


def prewarm_filings(tickers: list[str], make_session: Callable[[], Session]) -> None:
    """Loads the latest 10-K sections of each ticker in a background thread (best effort)."""
    def work():
        """Fetches and caches each ticker's 10-K sections on a dedicated DB session."""
        from app.services.sec_service import gather_sec_evidence
        db = make_session()
        try:
            for ticker in tickers:
                try:
                    gather_sec_evidence(ticker, "", db)
                except Exception as e:  # pre-loading must never affect the user
                    logger.info("Pre-loading filings for %s skipped: %s", ticker, e)
        finally:
            db.close()

    threading.Thread(target=work, daemon=True).start()


def get_or_run_strategy(db: Session, user_id: str, runner: Callable[..., dict], refresh: bool = False) -> dict:
    """
    The user's portfolio strategy: a recent saved one when still valid (marked
    "reused": true), otherwise a fresh run from `runner`, which is saved.
    Results with "error" or "no_holdings" are returned as-is and not saved.
    """
    fingerprint = strategy_fingerprint(db, user_id)

    if not refresh:
        previous = latest_strategy(db, user_id)
        fresh_enough = previous is not None and (
            datetime.now(timezone.utc) - previous.created_at < timedelta(minutes=REUSE_MINUTES)
        )
        if fresh_enough and (previous.recommendation_json or {}).get("fingerprint") == fingerprint:
            return {**previous.recommendation_json, "reused": True}

    result = runner(db=db, user_id=user_id)
    if result.get("no_holdings") or result.get("error"):
        return result

    result["fingerprint"] = fingerprint
    save_strategy(db, user_id, result)
    prewarm_filings(
        [p["ticker"] for p in result.get("positions") or [] if p.get("ticker")],
        sessionmaker(bind=db.get_bind(), autocommit=False, autoflush=False),
    )
    return result
