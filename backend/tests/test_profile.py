"""
Investor profile and other assets: defaults, saving, validation, per-user
isolation, and how they feed the portfolio summary.
"""
from app.services import portfolio_service, profile_service


def _price(monkeypatch, price=100.0):
    """Every ticker is priced at `price` (no network)."""
    monkeypatch.setattr(portfolio_service, "fetch_current_price", lambda t: price)


def test_profile_defaults_when_never_saved(auth_client):
    """T76 - A new user gets moderate risk and a 25% limit, marked as not set"""
    r = auth_client.get("/profile")
    assert r.status_code == 200
    body = r.json()
    assert body["risk_tolerance"] == "moderate"
    assert body["max_position_pct"] == 25
    assert body["limits"] == {"high": 25, "medium": 15}
    assert body["is_set"] is False


def test_profile_save_and_derived_limits(auth_client):
    """T77 - Saving the profile changes the concentration limits used everywhere"""
    r = auth_client.put("/profile", json={"risk_tolerance": "conservative", "horizon_years": 10, "max_position_pct": 20})
    assert r.status_code == 200
    assert r.json()["limits"] == {"high": 20, "medium": 12}
    again = auth_client.get("/profile").json()
    assert again["risk_tolerance"] == "conservative"
    assert again["horizon_years"] == 10
    assert again["is_set"] is True


def test_profile_validation(auth_client):
    """T78 - Unknown risk levels and unrealistic limits are rejected"""
    assert auth_client.put("/profile", json={"risk_tolerance": "yolo", "max_position_pct": 25}).status_code == 422
    assert auth_client.put("/profile", json={"risk_tolerance": "moderate", "max_position_pct": 2}).status_code == 422
    assert auth_client.put("/profile", json={"risk_tolerance": "moderate", "max_position_pct": 25, "horizon_years": -1}).status_code == 422


def test_assets_crud(auth_client):
    """T79 - Other assets can be added, listed with a total, and deleted"""
    a = auth_client.post("/assets", json={"name": "Emergency fund", "asset_class": "cash", "value": 20000}).json()
    auth_client.post("/assets", json={"name": "Flat", "asset_class": "property", "value": 300000})
    listing = auth_client.get("/assets").json()
    assert listing["total"] == 320000
    assert [x["name"] for x in listing["assets"]] == ["Flat", "Emergency fund"]  # largest first
    assert auth_client.delete(f"/assets/{a['id']}").status_code == 200
    assert auth_client.get("/assets").json()["total"] == 300000


def test_asset_validation(auth_client):
    """T80 - Asset class must be known and value non-negative"""
    assert auth_client.post("/assets", json={"name": "X", "asset_class": "crypto", "value": 1}).status_code == 422
    assert auth_client.post("/assets", json={"name": "X", "asset_class": "cash", "value": -5}).status_code == 422
    assert auth_client.delete("/assets/not-a-uuid").status_code == 404


def test_assets_are_private(client):
    """T81 - One user cannot see or delete another user's assets"""
    def login(email):
        client.post("/auth/signup", json={"email": email, "password": "testpass123"})
        token = client.post("/auth/login", json={"email": email, "password": "testpass123"}).json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    alice, bob = login("alice@example.com"), login("bob@example.com")
    asset = client.post("/assets", json={"name": "Savings", "asset_class": "cash", "value": 5000}, headers=alice).json()
    assert client.get("/assets", headers=bob).json()["assets"] == []
    assert client.delete(f"/assets/{asset['id']}", headers=bob).status_code == 404


def test_summary_includes_net_worth_and_user_limits(auth_client, monkeypatch):
    """T82 - The portfolio summary adds other assets to net worth and returns the user's limits"""
    _price(monkeypatch)
    auth_client.post("/portfolio/holdings", json={"ticker": "AAPL", "quantity": 10, "cost_basis": 50})
    auth_client.post("/assets", json={"name": "Cash", "asset_class": "cash", "value": 4000})
    auth_client.put("/profile", json={"risk_tolerance": "aggressive", "max_position_pct": 40})
    summary = auth_client.get("/portfolio/summary").json()
    assert summary["total_value"] == 1000
    assert summary["other_assets_total"] == 4000
    assert summary["net_worth"] == 5000
    assert summary["limits"]["high"] == 40
    assert summary["prices_as_of"] is None  # price lookup was mocked, so nothing was cached


def test_concentration_flag_uses_limits():
    """T83 - HIGH / MEDIUM / LOW follow the user's own thresholds"""
    limits = profile_service.concentration_limits(20)
    assert profile_service.concentration_flag(21, limits) == "HIGH"
    assert profile_service.concentration_flag(13, limits) == "MEDIUM"
    assert profile_service.concentration_flag(12, limits) == "LOW"
    assert profile_service.concentration_flag(None, limits) == "LOW"


def test_portfolio_agent_uses_profile_limit(auth_client, user_id, db_session, monkeypatch):
    """T84 - The stock pipeline's portfolio agent judges concentration against the user's limit"""
    from app.agents.portfolio_agent import analyze_portfolio_impact

    _price(monkeypatch)
    auth_client.post("/portfolio/holdings", json={"ticker": "AAPL", "quantity": 3})
    auth_client.post("/portfolio/holdings", json={"ticker": "MSFT", "quantity": 7})  # AAPL = 30%
    assert analyze_portfolio_impact("AAPL", "buy", db_session, user_id)["concentration_flag"] == "HIGH"

    auth_client.put("/profile", json={"risk_tolerance": "aggressive", "max_position_pct": 40})  # medium from 24%
    result = analyze_portfolio_impact("AAPL", "buy", db_session, user_id)
    assert result["concentration_flag"] == "MEDIUM"
    assert "aggressive" in result["investor_profile"]
