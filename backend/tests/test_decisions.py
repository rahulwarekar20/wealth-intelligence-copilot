def test_decisions_journal_empty_for_new_user(auth_client):
    """T28 - New user has empty decision journal"""
    r = auth_client.get("/decisions/journal")
    assert r.status_code == 200
    assert r.json() == []


def test_decisions_journal_requires_auth(client):
    """T29 - Decision journal is protected"""
    r = client.get("/decisions/journal")
    assert r.status_code in [401, 403]


def test_evidence_endpoint_requires_auth(client):
    """T30 - Evidence endpoint is protected"""
    r = client.get("/evidence/AAPL")
    assert r.status_code in [401, 403]


def test_portfolio_summary_requires_auth(client):
    """T31 - Portfolio summary is protected"""
    r = client.get("/portfolio/summary")
    assert r.status_code in [401, 403]


def test_portfolio_summary_empty_portfolio(auth_client):
    """T32 - Portfolio summary returns zero for empty portfolio"""
    r = auth_client.get("/portfolio/summary")
    assert r.status_code == 200
    data = r.json()
    assert data["total_value"] == 0.0
    assert data["holdings"] == []


def test_multiple_holdings_listed(auth_client):
    """T33 - Multiple holdings are all returned"""
    for ticker in ["AAPL", "GOOGL", "SPY"]:
        auth_client.post("/portfolio/holdings", json={
            "ticker": ticker,
            "quantity": 10,
            "cost_basis": 100.0,
            "account_type": "taxable"
        })
    r = auth_client.get("/portfolio/holdings")
    assert r.status_code == 200
    assert len(r.json()) == 3


def test_holding_quantity_must_be_positive(auth_client):
    """T34 - Zero quantity is rejected"""
    r = auth_client.post("/portfolio/holdings", json={
        "ticker": "AAPL",
        "quantity": 0,
        "cost_basis": 150.0,
        "account_type": "taxable"
    })
    assert r.status_code == 422


def test_ticker_max_length(auth_client):
    """T35 - Ticker over 10 characters is rejected"""
    r = auth_client.post("/portfolio/holdings", json={
        "ticker": "TOOLONGTICKERVALUE",
        "quantity": 10,
        "cost_basis": 150.0,
        "account_type": "taxable"
    })
    assert r.status_code == 422


def test_document_upload_endpoint_exists(auth_client):
    """T36 - Document upload endpoint is reachable"""
    r = auth_client.get("/documents/")
    assert r.status_code == 200


def test_health_returns_version(client):
    """T37 - Health check returns version field"""
    r = client.get("/health")
    assert r.status_code == 200
    assert "version" in r.json()


def test_signup_invalid_email(client):
    """T38 - Invalid email format is rejected"""
    r = client.post("/auth/signup", json={
        "email": "notanemail",
        "password": "password123"
    })
    assert r.status_code == 422


def test_login_nonexistent_user(client):
    """T39 - Login with non-existent email returns 401"""
    r = client.post("/auth/login", json={
        "email": "nobody@example.com",
        "password": "password123"
    })
    assert r.status_code == 401


def test_delete_other_users_holding_fails(client):
    """T40 - User cannot delete another user's holding"""
    # User A adds a holding
    client.post("/auth/signup", json={"email": "owner@example.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "owner@example.com", "password": "password123"})
    token_a = r.json()["access_token"]
    add = client.post("/portfolio/holdings",
        json={"ticker": "AAPL", "quantity": 10, "cost_basis": 150.0, "account_type": "taxable"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    holding_id = add.json()["id"]

    # User B tries to delete it
    client.post("/auth/signup", json={"email": "attacker@example.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "attacker@example.com", "password": "password123"})
    token_b = r.json()["access_token"]
    r = client.delete(f"/portfolio/holdings/{holding_id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    # Should return 404 — user B cannot see user A's holdings
    assert r.status_code == 404