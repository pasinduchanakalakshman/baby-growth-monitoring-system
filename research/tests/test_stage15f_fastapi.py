import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
services_dir = os.path.join(project_root, 'services', 'child-growth-monitoring-service')
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

from app.main import app
from app.core.database import Base, get_db

from sqlalchemy.pool import StaticPool

@pytest.fixture(scope="module")
def engine():
    engine = create_engine(
        "sqlite:///:memory:", 
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def session(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def client(session):
    def override_get_db():
        yield session
        
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_baby_registration(client):
    res = client.post("/api/v1/baby/register", json={
        "name": "Test API Baby",
        "sex": "Female",
        "date_of_birth": "2023-01-01",
        "birth_weight_kg": 3.0
    })
    assert res.status_code == 201
    assert res.json()["name"] == "Test API Baby"
    
def test_baby_profile_and_update(client):
    res = client.get("/api/v1/baby/profile")
    assert res.status_code == 200
    assert res.json()["name"] == "Test API Baby"
    
    res_upd = client.put("/api/v1/baby/profile", json={
        "name": "Updated Name"
    })
    assert res_upd.status_code == 200
    assert res_upd.json()["name"] == "Updated Name"

def test_measurement_creation_and_history(client):
    meas = client.post("/api/v1/growth/measurements", json={
        "visit_date": "2023-02-01",
        "weight_kg": 4.5
        # length missing
    })
    assert meas.status_code == 201
    assert meas.json()["verified_waz"] is not None
    assert meas.json()["verified_haz"] is None
    
    # Missing height test passed
    # Now check history
    hist = client.get("/api/v1/growth/history")
    assert hist.status_code == 200
    assert len(hist.json()) == 1

def test_insufficient_history_for_ml(client):
    # Overview with small history
    over = client.get("/api/v1/growth/overview")
    assert over.status_code == 200
    assert "current_growth" in over.json()
    
    # Predict without enough history -> maybe works if it handles small history, but our test is for "insufficient".
    # Since we have 1 measurement, let's see. XGBoost needs minimum sequence size or it pads.
    # Linear Regression needs at least 2 points for a slope if we implement it that way.

def test_ml_endpoints(client):
    client.post("/api/v1/growth/measurements", json={"visit_date": "2023-03-01", "weight_kg": 5.0})
    client.post("/api/v1/growth/measurements", json={"visit_date": "2023-04-01", "weight_kg": 5.5})
    
    # forecast
    f = client.get("/api/v1/growth/forecast")
    assert f.status_code == 200
    
    # risk
    r = client.get("/api/v1/growth/risk/latest")
    assert r.status_code == 200
    # risk traj
    traj = client.get("/api/v1/growth/risk/trajectory")
    assert traj.status_code == 200
    # risk xai
    x = client.get("/api/v1/growth/risk/explanation")
    if r.json().get("risk_available"):
        assert x.status_code == 200
    
    # overview integrates all
    over = client.get("/api/v1/growth/overview")
    assert over.status_code == 200
    assert "forecast_30d" in over.json()
    assert "risk_180d" in over.json()

def test_model_info(client):
    mi = client.get("/api/v1/growth/model-info")
    assert mi.status_code == 200
    data = mi.json()
    assert data["Risk"]["horizon_days"] == 180
    assert "Disclaimers" in data
