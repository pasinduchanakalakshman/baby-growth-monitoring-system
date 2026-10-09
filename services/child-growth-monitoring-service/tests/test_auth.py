import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.models import Base

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def test_register_mother():
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Test Mother", "email": "test@example.com", "password": "securepassword"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "password_hash" not in data
    assert "id" in data

def test_duplicate_email_rejected():
    payload = {"name": "Test Mother", "email": "test@example.com", "password": "securepassword"}
    client.post("/api/v1/auth/register", json=payload)
    
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"

def test_login_success():
    client.post(
        "/api/v1/auth/register",
        json={"name": "Test Mother", "email": "test2@example.com", "password": "securepassword"}
    )
    
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test2@example.com", "password": "securepassword"}
    )
    assert response.status_code == 200
    assert "access_token" in response.cookies
    data = response.json()
    assert data["email"] == "test2@example.com"
    assert "password_hash" not in data

def test_login_wrong_password():
    client.post(
        "/api/v1/auth/register",
        json={"name": "Test Mother", "email": "test3@example.com", "password": "securepassword"}
    )
    
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test3@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_login_unknown_email():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@example.com", "password": "securepassword"}
    )
    assert response.status_code == 401

def test_auth_me():
    client.post(
        "/api/v1/auth/register",
        json={"name": "Test Mother", "email": "test4@example.com", "password": "securepassword"}
    )
    
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test4@example.com", "password": "securepassword"}
    )
    cookies = login_resp.cookies
    
    response = client.get("/api/v1/auth/me", cookies=cookies)
    assert response.status_code == 200
    assert response.json()["email"] == "test4@example.com"

def test_auth_me_unauthenticated():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

def test_logout():
    client.post(
        "/api/v1/auth/register",
        json={"name": "Test Mother", "email": "test5@example.com", "password": "securepassword"}
    )
    
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test5@example.com", "password": "securepassword"}
    )
    cookies = login_resp.cookies
    
    # Verify auth works
    assert client.get("/api/v1/auth/me", cookies=cookies).status_code == 200
    
    # Logout
    logout_resp = client.post("/api/v1/auth/logout", cookies=cookies)
    assert logout_resp.status_code == 200
    
    # The response should have deleted the cookie (by setting max-age=0 or similar)
    # Testing client doesn't fully simulate browser cookie deletion sometimes,
    # but we can check if the response headers have Set-Cookie
    assert "set-cookie" in logout_resp.headers
