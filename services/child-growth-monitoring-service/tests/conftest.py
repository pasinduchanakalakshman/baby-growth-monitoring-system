import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.models import Base

import os

# Setup file SQLite database for testing (allows overriding to avoid host volume lock issues)
SQLALCHEMY_DATABASE_URL = os.getenv("TEST_DATABASE_URL", os.getenv("DATABASE_URL", "sqlite:///./test.db"))

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

@pytest.fixture(autouse=True)
def clean_db():
    # Delete all data in all tables instead of drop/create to avoid missing table issues
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield

@pytest.fixture
def client():
    return TestClient(app)
