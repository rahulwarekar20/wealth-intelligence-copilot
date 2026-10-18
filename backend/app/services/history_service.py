"""
History built from the decision journal (the `decisions` table):

- strategy_changes(): what changed between two portfolio strategies
  (actions per ticker, health score), shown as "since your last analysis".
- track_record(): every call the copilot made, with the price then and now,
  so users can judge how its advice has worked out.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.models import Decision
from app.services.portfolio_service import fetch_current_price

STRATEGY_TICKER = "PORTFOLIO"     # how portfolio-wide strategies are journaled
TRACK_RECORD_DAYS = 180           # how far back the track record looks
TRACK_RECORD_LIMIT = 40           # most calls returned
TOO_EARLY_DAYS = 3                # calls younger than this get no verdict yet
FLAT_BAND_PCT = 1.0               # moves smaller than this count as flat


def latest_strategy(db: Session, user_id: str) -> Optional[Decision]:
    """The most recently journaled portfolio strategy, or None."""
    return (
        db.query(Decision)
        .filter(Decision.user_id == user_id, Decision.ticker == STRATEGY_TICKER)
        .order_by(Decision.created_at.desc())
        .first()
    )


def strategy_changes(previous: Optional[dict], current: dict, previous_at: Optional[datetime] = None) -> Optional[dict]:
    """
    Differences between two strategy results, or None when there is no earlier
    strategy to compare with.

    Returns {"previous_at", "health_before", "health_after", "changes", "added", "removed"},
    where each change is {"ticker", "before", "after"} for a ticker whose action changed.
    """
    if not previous:
        return None

    def actions(result: dict) -> dict:
        """Ticker -> lower-cased action for one strategy result."""
        return {p.get("ticker"): (p.get("action") or "").lower() for p in result.get("positions") or [] if p.get("ticker")}

    before, after = actions(previous), actions(current)
    return {
        "previous_at": previous_at.isoformat() if previous_at else None,
        "health_before": (previous.get("portfolio_health") or {}).get("overall_score"),
        "health_after": (current.get("portfolio_health") or {}).get("overall_score"),
        "changes": [
            {"ticker": t, "before": before[t], "after": after[t]}
            for t in sorted(after) if t in before and before[t] != after[t]
        ],
        "added": sorted(set(after) - set(before)),
        "removed": sorted(set(before) - set(after)),
    }


def describe_changes(changes: dict) -> Optional[str]:
    """One-sentence summary of strategy changes for an alert, or None if nothing meaningful changed."""
    parts = [f"{c['ticker']} {c['before'].upper()} → {c['after'].upper()}" for c in changes.get("changes", [])]
    before, after = changes.get("health_before"), changes.get("health_after")
    if before is not None and after is not None and abs(after - before) >= 5:
        parts.append(f"health score {before} → {after}")
    if not parts:
        return None
    return "Your portfolio strategy changed: " + "; ".join(parts) + "."


def _calls_from(decision: Decision) -> list[dict]:
    """The individual Buy/Hold/Sell calls recorded in one journal entry, with the price at the time."""
    rec = decision.recommendation_json or {}
    made_at = decision.created_at
    if decision.ticker == STRATEGY_TICKER:
        return [
            {"ticker": p.get("ticker"), "action": (p.get("action") or "").lower(), "price_then": p.get("current_price"),
             "made_at": made_at, "source": "Portfolio strategy"}
            for p in rec.get("positions") or [] if p.get("ticker") and p.get("current_price")
        ]
    price = (rec.get("metrics") or {}).get("price")
    if not decision.ticker or not price or not rec.get("action"):
        return []
    return [{"ticker": decision.ticker, "action": rec["action"].lower(), "price_then": price,
             "made_at": made_at, "source": decision.query_text}]


def judge(action: str, change_pct: float, age_days: float) -> str:
    """
    How a call has played out so far: "on_track", "against", "flat", "too_early",
    or "n/a" for calls with no direction (hold, rebalance).
    """
    if age_days < TOO_EARLY_DAYS:
        return "too_early"
    if action in ("buy", "buy more"):
        direction = 1
    elif action in ("sell", "trim"):
        direction = -1
    else:
        return "n/a"
    if abs(change_pct) < FLAT_BAND_PCT:
        return "flat"
    return "on_track" if change_pct * direction > 0 else "against"


def track_record(db: Session, user_id: str) -> list[dict]:
    """
    Every distinct call in the last TRACK_RECORD_DAYS, newest first.

    The dashboard re-runs the strategy often, so calls are condensed in two steps:
      1. only each ticker's last call of each day counts (intraday re-runs
         that flip back and forth are noise, not advice anyone acted on);
      2. a call is listed only when it differs from that ticker's previous
         day's call, dated from the day it was first made.
    """
    since = datetime.now(timezone.utc) - timedelta(days=TRACK_RECORD_DAYS)
    decisions = (
        db.query(Decision)
        .filter(Decision.user_id == user_id, Decision.created_at >= since)
        .order_by(Decision.created_at.asc())
        .all()
    )

    # Step 1: the last call per (ticker, day); decisions are oldest first, so later ones win
    daily: dict = {}
    for decision in decisions:
        for call in _calls_from(decision):
            daily[(call["ticker"], call["made_at"].date())] = call

    # Step 2: keep only changes from the ticker's previous day
    calls, last_action = [], {}
    for call in sorted(daily.values(), key=lambda c: c["made_at"]):
        if last_action.get(call["ticker"]) != call["action"]:
            calls.append(call)
            last_action[call["ticker"]] = call["action"]
    calls = calls[-TRACK_RECORD_LIMIT:]

    tickers = sorted({c["ticker"] for c in calls})
    with ThreadPoolExecutor(max_workers=8) as pool:
        prices_now = dict(zip(tickers, pool.map(fetch_current_price, tickers)))

    now = datetime.now(timezone.utc)
    record = []
    for c in reversed(calls):
        price_now = prices_now.get(c["ticker"])
        change = round((price_now - c["price_then"]) / c["price_then"] * 100, 2) if price_now else None
        age_days = (now - c["made_at"]).total_seconds() / 86400
        record.append({
            "ticker": c["ticker"],
            "action": c["action"],
            "source": c["source"],
            "made_at": c["made_at"].isoformat(),
            "price_then": round(float(c["price_then"]), 2),
            "price_now": round(price_now, 2) if price_now else None,
            "change_pct": change,
            "verdict": judge(c["action"], change, age_days) if change is not None else "n/a",
        })
    return record
