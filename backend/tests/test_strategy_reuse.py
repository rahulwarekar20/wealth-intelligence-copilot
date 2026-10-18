"""
Strategy reuse: a recent strategy is returned instead of re-running the AI
when holdings, profile and other assets are unchanged; any change, an old
result, or refresh=true triggers a new run. The strategy agent is mocked.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.agents import portfolio_strategy_agent
from app.models.models import Decision


@pytest.fixture
def runs(monkeypatch):
    """Counts strategy-agent runs; each run returns a minimal valid strategy."""
    count = {"n": 0}

    def fake_strategy(db, user_id):
        count["n"] += 1
        return {"positions": [{"ticker": "AAPL", "action": "hold", "current_price": 100.0}],
                "portfolio_health": {"overall_score": 70}, "priority_actions": [],
                "generated_at": datetime.now(timezone.utc).isoformat()}

    monkeypatch.setattr(portfolio_strategy_agent, "run_portfolio_strategy", fake_strategy)
    return count


def _strategy(client, refresh=False):
    r = client.get("/decisions/portfolio-strategy" + ("?refresh=true" if refresh else ""))
    assert r.status_code == 200, r.text
    return r.json()


def test_unchanged_portfolio_reuses_recent_strategy(auth_client, runs):
    """T114 - A second visit returns the saved strategy without running the AI again"""
    auth_client.post("/portfolio/holdings", json={"ticker": "AAPL", "quantity": 1})
    first = _strategy(auth_client)
    second = _strategy(auth_client)
    assert runs["n"] == 1
    assert second["reused"] is True and "reused" not in first
    assert second["portfolio_health"] == first["portfolio_health"]


def test_refresh_forces_a_new_run(auth_client, runs):
    """T115 - The Refresh button (refresh=true) always runs a new analysis"""
    auth_client.post("/portfolio/holdings", json={"ticker": "AAPL", "quantity": 1})
    _strategy(auth_client)
    _strategy(auth_client, refresh=True)
    assert runs["n"] == 2


@pytest.mark.parametrize("change", ["holding", "profile", "asset"])
def test_changes_invalidate_the_saved_strategy(auth_client, runs, change):
    """T116 - New holdings, a new profile or new assets make the saved strategy stale"""
    auth_client.post("/portfolio/holdings", json={"ticker": "AAPL", "quantity": 1})
    _strategy(auth_client)
    if change == "holding":
        auth_client.post("/portfolio/holdings", json={"ticker": "MSFT", "quantity": 2})
    elif change == "profile":
        auth_client.put("/profile", json={"risk_tolerance": "conservative", "max_position_pct": 20})
    else:
        auth_client.post("/assets", json={"name": "Cash", "asset_class": "cash", "value": 1000})
    _strategy(auth_client)
    assert runs["n"] == 2


def test_old_strategies_are_not_reused(auth_client, runs, db_session, user_id):
    """T117 - A saved strategy older than the reuse window is re-run"""
    auth_client.post("/portfolio/holdings", json={"ticker": "AAPL", "quantity": 1})
    _strategy(auth_client)
    db_session.query(Decision).filter(Decision.user_id == user_id).update(
        {Decision.created_at: datetime.now(timezone.utc) - timedelta(hours=2)})
    db_session.commit()
    _strategy(auth_client)
    assert runs["n"] == 2


def test_failed_runs_are_not_saved_or_reused(auth_client, monkeypatch):
    """T118 - An AI failure returns an error and is never served later as a saved strategy"""
    monkeypatch.setattr(portfolio_strategy_agent, "run_portfolio_strategy",
                        lambda db, user_id: {"error": "AI unavailable", "positions": []})
    auth_client.post("/portfolio/holdings", json={"ticker": "AAPL", "quantity": 1})
    assert auth_client.get("/decisions/portfolio-strategy").status_code == 502
    assert auth_client.get("/decisions/journal").json() == []
