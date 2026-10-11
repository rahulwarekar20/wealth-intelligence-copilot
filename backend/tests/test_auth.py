def test_health_check(client):
    """T01 - Health endpoint returns 200"""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_signup_success(client):
    """T02 - Valid signup returns access token"""
    r = client.post("/auth/signup", json={
        "email": "new@example.com",
        "password": "password123"
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_signup_duplicate_email(client):
    """T03 - Duplicate email returns 409"""
    client.post("/auth/signup", json={
        "email": "dup@example.com",
        "password": "password123"
    })
    r = client.post("/auth/signup", json={
        "email": "dup@example.com",
        "password": "password123"
    })
    assert r.status_code == 409


def test_signup_short_password(client):
    """T04 - Password under 8 chars is rejected"""
    r = client.post("/auth/signup", json={
        "email": "short@example.com",
        "password": "abc"
    })
    assert r.status_code == 422


def test_login_success(client):
    """T05 - Valid login returns token"""
    client.post("/auth/signup", json={
        "email": "login@example.com",
        "password": "password123"
    })
    r = client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "password123"
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client):
    """T06 - Wrong password returns 401"""
    client.post("/auth/signup", json={
        "email": "wrong@example.com",
        "password": "password123"
    })
    r = client.post("/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpassword"
    })
    assert r.status_code == 401


def test_protected_route_without_token(client):
    """T07 - Protected route rejects missing token"""
    r = client.get("/auth/me")
    assert r.status_code == 403


def test_protected_route_invalid_token(client):
    """T08 - Protected route rejects invalid token"""
    r = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert r.status_code == 401


def test_me_returns_user(auth_client):
    """T09 - /auth/me returns correct user profile"""
    r = auth_client.get("/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "testuser@example.com"
    assert "id" in r.json()