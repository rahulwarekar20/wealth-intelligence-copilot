"""
Sliding sessions: a token past half its lifetime is renewed on any
authenticated request (X-Refreshed-Token), so active users are never signed
out mid-session; expired tokens are still rejected.
"""
from app.core.config import settings
from app.core.security import REFRESH_HEADER, create_access_token


def _user_id(auth_client):
    return auth_client.get("/auth/me").json()["id"]


def test_fresh_token_is_not_renewed(auth_client):
    """T119 - A newly issued token gets no renewal header"""
    r = auth_client.get("/auth/me")
    assert r.status_code == 200
    assert REFRESH_HEADER not in r.headers


def test_token_past_half_life_is_renewed(auth_client):
    """T120 - With under half its lifetime left, the response carries a fresh, working token"""
    uid = _user_id(auth_client)
    ageing = create_access_token(uid, expires_minutes=settings.JWT_EXPIRE_MINUTES // 2 - 1)
    r = auth_client.get("/portfolio/holdings", headers={"Authorization": f"Bearer {ageing}"})
    assert r.status_code == 200
    renewed = r.headers[REFRESH_HEADER]
    assert renewed != ageing
    again = auth_client.get("/auth/me", headers={"Authorization": f"Bearer {renewed}"})
    assert again.status_code == 200 and REFRESH_HEADER not in again.headers


def test_expired_token_is_rejected(auth_client):
    """T121 - An expired token is refused (and not renewed)"""
    uid = _user_id(auth_client)
    expired = create_access_token(uid, expires_minutes=-1)
    r = auth_client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401
    assert REFRESH_HEADER not in r.headers


def test_renewal_header_is_readable_by_the_browser(client):
    """T122 - CORS exposes the renewal header to the frontend"""
    r = client.options("/auth/me", headers={"Origin": settings.cors_origins[0],
                                            "Access-Control-Request-Method": "GET"})
    assert r.status_code == 200
    r = client.get("/health", headers={"Origin": settings.cors_origins[0]})
    assert "x-refreshed-token" in r.headers.get("access-control-expose-headers", "").lower()
