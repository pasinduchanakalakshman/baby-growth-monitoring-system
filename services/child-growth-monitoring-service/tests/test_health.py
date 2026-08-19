from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app

client = TestClient(app)

def test_health_check_postgres_connected():
    with patch('app.api.routes.health.check_db_connection', return_value=True):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "service": "child-growth-monitoring-service",
            "database": "connected"
        }

def test_health_check_postgres_disconnected():
    with patch('app.api.routes.health.check_db_connection', return_value=False):
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json() == {
            "detail": {
                "status": "error",
                "service": "child-growth-monitoring-service",
                "database": "disconnected"
            }
        }
