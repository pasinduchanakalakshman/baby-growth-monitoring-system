import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date

from app.main import app
from app.core.database import get_db
from app.models import Base

def register_and_login(client, email: str, name: str = "Test Mother"):
    client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "securepassword"}
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "securepassword"}
    )
    return response.cookies

def test_baby_ownership_isolation(client):
    # User A creates a baby
    cookies_a = register_and_login(client, "mother_a@example.com")
    baby_a_res = client.post(
        "/api/v1/baby/register",
        json={
            "name": "Baby A",
            "sex": "Male",
            "date_of_birth": str(date.today()),
            "birth_weight_kg": 3.0,
            "birth_length_cm": 50.0
        },
        cookies=cookies_a
    )
    print(baby_a_res.json())
    assert baby_a_res.status_code == 201
    
    # User B logs in
    cookies_b = register_and_login(client, "mother_b@example.com")
    
    # User B should NOT see User A's baby
    baby_b_res = client.get("/api/v1/baby/profile", cookies=cookies_b)
    assert baby_b_res.status_code == 404
    
    # User B creates Baby B
    baby_b_create = client.post(
        "/api/v1/baby/register",
        json={
            "name": "Baby B",
            "sex": "Female",
            "date_of_birth": str(date.today()),
            "birth_weight_kg": 2.8,
            "birth_length_cm": 49.0
        },
        cookies=cookies_b
    )
    assert baby_b_create.status_code == 201
    
    # User A only sees Baby A
    baby_a_profile = client.get("/api/v1/baby/profile", cookies=cookies_a)
    assert baby_a_profile.json()["name"] == "Baby A"
    
    # User B only sees Baby B
    baby_b_profile = client.get("/api/v1/baby/profile", cookies=cookies_b)
    assert baby_b_profile.json()["name"] == "Baby B"

def test_growth_ownership_isolation(client):
    cookies_a = register_and_login(client, "mother_c@example.com")
    
    # Baby A
    client.post(
        "/api/v1/baby/register",
        json={
            "name": "Baby C",
            "sex": "Male",
            "date_of_birth": "2024-01-01",
            "birth_weight_kg": 3.0,
            "birth_length_cm": 50.0
        },
        cookies=cookies_a
    )
    
    # Add measurement for Baby A
    client.post(
        "/api/v1/growth/measurements",
        json={
            "date": "2024-02-01",
            "weight_kg": 4.0,
            "length_cm": 55.0
        },
        cookies=cookies_a
    )
    
    cookies_b = register_and_login(client, "mother_d@example.com")
    
    # Mother D has no baby yet, so should fail getting growth data
    growth_fail = client.get("/api/v1/growth/history", cookies=cookies_b)
    assert growth_fail.status_code == 404
