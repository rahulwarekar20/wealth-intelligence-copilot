"""
Alerts: each check (concentration, price drop, filing, earnings), de-duplication,
throttling, read state, isolation, and resilience to data-provider failures.
All market data is mocked — no network.
"""
from datetime import date, timedelta

import pytest

from app.services import alert_service, portfolio_service


@pytest.fixture
def market(monkeypatch):
    """Quiet market by default; tests override individual fields."""
    state = {"price": 100.0, "change": 0.0, "filings": {}, "earnings": []}
    monkeypatch.setattr(portfolio_service, "fetch_current_price", lambda t: state["price"])
    monkeypatch.setattr(alert_service, "fetch_price_trend", lambda t, db: {"daily_change_pct": state["change"]})
    monkeypatch.setattr(alert_service, "get_company_financials", lambda t, db: {"filings": state["filings"]})
    monkeypatch.setattr(alert_service, "_upcoming_earnings", lambda t: state["earnings"])
    alert_service._last_checked.clear()
    return state


def _hold(client, ticker, qty):
    client.post("/portfolio/holdings", json={"ticker": ticker, "quantity": qty})


def _alerts(client):
    alert_service._last_checked.clear()  # bypass the 30-minute throttle between steps
    return client.get("/alerts").json()


def test_no_alerts_for_a_quiet_balanced_portfolio(auth_client, market):
    """T85 - Nothing to report means no alerts"""
    for t in ("AAA", "BBB", "CCC", "DDD", "EEE"):
        _hold(auth_client, t, 1)
    assert _alerts(auth_client) == {"alerts": [], "unread": 0}


def test_concentration_alert_uses_user_limit(auth_client, market):
    """T86 - A position over the user's limit raises an alert; raising the limit stops new ones"""
    _hold(auth_client, "AAA", 2)
    _hold(auth_client, "BBB", 8)  # AAA = 20% (under the 25% limit), BBB = 80%
    body = _alerts(auth_client)
    assert [a["kind"] for a in body["alerts"]] == ["concentration"]
    assert "BBB is 80.0%" in body["alerts"][0]["message"]
    assert "25% limit" in body["alerts"][0]["message"]

    # Re-running with a different limit keeps this week's alert and adds none for AAA (20%)
    auth_client.put("/profile", json={"risk_tolerance": "aggressive", "max_position_pct": 30})
    assert len(_alerts(auth_client)["alerts"]) == 1


def test_price_drop_filing_and_earnings_alerts(auth_client, market):
    """T87 - Big daily drops, recent 10-K/10-Q filings and upcoming earnings are reported"""
    for t in ("AAA", "BBB", "CCC", "DDD", "EEE"):
        _hold(auth_client, t, 1)
    market["change"] = -6.2
    market["filings"] = {"10-Q": {"form": "10-Q", "accession": "0001-25-1", "filing_date": date.today().isoformat()}}
    market["earnings"] = [(date.today() + timedelta(days=5)).isoformat()]
    kinds = [a["kind"] for a in _alerts(auth_client)["alerts"]]
    assert kinds.count("price_drop") == 5
    assert kinds.count("filing") == 5
    assert kinds.count("earnings") == 5


def test_old_filings_and_small_moves_are_ignored(auth_client, market):
    """T88 - A 3% dip or a filing from last quarter is not news"""
    _hold(auth_client, "AAA", 1)
    _hold(auth_client, "BBB", 1)
    _hold(auth_client, "CCC", 1)
    _hold(auth_client, "DDD", 1)
    _hold(auth_client, "EEE", 1)
    market["change"] = -3.0
    old = (date.today() - timedelta(days=60)).isoformat()
    market["filings"] = {"10-K": {"form": "10-K", "accession": "0001-24-9", "filing_date": old}}
    assert _alerts(auth_client)["alerts"] == []


def test_alerts_are_not_duplicated(auth_client, market):
    """T89 - Running the checks again does not repeat the same alert"""
    _hold(auth_client, "AAA", 1)
    first = _alerts(auth_client)
    second = _alerts(auth_client)
    assert len(first["alerts"]) == len(second["alerts"]) == 1  # 100% in one ticker


def test_checks_are_throttled(auth_client, market, monkeypatch):
    """T90 - Checks run at most once per interval; refresh=false never runs them"""
    calls = []
    monkeypatch.setattr(alert_service, "get_holdings", lambda db, uid: calls.append(1) or [])
    auth_client.get("/alerts")
    auth_client.get("/alerts")
    auth_client.get("/alerts?refresh=false")
    assert len(calls) == 1


def test_mark_read(auth_client, market):
    """T91 - Alerts can be marked read one at a time or all at once"""
    _hold(auth_client, "AAA", 1)
    market["change"] = -9
    body = _alerts(auth_client)
    assert body["unread"] == 2  # concentration + price drop
    auth_client.post(f"/alerts/{body['alerts'][0]['id']}/read")
    assert auth_client.get("/alerts?refresh=false").json()["unread"] == 1
    auth_client.post("/alerts/read")
    assert auth_client.get("/alerts?refresh=false").json()["unread"] == 0


def test_provider_failures_do_not_break_alerts(auth_client, market, monkeypatch):
    """T92 - If market data providers fail, the other checks still run"""
    def boom(*a, **k):
        raise RuntimeError("provider down")
    monkeypatch.setattr(alert_service, "fetch_price_trend", boom)
    monkeypatch.setattr(alert_service, "get_company_financials", boom)
    monkeypatch.setattr(alert_service, "_upcoming_earnings", boom)
    _hold(auth_client, "AAA", 1)
    r = auth_client.get("/alerts")
    assert r.status_code == 200
    assert [a["kind"] for a in r.json()["alerts"]] == ["concentration"]


def test_alerts_are_private(client, market):
    """T93 - Users only see and can only mark their own alerts"""
    def login(email):
        client.post("/auth/signup", json={"email": email, "password": "testpass123"})
        token = client.post("/auth/login", json={"email": email, "password": "testpass123"}).json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    alice, bob = login("alice@example.com"), login("bob@example.com")
    client.post("/portfolio/holdings", json={"ticker": "AAA", "quantity": 1}, headers=alice)
    alert = client.get("/alerts", headers=alice).json()["alerts"][0]
    assert client.get("/alerts", headers=bob).json()["alerts"] == []
    client.post(f"/alerts/{alert['id']}/read", headers=bob)
    assert client.get("/alerts?refresh=false", headers=alice).json()["unread"] == 1
