"""
Performance guards for the dashboard's portfolio summary.

The summary must not call Alpha Vantage unless correlation is asked for, and
historical prices must be cached so repeat requests don't hit the API again.
"""
from types import SimpleNamespace

from app.services import portfolio_service


def _holding(ticker: str):
    return SimpleNamespace(id=ticker, ticker=ticker, quantity=1, cost_basis=None, account_type="taxable")


def test_summary_skips_correlation_by_default(monkeypatch):
    """T72 - Dashboard summary does not fetch historical prices"""
    calls = []
    monkeypatch.setattr(portfolio_service, "get_holdings", lambda db, uid: [_holding("AAA"), _holding("BBB")])
    monkeypatch.setattr(portfolio_service, "fetch_current_price", lambda t: 10.0)
    monkeypatch.setattr(portfolio_service, "fetch_historical_prices", lambda t, days=30: calls.append(t) or [])
    monkeypatch.setattr(portfolio_service, "get_profile", lambda db, uid: {"limits": {"high": 25.0, "medium": 15.0}})
    monkeypatch.setattr(portfolio_service, "assets_by_class", lambda db, uid: {})

    summary = portfolio_service.compute_portfolio_summary(None, "user")

    assert calls == []
    assert summary["correlation"] == {}
    assert summary["total_value"] == 20.0


def test_historical_prices_are_cached(monkeypatch):
    """T73 - Historical prices are downloaded once, then served from cache"""
    downloads = []
    monkeypatch.setattr(portfolio_service, "_history_cache", {})
    monkeypatch.setattr(
        portfolio_service, "_download_historical_prices",
        lambda t, days: downloads.append(t) or [1.0, 2.0, 3.0],
    )

    first = portfolio_service.fetch_historical_prices("AAA")
    second = portfolio_service.fetch_historical_prices("AAA")

    assert first == second == [1.0, 2.0, 3.0]
    assert downloads == ["AAA"]
