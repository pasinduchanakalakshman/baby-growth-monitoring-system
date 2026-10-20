import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from httpx import Response
import httpx

from app.main import app

client = TestClient(app)

@patch("httpx.AsyncClient.send")
def test_gateway_health(mock_send):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@patch("httpx.AsyncClient.send")
def test_gateway_proxy_auth(mock_send):
    mock_send.return_value = Response(201, json={"id": 1, "email": "test@example.com"})
    
    response = client.post("/api/v1/auth/register", json={"email": "test@example.com", "name": "Mother", "password": "abc"})
    assert response.status_code == 201
    
    # Verify the proxy sent it to the right place
    called_request = mock_send.call_args[0][0]
    assert str(called_request.url).endswith("/api/v1/auth/register")
    assert called_request.method == "POST"

@patch("httpx.AsyncClient.send")
def test_gateway_proxy_baby(mock_send):
    mock_send.return_value = Response(200, json={"name": "Baby A"})
    
    response = client.get("/api/v1/baby/profile", headers={"Authorization": "Bearer fake_token"})
    assert response.status_code == 200
    
    called_request = mock_send.call_args[0][0]
    assert str(called_request.url).endswith("/api/v1/baby/profile")
    assert called_request.headers.get("authorization") == "Bearer fake_token"
    
@patch("httpx.AsyncClient.send")
def test_gateway_proxy_growth(mock_send):
    mock_send.return_value = Response(200, json={"overview": "data"})
    
    response = client.get("/api/v1/growth/overview")
    assert response.status_code == 200
    
    called_request = mock_send.call_args[0][0]
    assert str(called_request.url).endswith("/api/v1/growth/overview")
    assert called_request.method == "GET"


@patch("httpx.AsyncClient.send")
def test_gateway_proxy_newborn_journey(mock_send):
    body = {"available": True, "chart_type": "educational_illustration", "points": []}
    mock_send.return_value = Response(200, json=body)
    response = client.get("/api/v1/growth/newborn-weight-journey", headers={"Cookie": "access_token=test"})
    assert response.status_code == 200
    assert response.json() == body
    forwarded = mock_send.call_args[0][0]
    assert str(forwarded.url).endswith("/api/v1/growth/newborn-weight-journey")
    assert forwarded.headers["cookie"] == "access_token=test"

@patch("httpx.AsyncClient.send")
def test_gateway_error_preservation(mock_send):
    mock_send.return_value = Response(401, json={"detail": "Unauthorized"})
    
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


@patch("httpx.AsyncClient.send")
def test_gateway_proxy_hybrid_explanation(mock_send):
    import json
    from pathlib import Path
    fixture = Path(__file__).resolve().parents[2] / 'frontend/src/test/fixtures/hybridExplanation.json'
    body = json.loads(fixture.read_text())
    mock_send.return_value = Response(200, json=body)
    response = client.get('/api/v1/growth/risk/explanation', headers={'Cookie': 'access_token=synthetic'})
    assert response.status_code == 200
    assert response.json() == body
    request = mock_send.call_args.args[0]
    assert str(request.url).endswith('/api/v1/growth/risk/explanation')
    assert request.headers['cookie'] == 'access_token=synthetic'
