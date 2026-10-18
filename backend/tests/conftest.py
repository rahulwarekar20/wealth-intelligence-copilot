import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.config import settings
from app.core.db import get_db
from app.core import db as db_module
from app.models import models  # noqa — registers all models

# Tests run against a DEDICATED database, because every test drops and
# recreates all tables. Never point this at the database the app uses.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://wealth:wealth_dev_password@localhost:5432/wealth_copilot_test",
)

_test_url = make_url(TEST_DATABASE_URL)
_app_url = make_url(settings.DATABASE_URL)
if (_test_url.host, _test_url.port, _test_url.database) == (_app_url.host, _app_url.port, _app_url.database):
    raise RuntimeError(
        "TEST_DATABASE_URL points at the application database. "
        "Tests wipe all tables, so use a separate database."
    )


def _ensure_test_database_exists():
    admin_engine = create_engine(
        _test_url.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": _test_url.database},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{_test_url.database}"'))
    admin_engine.dispose()


_ensure_test_database_exists()

engine = create_engine(_test_url, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

with engine.begin() as conn:
    conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'))


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client():
    # Drop and recreate all tables in the TEST database for a clean run
    db_module.Base.metadata.drop_all(bind=engine)
    db_module.Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_client(client):
    client.post("/auth/signup", json={
        "email": "testuser@example.com",
        "password": "testpass123"
    })
    response = client.post("/auth/login", json={
        "email": "testuser@example.com",
        "password": "testpass123"
    })
    token = response.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture(scope="function")
def db_session(client):
    """A session on the (freshly reset) test database, for calling services directly."""
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
def user_id(auth_client):
    """Id of the user that auth_client is signed in as."""
    return auth_client.get("/auth/me").json()["id"]


@pytest.fixture(autouse=True)
def no_filing_prewarm(monkeypatch):
    """Tests never start the background 10-K pre-loading (it would call SEC EDGAR)."""
    from app.services import strategy_service
    monkeypatch.setattr(strategy_service, "prewarm_filings", lambda tickers, make_session: None)
