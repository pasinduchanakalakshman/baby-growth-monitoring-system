"""Run against an isolated test stack; registers two synthetic accounts only.

python tests/smoke_newborn_weight_journey.py --base-url http://127.0.0.1:8180
Never point this at a real user database. No model endpoints are called.
"""
import argparse
import math
import secrets
import time
from datetime import date

import httpx


def run(base_url: str):
    path = "/api/v1/growth/newborn-weight-journey"
    with httpx.Client(base_url=base_url, timeout=15) as a, httpx.Client(base_url=base_url, timeout=15) as b:
        for attempt in range(30):
            try:
                if a.get("/health").status_code == 200:
                    break
            except httpx.RequestError:
                pass
            if attempt == 29:
                raise RuntimeError("Gateway did not become ready")
            time.sleep(1)
        assert a.get(path).status_code == 401
        babies = []
        for client, sex, weight in [(a, "Male", 3.2), (b, "Female", 2.8)]:
            email = f"newborn-smoke-{secrets.token_hex(8)}@example.com"
            password = secrets.token_urlsafe(24)
            assert client.post("/api/v1/auth/register", json={"name": "Journey smoke", "email": email, "password": password}).status_code == 201
            assert client.post("/api/v1/auth/login", json={"email": email, "password": password}).status_code == 200
            assert client.get(path).status_code == 404
            # B cannot request A's child even by supplying its ID.
            if babies:
                assert client.get(path, params={"baby_id": babies[0]["id"]}).status_code == 404
            response = client.post("/api/v1/baby/register", json={
                "name": "Journey smoke baby", "sex": sex, "date_of_birth": date.today().isoformat(),
                "birth_weight_kg": weight, "gestational_age_weeks": 39,
            })
            assert response.status_code == 201
            babies.append(response.json())
            assert client.get("/api/v1/growth/history").json() == []
            response = client.get(path)
            assert response.status_code == 200
            data = response.json()
            assert data["available"] and data["chart_type"] == "educational_illustration"
            assert len(data["points"]) == 31
            assert [p["day"] for p in data["points"]] == list(range(31))
            assert data["birth_weight_kg"] == weight == data["points"][0]["weight_kg"]
            assert data["points"][0]["value_type"] == "recorded_birth_weight"
            assert all(p["value_type"] == "illustrative" and math.isfinite(p["weight_kg"]) and p["weight_kg"] > 0 for p in data["points"][1:])
            assert client.get("/api/v1/growth/history").json() == []
            print(f"PASS: {sex}, {weight} kg; 31 points; no measurement writes")
        # The supplied identifier never overrides authenticated ownership.
        assert a.get(path, params={"baby_id": babies[1]["id"]}).json()["birth_weight_kg"] == 3.2
        for gestation in [35, None]:
            assert a.put("/api/v1/baby/profile", json={"gestational_age_weeks": gestation}).status_code == 200
            data = a.get(path).json()
            assert not data["available"] and data["points"] == []
        print("PASS: cookie authentication, ownership, profile refresh, premature and missing-gestation cases")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="Isolated test stack URL")
    run(parser.parse_args().base_url)
