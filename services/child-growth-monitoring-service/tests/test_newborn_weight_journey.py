import json
import math
from unittest.mock import patch

import pytest

from app.models import GrowthMeasurement
from app.services import newborn_weight_journey_service as service
from tests.test_ownership import register_and_login


@pytest.mark.parametrize("sex,expected", [
    ("Male", [3.2, 3.04, 3.1314285714285717, 3.332, 3.654, 4.056]),
    ("Female", [3.2, 3.04, 3.1314285714285717, 3.316, 3.589, 3.932]),
])
def test_curve_and_piecewise_interpolation(sex, expected):
    result = service.calculate_newborn_weight_journey(3.2, sex, 39)
    assert result.available
    assert [p.day for p in result.points] == list(range(31))
    assert [result.points[d].weight_kg for d in [0, 3, 7, 14, 21, 30]] == pytest.approx(expected)
    assert result.points[0].value_type == "recorded_birth_weight"
    assert all(p.value_type == "illustrative" for p in result.points[1:])
    weights = [p.weight_kg for p in result.points]
    assert all(math.isfinite(w) and w > 0 for w in weights)
    assert all(weights[d] < weights[d - 1] for d in range(1, 4))
    assert all(weights[d] > weights[d - 1] for d in range(4, 31))
    assert weights[10] == 3.2
    assert weights[9] < 3.2 < weights[11]
    # Each linear segment reaches its boundary without a jump or duplicate day.
    for start, end in [(0, 3), (3, 10), (10, 14), (14, 28), (28, 30)]:
        slope = (weights[end] - weights[start]) / (end - start)
        for d in range(start, end + 1):
            assert weights[d] == pytest.approx(weights[start] + slope * (d - start))
    assert len(result.reference_rates) == 3


def test_reference_transcription_matches_reviewed_official_median_rows():
    data = json.loads(service.REFERENCE_PATH.read_text())
    # Independent expectations transcribed from the four WHO tables (internal doc URLs).
    assert data["median_velocity_g_per_day"] == {
        "Female": [[21, 29, 43, 36], [14, 29, 39, 35], [14, 29, 42, 32]],
        "Male": [[21, 36, 50, 42], [21, 33, 46, 40], [21, 31, 50, 41]],
    }
    assert data["median_increment_g_review_only"] == {
        "Female": [[150, 200, 600, 500], [100, 200, 550, 465], [100, 200, 550, 457]],
        "Male": [[150, 250, 700, 550], [150, 250, 650, 550], [150, 250, 700, 550]],
    }


@pytest.mark.parametrize("sex", ["Male", "Female"])
@pytest.mark.parametrize("birth,group", [(2.5, 0), (2.9999, 0), (3.0, 1), (3.4999, 1), (3.5, 2), (3.9999, 2)])
def test_supported_groups_and_exact_birth_weight(sex, birth, group):
    result = service.calculate_newborn_weight_journey(birth, sex, 37)
    reference = service.load_reference()
    assert result.points[0].weight_kg == birth
    assert result.reference_birth_weight_group_g == reference["groups_g"][group]
    assert [r.median_velocity_g_per_day for r in result.reference_rates] == reference["median_velocity_g_per_day"][sex][group][1:]


@pytest.mark.parametrize("weight,sex,weeks,reason", [
    (None, "Male", 39, "invalid_birth_weight"),
    (0, "Male", 39, "invalid_birth_weight"),
    (-1, "Male", 39, "invalid_birth_weight"),
    (float("nan"), "Male", 39, "invalid_birth_weight"),
    (float("inf"), "Male", 39, "invalid_birth_weight"),
    (True, "Male", 39, "invalid_birth_weight"),
    ("3.2", "Male", 39, "invalid_birth_weight"),
    (3.2, None, 39, "invalid_sex"),
    (3.2, "unknown", 39, "invalid_sex"),
    (3.2, "Male", None, "missing_gestational_age"),
    (3.2, "Male", 36, "unsupported_gestational_age"),
    (3.2, "Male", 42, "unsupported_gestational_age"),
    (3.2, "Male", 39.5, "unsupported_gestational_age"),
    (3.2, "Male", True, "unsupported_gestational_age"),
    (2.49, "Male", 39, "low_birth_weight"),
    (4.0, "Male", 39, "unsupported_birth_weight"),
    (1000, "Male", 39, "unsupported_birth_weight"),
])
def test_unavailable_inputs_fail_safely(weight, sex, weeks, reason):
    result = service.calculate_newborn_weight_journey(weight, sex, weeks)
    assert not result.available
    assert result.reason == reason
    assert result.points == []
    assert result.reference_rates == []
    # Invalid NaN/Infinity never escape into JSON.
    result.model_dump_json()


@pytest.mark.parametrize("error", [FileNotFoundError(), ValueError(), KeyError(), TypeError()])
def test_reference_unavailable(error):
    with patch.object(service, "load_reference", side_effect=error):
        result = service.calculate_newborn_weight_journey(3.2, "Male", 39)
    assert not result.available
    assert result.reason == "reference_unavailable"
    assert not result.points


def test_corrupt_reference():
    data = service.load_reference()
    data["median_velocity_g_per_day"]["Male"][0][1] = -36
    with patch("pathlib.Path.read_text", return_value=json.dumps(data)):
        assert service.calculate_newborn_weight_journey(2.8, "Male", 39).reason == "reference_unavailable"


def register_baby(client, weight=3.2, weeks=39):
    response = client.post("/api/v1/baby/register", json={
        "name": "Journey baby", "sex": "Male", "date_of_birth": "2026-10-19",
        "birth_weight_kg": weight, "gestational_age_weeks": weeks,
    })
    assert response.status_code == 201
    return response.json()


def test_endpoint_authentication(client):
    assert client.get("/api/v1/growth/newborn-weight-journey").status_code == 401


def test_endpoint_ownership_read_only_and_no_model_calls(client):
    cookies_a = register_and_login(client, "journey-a@example.com")
    baby_a = register_baby(client, 3.2)
    cookies_b = register_and_login(client, "journey-b@example.com")
    # Supplying another baby's ID cannot bypass owner filtering.
    assert client.get(f"/api/v1/growth/newborn-weight-journey?baby_id={baby_a['id']}").status_code == 404
    register_baby(client, 2.8)
    from app.api.routes import growth
    from app.core.database import get_db
    from app.main import app
    spies = [patch.object(obj, method, side_effect=AssertionError("ML/WHO must not be called")) for obj, method in [
        (growth.forecast_service, "generate_forecast"),
        (growth.risk_service, "calculate_risk"),
        (growth.temporal_feature_service, "calculate_features"),
        (growth.who_service, "calculate_who_metrics"),
        (growth.dynamic_risk_service, "calculate_dynamic_risk"),
        (growth.xai_service, "explain_prediction"),
        (growth.artifact_loader, "_load_joblib"),
    ]]
    from contextlib import ExitStack
    with ExitStack() as stack:
        for spy in spies:
            stack.enter_context(spy)
        for cookies, weight in [(cookies_a, 3.2), (cookies_b, 2.8)]:
            response = client.get("/api/v1/growth/newborn-weight-journey", cookies=cookies)
            assert response.status_code == 200
            body = response.json()
            assert body["available"]
            assert body["birth_weight_kg"] == weight
            assert body["points"][0]["weight_kg"] == weight
            assert len(body["points"]) == 31
            assert body["chart_type"] == "educational_illustration"
    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        assert db.query(GrowthMeasurement).count() == 0
    finally:
        db_generator.close()


def test_endpoint_updates_after_profile_change(client):
    register_and_login(client, "journey-update@example.com")
    register_baby(client)
    assert client.get("/api/v1/growth/newborn-weight-journey").json()["available"]
    assert client.put("/api/v1/baby/profile", json={"gestational_age_weeks": 35}).status_code == 200
    body = client.get("/api/v1/growth/newborn-weight-journey").json()
    assert not body["available"] and body["points"] == []
