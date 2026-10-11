import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.db import get_db
from app.core import db as db_module
from app.models import models  # noqa — registers all models

# Use the real Postgres database running in Docker
# Tests run in a separate schema to avoid polluting real data
TEST_DATABASE_URL = (
    "postgresql+psycopg2://wealth:wealth_dev_password"
    "@localhost:5432/wealth_copilot"
)

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client():
    # Drop and recreate all tables for a clean test run
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