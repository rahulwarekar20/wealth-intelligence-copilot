def test_no_token_returns_403(client):
    """T17 - All protected routes return 403 without token"""
    routes = [
        ("GET", "/auth/me"),
        ("GET", "/portfolio/holdings"),
        ("GET", "/portfolio/summary"),
        ("GET", "/decisions/journal"),
    ]
    for method, path in routes:
        r = client.request(method, path)
        assert r.status_code in [401, 403], f"{method} {path} should be protected"


def test_malformed_token_rejected(client):
    """T18 - Malformed JWT is rejected"""
    r = client.get("/auth/me", headers={"Authorization": "Bearer not.a.valid.jwt"})
    assert r.status_code == 401


def test_expired_token_rejected(client):
    """T19 - Expired token is rejected"""
    from app.core.security import create_access_token
    from datetime import timedelta
    import time
    token = create_access_token("fake-user-id", expires_minutes=-1)
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_sql_injection_in_ticker(auth_client):
    """T20 - SQL injection attempt in ticker field is safely handled"""
    r = auth_client.post("/portfolio/holdings", json={
        "ticker": "'; DROP TABLE users; --",
        "quantity": 1,
        "cost_basis": 100.0,
        "account_type": "taxable"
    })
    # Should either succeed (safely stored as string) or be rejected
    assert r.status_code in [200, 422]
    # Verify users table still exists
    me = auth_client.get("/auth/me")
    assert me.status_code == 200


def test_empty_ticker_rejected(auth_client):
    """T21 - Empty ticker is rejected"""
    r = auth_client.post("/portfolio/holdings", json={
        "ticker": "",
        "quantity": 10,
        "cost_basis": 150.0,
        "account_type": "taxable"
    })
    assert r.status_code == 422