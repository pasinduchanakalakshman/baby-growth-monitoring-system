import os
import sys
import pytest
import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
services_dir = os.path.join(project_root, 'services', 'child-growth-monitoring-service')
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

from app.main import app
from app.core.database import Base, get_db

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

def test_full_parity_and_e2e_workflow(client):
    # 1. Register baby
    res = client.post("/api/v1/baby/register", json={
        "name": "Parity Test Baby",
        "sex": "Female",
        "date_of_birth": "2023-01-01",
        "birth_weight_kg": 3.0
    })
    assert res.status_code == 201
    
    # 2. Add first measurement
    m1 = client.post("/api/v1/growth/measurements", json={
        "visit_date": "2023-02-01",
        "weight_kg": 4.5
    })
    assert m1.status_code == 201
    d1 = m1.json()
    assert d1["age_days"] == 31
    assert d1["verified_waz"] is not None
    
    # 3. Add subsequent measurements
    client.post("/api/v1/growth/measurements", json={"visit_date": "2023-03-01", "weight_kg": 5.2})
    client.post("/api/v1/growth/measurements", json={"visit_date": "2023-04-01", "weight_kg": 6.0})
    client.post("/api/v1/growth/measurements", json={"visit_date": "2023-05-01", "weight_kg": 6.7})
    client.post("/api/v1/growth/measurements", json={"visit_date": "2023-06-01", "weight_kg": 7.3})
    
    # 4. Overview
    over = client.get("/api/v1/growth/overview")
    assert over.status_code == 200
    od = over.json()
    
    # Check Forecast Parity
    f = od.get("forecast_30d", {})
    if f.get("available"):
        assert "estimated_waz" in f
        assert "estimated_weight_kg" in f
        assert "estimated_weight_change_kg" in f
        assert f["horizon_days"] == 30
        
    # Check Risk Parity
    r = od.get("risk_180d", {})
    if r.get("available"):
        assert "probability" in r
        assert "threshold" in r
        assert r["threshold"] == 0.50
        assert "flag" in r
        assert r["horizon_days"] == 180
        assert r["applicable"] is True or r["applicable"] is False
        
    # Check XAI Parity
    if r.get("available") and r.get("applicable"):
        x = client.get("/api/v1/growth/risk/explanation")
        assert x.status_code == 200
        xd = x.json()
        assert "technical_explanation" in xd
        assert "frontend_safe_explanation" in xd
        assert "disclaimer" in xd
        
    # Check Dynamic Risk Parity
    traj = client.get("/api/v1/growth/risk/trajectory")
    assert traj.status_code == 200
    td = traj.json()
    # verify chronology
    dates = [t["visit_date"] for t in td]
    assert dates == sorted(dates)
    
def test_security_and_hygiene(client):
    # .env exposure check
    from app.core.config import settings
    # No endpoint should return raw secrets
    over = client.get("/api/v1/growth/overview")
    assert str(settings.DATABASE_URL) not in str(over.content)
    
    # filesystem paths
    import os
    assert str(os.getcwd()) not in str(over.content)
    
    # model info check
    mi = client.get("/api/v1/growth/model-info")
    assert "research use only" in str(mi.content).lower()
    assert "not a clinical diagnosis" in str(mi.content).lower()
