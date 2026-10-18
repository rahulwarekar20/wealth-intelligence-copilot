"""
Strategy changes ("since your last analysis") and the track record of past
calls. Prices are mocked — no network.
"""
from datetime import datetime, timedelta, timezone

from app.models.models import Decision
from app.services import history_service
from app.services.ask_service import save_strategy


def _strategy(actions: dict, score=70, price=100.0):
    return {
        "positions": [{"ticker": t, "action": a, "current_price": price} for t, a in actions.items()],
        "portfolio_health": {"overall_score": score},
    }


def test_strategy_changes_lists_only_what_changed():
    """T94 - Changed actions, added/removed tickers and the health scores are reported"""
    before = _strategy({"AAPL": "hold", "MSFT": "hold", "JPM": "buy"}, score=72)
    after = _strategy({"AAPL": "hold", "MSFT": "trim", "SPY": "hold"}, score=55)
    changes = history_service.strategy_changes(before, after)
    assert changes["changes"] == [{"ticker": "MSFT", "before": "hold", "after": "trim"}]
    assert changes["added"] == ["SPY"]
    assert changes["removed"] == ["JPM"]
    assert (changes["health_before"], changes["health_after"]) == (72, 55)
    assert history_service.describe_changes(changes) == "Your portfolio strategy changed: MSFT HOLD → TRIM; health score 72 → 55."


def test_no_previous_strategy_means_no_changes():
    """T95 - The first strategy has nothing to compare with"""
    assert history_service.strategy_changes(None, _strategy({"AAPL": "hold"})) is None


def test_small_health_moves_alone_are_not_news():
    """T96 - A 2-point score wobble with identical calls produces no alert text"""
    changes = history_service.strategy_changes(_strategy({"AAPL": "hold"}, 70), _strategy({"AAPL": "hold"}, 72))
    assert history_service.describe_changes(changes) is None


def test_save_strategy_attaches_changes_and_alerts(auth_client, user_id, db_session):
    """T97 - Saving a strategy compares it with the last one and raises an alert when calls change"""
    first = _strategy({"AAPL": "hold"})
    save_strategy(db_session, user_id, first)
    assert first["changes"] is None

    second = {**_strategy({"AAPL": "sell"}), "generated_at": "2026-10-18T12:00:00+00:00"}
    save_strategy(db_session, user_id, second)
    assert second["changes"]["changes"] == [{"ticker": "AAPL", "before": "hold", "after": "sell"}]
    alerts = auth_client.get("/alerts?refresh=false").json()["alerts"]
    assert [a["kind"] for a in alerts] == ["strategy_change"]


def test_judge_verdicts():
    """T98 - Buy calls are on track when the price rose, sell/trim when it fell; hold has no direction"""
    assert history_service.judge("buy", 5, 10) == "on_track"
    assert history_service.judge("buy", -5, 10) == "against"
    assert history_service.judge("trim", -5, 10) == "on_track"
    assert history_service.judge("sell", 4, 10) == "against"
    assert history_service.judge("buy", 0.5, 10) == "flat"
    assert history_service.judge("hold", 20, 10) == "n/a"
    assert history_service.judge("buy", 20, 1) == "too_early"


def _journal(db, user_id, ticker, rec, days_ago):
    db.add(Decision(user_id=user_id, ticker=ticker, query_text="q", recommendation_json=rec,
                    created_at=datetime.now(timezone.utc) - timedelta(days=days_ago)))
    db.commit()


def test_track_record_collapses_repeated_calls(auth_client, user_id, db_session, monkeypatch):
    """T99 - Repeated identical calls are listed once, from when first made, with price then and now"""
    monkeypatch.setattr(history_service, "fetch_current_price", lambda t: 110.0)
    _journal(db_session, user_id, "PORTFOLIO", _strategy({"MSFT": "trim"}, price=100.0), days_ago=20)
    _journal(db_session, user_id, "PORTFOLIO", _strategy({"MSFT": "trim"}, price=105.0), days_ago=10)
    _journal(db_session, user_id, "PORTFOLIO", _strategy({"MSFT": "buy"}, price=105.0), days_ago=5)
    _journal(db_session, user_id, "AAPL", {"action": "buy", "metrics": {"price": 100.0}}, days_ago=8)

    calls = auth_client.get("/decisions/track-record").json()["calls"]
    summary = [(c["ticker"], c["action"], c["price_then"], c["verdict"]) for c in calls]
    assert summary == [
        ("MSFT", "buy", 105.0, "on_track"),     # newest first
        ("AAPL", "buy", 100.0, "on_track"),
        ("MSFT", "trim", 100.0, "against"),     # first trim call, price rose 10%
    ]
    assert calls[-1]["change_pct"] == 10.0


def test_track_record_handles_missing_prices(auth_client, user_id, db_session, monkeypatch):
    """T100 - A ticker with no live price still appears, without a verdict"""
    monkeypatch.setattr(history_service, "fetch_current_price", lambda t: None)
    _journal(db_session, user_id, "XYZ", {"action": "sell", "metrics": {"price": 50.0}}, days_ago=30)
    call = auth_client.get("/decisions/track-record").json()["calls"][0]
    assert call["price_now"] is None and call["verdict"] == "n/a"


def test_track_record_keeps_only_each_days_last_call(auth_client, user_id, db_session, monkeypatch):
    """T113 - Intraday flip-flops collapse to the day's final call"""
    monkeypatch.setattr(history_service, "fetch_current_price", lambda t: 100.0)
    now = datetime.now(timezone.utc).replace(hour=12)
    for minutes, action in [(0, "trim"), (10, "hold"), (20, "sell"), (30, "hold")]:
        db_session.add(Decision(user_id=user_id, ticker="PORTFOLIO", query_text="q",
                                recommendation_json=_strategy({"GOOGL": action}),
                                created_at=now - timedelta(days=5) + timedelta(minutes=minutes)))
    db_session.commit()
    calls = auth_client.get("/decisions/track-record").json()["calls"]
    assert [(c["ticker"], c["action"]) for c in calls] == [("GOOGL", "hold")]
