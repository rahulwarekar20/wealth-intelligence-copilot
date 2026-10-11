def test_add_holding(auth_client):
    """T10 - Add a holding returns 200 with correct data"""
    r = auth_client.post("/portfolio/holdings", json={
        "ticker": "AAPL",
        "quantity": 10,
        "cost_basis": 150.0,
        "account_type": "taxable"
    })
    assert r.status_code == 200
    assert r.json()["ticker"] == "AAPL"
    assert r.json()["quantity"] == 10


def test_holding_ticker_uppercased(auth_client):
    """T11 - Ticker is stored uppercase regardless of input"""
    r = auth_client.post("/portfolio/holdings", json={
        "ticker": "msft",
        "quantity": 5,
        "cost_basis": 280.0,
        "account_type": "taxable"
    })
    assert r.status_code == 200
    assert r.json()["ticker"] == "MSFT"


def test_list_holdings(auth_client):
    """T12 - List holdings returns user's holdings only"""
    auth_client.post("/portfolio/holdings", json={
        "ticker": "GOOGL", "quantity": 3,
        "cost_basis": 120.0, "account_type": "taxable"
    })
    r = auth_client.get("/portfolio/holdings")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_delete_holding(auth_client):
    """T13 - Delete a holding removes it"""
    add = auth_client.post("/portfolio/holdings", json={
        "ticker": "SPY", "quantity": 10,
        "cost_basis": 400.0, "account_type": "taxable"
    })
    holding_id = add.json()["id"]
    r = auth_client.delete(f"/portfolio/holdings/{holding_id}")
    assert r.status_code == 200


def test_delete_nonexistent_holding(auth_client):
    """T14 - Delete non-existent holding returns 404"""
    r = auth_client.delete("/portfolio/holdings/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_cross_user_isolation(client):
    """T15 - User A cannot see User B's holdings (data isolation NFR-03)"""
    # Create user A and add a holding
    client.post("/auth/signup", json={"email": "usera@example.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "usera@example.com", "password": "password123"})
    token_a = r.json()["access_token"]
    client.post("/portfolio/holdings",
        json={"ticker": "AAPL", "quantity": 10, "cost_basis": 150.0, "account_type": "taxable"},
        headers={"Authorization": f"Bearer {token_a}"}
    )

    # Create user B and check they see no holdings
    client.post("/auth/signup", json={"email": "userb@example.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "userb@example.com", "password": "password123"})
    token_b = r.json()["access_token"]
    r = client.get("/portfolio/holdings", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 200
    assert r.json() == []


def test_add_holding_negative_quantity(auth_client):
    """T16 - Negative quantity is rejected"""
    r = auth_client.post("/portfolio/holdings", json={
        "ticker": "AAPL",
        "quantity": -5,
        "cost_basis": 150.0,
        "account_type": "taxable"
    })
    assert r.status_code == 422