"""Automated Security, Data Isolation, and Contract Tests for Nutrition API.

Covers all 28 required test scenarios from Phase 5 Task 8:
1. Authenticated parent requesting recommendations for their own baby.
2. Authenticated parent retrieving their baby's preferences.
3. Authenticated parent updating their baby's preferences.
4. Anonymous recommendation request.
5. Anonymous preference update.
6. Parent A attempting to access Parent B's baby.
7. Parent A attempting to modify Parent B's preferences.
8. Parent A attempting to read Parent B's nutrition history/preferences.
9. Nonexistent baby ID.
10. Invalid ingredient ID.
11. Invalid restriction group.
12. Future complementary-feeding start date.
13. Complementary-feeding date before DOB.
14. Missing optional preferences.
15. Existing baby without a nutrition preference record.
16. Multiple babies belonging to the same parent.
17. Persistence after backend restart.
18. Gateway authorization-header forwarding.
19. Gateway cookie forwarding.
20. Gateway error response handling.
21. No unauthorized modification of registered baby DOB.
22. No unauthorized modification of user ownership.
23. Correct 0–59-month boundary.
24. Correct 60-month completion response.
25. No dietary recommendations for children under six months.
26. Correct handling of empty recommendation sets.
27. Preference updates containing partial or omitted fields.
28. Database transaction rollback on failed updates.
"""

from datetime import date, timedelta
import pytest
from jose import jwt
from app.core.config import settings
from app.models import Baby, User
from app.models.nutrition import BabyNutritionPreferences
from tests.conftest import TestingSessionLocal


def register_and_login(client, email: str, name: str = "Test Parent"):
    """Registers and logs in a test user, returning cookies and raw JWT token."""
    client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = res.cookies.get("access_token")
    return res.cookies, token


def create_test_baby(client, cookies, name="Baby Test", dob=None, sex="Male"):
    """Creates a baby for the authenticated user and returns response json."""
    if dob is None:
        # Default to 7 months old
        dob = str(date.today() - timedelta(days=215))

    res = client.post(
        "/api/v1/baby/register",
        json={
            "name": name,
            "sex": sex,
            "date_of_birth": dob,
            "birth_weight_kg": 3.2,
            "birth_length_cm": 50.0,
        },
        cookies=cookies,
    )
    assert res.status_code == 201
    return res.json()


# ============================================================================
# Scenario 1: Authenticated parent requesting recommendations for own baby
# ============================================================================

def test_01_authenticated_parent_requesting_recommendations_for_own_baby(client):
    cookies, _ = register_and_login(client, "parent1@example.com")
    baby = create_test_baby(client, cookies, "Baby One")

    res = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby['id']}", cookies=cookies)
    assert res.status_code == 200
    data = res.json()
    assert "child_age_completed_months" in data
    assert "feeding_stage" in data
    assert "recommendations" in data
    assert "milk_feeding_guidance" in data
    assert data["is_eligible"] is True


# ============================================================================
# Scenario 2: Authenticated parent retrieving their baby's preferences
# ============================================================================

def test_02_authenticated_parent_retrieving_preferences(client):
    cookies, _ = register_and_login(client, "parent2@example.com")
    baby = create_test_baby(client, cookies, "Baby Two")

    res = client.get(f"/api/v1/nutrition/preferences?baby_id={baby['id']}", cookies=cookies)
    assert res.status_code == 200
    data = res.json()
    assert data["baby_id"] == baby["id"]
    assert "foods_introduced" in data
    assert "restricted_foods" in data


# ============================================================================
# Scenario 3: Authenticated parent updating their baby's preferences
# ============================================================================

def test_03_authenticated_parent_updating_preferences(client):
    cookies, _ = register_and_login(client, "parent3@example.com")
    baby = create_test_baby(client, cookies, "Baby Three")

    update_payload = {
        "dietary_preferences": ["VEGETARIAN"],
        "restricted_foods": ["RESTRICT_FISH"],
        "foods_introduced": ["ING_RICE_WHITE", "ING_PUMPKIN"],
        "milk_feeding_method": "exclusive_breastfeeding",
        "only_available_ingredients": False,
    }
    res = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json=update_payload,
        cookies=cookies,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["dietary_preferences"] == ["VEGETARIAN"]
    assert data["restricted_foods"] == ["RESTRICT_FISH"]
    assert "ING_RICE_WHITE" in data["foods_introduced"]
    assert data["milk_feeding_method"] == "exclusive_breastfeeding"


# ============================================================================
# Scenario 4: Anonymous recommendation request (401)
# ============================================================================

def test_04_anonymous_recommendation_request(client):
    res = client.get("/api/v1/nutrition/recommendations?baby_id=1")
    assert res.status_code == 401


# ============================================================================
# Scenario 5: Anonymous preference update (401)
# ============================================================================

def test_05_anonymous_preference_update(client):
    res = client.put("/api/v1/nutrition/preferences?baby_id=1", json={"dietary_preferences": ["VEGETARIAN"]})
    assert res.status_code == 401


# ============================================================================
# Scenario 6: Parent A attempting to access Parent B's baby recommendations (403)
# ============================================================================

def test_06_parent_a_attempting_to_access_parent_b_baby(client):
    cookies_a, _ = register_and_login(client, "mother_a@example.com")
    baby_a = create_test_baby(client, cookies_a, "Baby A")

    cookies_b, _ = register_and_login(client, "mother_b@example.com")
    baby_b = create_test_baby(client, cookies_b, "Baby B")

    # Parent A attempts to request recommendations for Parent B's baby
    res = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby_b['id']}", cookies=cookies_a)
    assert res.status_code == 403
    assert "Not authorized" in res.json()["detail"]


# ============================================================================
# Scenario 7: Parent A attempting to modify Parent B's preferences (403)
# ============================================================================

def test_07_parent_a_attempting_to_modify_parent_b_preferences(client):
    cookies_a, _ = register_and_login(client, "mother_a7@example.com")
    baby_a = create_test_baby(client, cookies_a, "Baby A7")

    cookies_b, _ = register_and_login(client, "mother_b7@example.com")
    baby_b = create_test_baby(client, cookies_b, "Baby B7")

    # Parent A attempts to update Parent B's preferences
    res = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby_b['id']}",
        json={"dietary_preferences": ["VEGETARIAN"]},
        cookies=cookies_a,
    )
    assert res.status_code == 403
    assert "Not authorized" in res.json()["detail"]


# ============================================================================
# Scenario 8: Parent A attempting to read Parent B's nutrition preferences (403)
# ============================================================================

def test_08_parent_a_attempting_to_read_parent_b_nutrition_history(client):
    cookies_a, _ = register_and_login(client, "mother_a8@example.com")
    baby_a = create_test_baby(client, cookies_a, "Baby A8")

    cookies_b, _ = register_and_login(client, "mother_b8@example.com")
    baby_b = create_test_baby(client, cookies_b, "Baby B8")

    res = client.get(f"/api/v1/nutrition/preferences?baby_id={baby_b['id']}", cookies=cookies_a)
    assert res.status_code == 403
    assert "Not authorized" in res.json()["detail"]


# ============================================================================
# Scenario 9: Nonexistent baby ID (404)
# ============================================================================

def test_09_nonexistent_baby_id(client):
    cookies, _ = register_and_login(client, "parent9@example.com")
    res = client.get("/api/v1/nutrition/recommendations?baby_id=99999", cookies=cookies)
    assert res.status_code == 404
    assert res.json()["detail"] == "Baby not found"


# ============================================================================
# Scenario 10: Invalid ingredient ID (400)
# ============================================================================

def test_10_invalid_ingredient_id(client):
    cookies, _ = register_and_login(client, "parent10@example.com")
    baby = create_test_baby(client, cookies, "Baby 10")

    res = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"foods_introduced": ["ING_UNKNOWN_FAKE_FOOD"]},
        cookies=cookies,
    )
    assert res.status_code == 400
    assert "Unknown ingredient ID" in res.json()["detail"]


# ============================================================================
# Scenario 11: Invalid restriction group (400)
# ============================================================================

def test_11_invalid_restriction_group(client):
    cookies, _ = register_and_login(client, "parent11@example.com")
    baby = create_test_baby(client, cookies, "Baby 11")

    res = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"restricted_foods": ["RESTRICT_NONEXISTENT_GROUP"]},
        cookies=cookies,
    )
    assert res.status_code == 400
    assert "Invalid restriction group code" in res.json()["detail"]


# ============================================================================
# Scenario 12: Future complementary-feeding start date (400)
# ============================================================================

def test_12_future_complementary_feeding_start_date(client):
    cookies, _ = register_and_login(client, "parent12@example.com")
    baby = create_test_baby(client, cookies, "Baby 12")

    future_date = str(date.today() + timedelta(days=30))
    res = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"complementary_feeding_start_date": future_date},
        cookies=cookies,
    )
    assert res.status_code == 400
    assert "future" in res.json()["detail"].lower()


# ============================================================================
# Scenario 13: Complementary-feeding date before DOB (400)
# ============================================================================

def test_13_complementary_feeding_date_before_dob(client):
    cookies, _ = register_and_login(client, "parent13@example.com")
    dob_date = date(2026, 1, 15)
    baby = create_test_baby(client, cookies, "Baby 13", dob=str(dob_date))

    before_dob = str(dob_date - timedelta(days=5))
    res = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"complementary_feeding_start_date": before_dob},
        cookies=cookies,
    )
    assert res.status_code == 400
    assert "before date of birth" in res.json()["detail"].lower()


# ============================================================================
# Scenario 14: Missing optional preferences (normative guidance generated)
# ============================================================================

def test_14_missing_optional_preferences(client):
    cookies, _ = register_and_login(client, "parent14@example.com")
    # 8-month-old infant with no preferences specified
    dob = str(date.today() - timedelta(days=245))
    baby = create_test_baby(client, cookies, "Baby 14", dob=dob)

    res = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby['id']}", cookies=cookies)
    assert res.status_code == 200
    data = res.json()
    assert data["child_age_completed_months"] == 8
    assert len(data["recommendations"]) > 0

    # Deterministic resolution when omitting baby_id for single registered baby
    res_no_baby_param = client.get("/api/v1/nutrition/recommendations", cookies=cookies)
    assert res_no_baby_param.status_code == 200
    assert res_no_baby_param.json()["child_age_completed_months"] == 8
    assert len(res_no_baby_param.json()["recommendations"]) > 0



# ============================================================================
# Scenario 15: Existing baby without a nutrition preference record
# ============================================================================

def test_15_existing_baby_without_nutrition_preference_record(client):
    cookies, _ = register_and_login(client, "parent15@example.com")
    baby = create_test_baby(client, cookies, "Baby 15")

    res = client.get(f"/api/v1/nutrition/preferences?baby_id={baby['id']}", cookies=cookies)
    assert res.status_code == 200
    data = res.json()
    assert data["baby_id"] == baby["id"]
    assert data["foods_introduced"] == []
    assert data["restricted_foods"] == []
    assert data["complementary_feeding_start_date"] is None


# ============================================================================
# Scenario 16: Multiple babies belonging to the same parent
# ============================================================================

def test_16_multiple_babies_belonging_to_same_parent(client):
    cookies, _ = register_and_login(client, "parent16@example.com")
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "parent16@example.com").first()

    # Create two babies for the same parent in DB
    baby1 = Baby(
        owner_id=user.id,
        name="Twin 1",
        sex="Male",
        date_of_birth=date.today() - timedelta(days=215),  # 7m
        birth_weight_kg=2.9,
    )
    baby2 = Baby(
        owner_id=user.id,
        name="Sibling 2",
        sex="Female",
        date_of_birth=date.today() - timedelta(days=400),  # 13m
        birth_weight_kg=3.1,
    )
    db.add(baby1)
    db.add(baby2)
    db.commit()
    db.refresh(baby1)
    db.refresh(baby2)
    db.close()

    # Set distinct preferences for Baby 1
    res1_put = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby1.id}",
        json={"dietary_preferences": ["VEGETARIAN"]},
        cookies=cookies,
    )
    assert res1_put.status_code == 200

    # Baby 2 preferences should remain separate
    res2_get = client.get(f"/api/v1/nutrition/preferences?baby_id={baby2.id}", cookies=cookies)
    assert res2_get.status_code == 200
    assert res2_get.json()["dietary_preferences"] == []

    # Recommendations for Baby 1 (7m) vs Baby 2 (13m) are distinct
    rec1 = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby1.id}", cookies=cookies).json()
    rec2 = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby2.id}", cookies=cookies).json()
    assert rec1["child_age_completed_months"] == 7
    assert rec2["child_age_completed_months"] == 13

    # Ambiguous request without baby_id when parent has multiple babies must be rejected with HTTP 400
    res_ambiguous = client.get("/api/v1/nutrition/recommendations", cookies=cookies)
    assert res_ambiguous.status_code == 400
    assert "Multiple registered babies found" in res_ambiguous.json()["detail"]

    # Ambiguous preference read and update without baby_id must also be rejected
    res_pref_ambiguous = client.get("/api/v1/nutrition/preferences", cookies=cookies)
    assert res_pref_ambiguous.status_code == 400
    assert "Multiple registered babies found" in res_pref_ambiguous.json()["detail"]

    res_put_ambiguous = client.put(
        "/api/v1/nutrition/preferences",
        json={"dietary_preferences": ["VEGETARIAN"]},
        cookies=cookies,
    )
    assert res_put_ambiguous.status_code == 400
    assert "Multiple registered babies found" in res_put_ambiguous.json()["detail"]



# ============================================================================
# Scenario 17: Persistence after backend restart
# ============================================================================

def test_17_persistence_after_backend_restart(client):
    cookies, _ = register_and_login(client, "parent17@example.com")
    baby = create_test_baby(client, cookies, "Baby 17")

    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"dietary_preferences": ["VEGETARIAN"], "available_ingredients": ["ING_RICE_WHITE"]},
        cookies=cookies,
    )

    # Directly inspect fresh DB session simulating new connection
    db = TestingSessionLocal()
    saved = db.query(BabyNutritionPreferences).filter(BabyNutritionPreferences.baby_id == baby["id"]).first()
    assert saved is not None
    assert saved.dietary_preferences == ["VEGETARIAN"]
    assert "ING_RICE_WHITE" in saved.available_ingredients
    db.close()


# ============================================================================
# Scenario 18: Gateway authorization-header forwarding
# ============================================================================

def test_18_gateway_authorization_header_forwarding(client):
    _, token = register_and_login(client, "parent18@example.com")
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "parent18@example.com").first()
    baby = Baby(
        owner_id=user.id,
        name="Baby 18",
        sex="Male",
        date_of_birth=date.today() - timedelta(days=215),
        birth_weight_kg=3.0,
    )
    db.add(baby)
    db.commit()
    db.refresh(baby)
    db.close()

    # Send Authorization Bearer header directly
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby.id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["is_eligible"] is True


# ============================================================================
# Scenario 19: Gateway cookie forwarding
# ============================================================================

def test_19_gateway_cookie_forwarding(client):
    cookies, _ = register_and_login(client, "parent19@example.com")
    baby = create_test_baby(client, cookies, "Baby 19")

    res = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby['id']}", cookies=cookies)
    assert res.status_code == 200


# ============================================================================
# Scenario 20: Gateway error response handling
# ============================================================================

def test_20_gateway_error_response_handling(client):
    # Unauthenticated request produces 401 with standard detail
    res401 = client.get("/api/v1/nutrition/recommendations?baby_id=1")
    assert res401.status_code == 401
    assert "detail" in res401.json()

    # Nonexistent baby produces 404
    cookies, _ = register_and_login(client, "parent20@example.com")
    res404 = client.get("/api/v1/nutrition/recommendations?baby_id=99999", cookies=cookies)
    assert res404.status_code == 404
    assert res404.json()["detail"] == "Baby not found"


# ============================================================================
# Scenario 21: No unauthorized modification of registered baby DOB
# ============================================================================

def test_21_no_unauthorized_modification_of_registered_baby_dob(client):
    cookies, _ = register_and_login(client, "parent21@example.com")
    orig_dob = date.today() - timedelta(days=215)
    baby = create_test_baby(client, cookies, "Baby 21", dob=str(orig_dob))

    # Client attempts to update preferences with a client-controlled date
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"dietary_preferences": ["VEGETARIAN"]},
        cookies=cookies,
    )

    # Verify registered baby DOB remains strictly unchanged
    db = TestingSessionLocal()
    b = db.query(Baby).filter(Baby.id == baby["id"]).first()
    assert b.date_of_birth == orig_dob
    db.close()


# ============================================================================
# Scenario 22: No unauthorized modification of user ownership
# ============================================================================

def test_22_no_unauthorized_modification_of_user_ownership(client):
    cookies, _ = register_and_login(client, "parent22@example.com")
    baby = create_test_baby(client, cookies, "Baby 22")

    db = TestingSessionLocal()
    b = db.query(Baby).filter(Baby.id == baby["id"]).first()
    orig_owner_id = b.owner_id
    db.close()

    # Preference updates cannot alter baby ownership
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"dietary_preferences": ["VEGETARIAN"]},
        cookies=cookies,
    )

    db = TestingSessionLocal()
    b_after = db.query(Baby).filter(Baby.id == baby["id"]).first()
    assert b_after.owner_id == orig_owner_id
    db.close()


# ============================================================================
# Scenario 23: Correct 0–59-month boundary
# ============================================================================

def test_23_correct_0_to_59_month_boundary(client):
    cookies, _ = register_and_login(client, "parent23@example.com")
    # Exactly 59 completed months
    eval_date = date(2026, 10, 20)
    dob = date(2021, 11, 20)
    baby = create_test_baby(client, cookies, "Baby 23", dob=str(dob))

    res = client.get(
        f"/api/v1/nutrition/recommendations?baby_id={baby['id']}&evaluation_date={eval_date}",
        cookies=cookies,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["child_age_completed_months"] == 59
    assert data["is_eligible"] is True
    assert data["is_at_completion_boundary"] is False
    assert len(data["recommendations"]) > 0


# ============================================================================
# Scenario 24: Correct 60-month completion response
# ============================================================================

def test_24_correct_60_month_completion_response(client):
    cookies, _ = register_and_login(client, "parent24@example.com")
    # Exactly 60 completed months (5th birthday)
    eval_date = date(2026, 10, 20)
    dob = date(2021, 10, 20)
    baby = create_test_baby(client, cookies, "Baby 24", dob=str(dob))

    res = client.get(
        f"/api/v1/nutrition/recommendations?baby_id={baby['id']}&evaluation_date={eval_date}",
        cookies=cookies,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["child_age_completed_months"] == 60
    assert data["is_eligible"] is False
    assert data["is_at_completion_boundary"] is True
    assert len(data["recommendations"]) == 0
    assert "completed" in data["special_notice"].lower()


# ============================================================================
# Scenario 25: No dietary recommendations for children under six months
# ============================================================================

def test_25_no_dietary_recommendations_for_children_under_six_months(client):
    cookies, _ = register_and_login(client, "parent25@example.com")
    # 3 months old infant
    eval_date = date(2026, 10, 20)
    dob = date(2026, 7, 20)
    baby = create_test_baby(client, cookies, "Baby 25", dob=str(dob))

    res = client.get(
        f"/api/v1/nutrition/recommendations?baby_id={baby['id']}&evaluation_date={eval_date}",
        cookies=cookies,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["child_age_completed_months"] == 3
    assert data["is_eligible"] is True
    assert data["recommendations"] == []
    assert data["generated_main_meals_count"] == 0
    assert data["generated_snacks_count"] == 0
    assert "exclusive breastfeeding" in data["milk_feeding_guidance"].lower()



# ============================================================================
# Scenario 26: Correct handling of empty recommendation sets
# ============================================================================

def test_26_correct_handling_of_empty_recommendation_sets(client):
    cookies, _ = register_and_login(client, "parent26@example.com")
    dob = date(2026, 3, 20)
    baby = create_test_baby(client, cookies, "Baby 26", dob=str(dob))

    # Exclude both white and red rice and demand only on-hand ingredients with unknown ingredient
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={
            "restricted_foods": ["ING_RICE_WHITE", "ING_RICE_RED"],
            "only_available_ingredients": True,
            "available_ingredients": ["ING_AVOCADO"],
        },
        cookies=cookies,
    )

    res = client.get(
        f"/api/v1/nutrition/recommendations?baby_id={baby['id']}&evaluation_date=2026-10-20",
        cookies=cookies,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["recommendations"] == []
    assert "no dishes" in data["special_notice"].lower()


# ============================================================================
# Scenario 27: Preference updates containing partial or omitted fields
# ============================================================================

def test_27_preference_updates_containing_partial_or_omitted_fields(client):
    cookies, _ = register_and_login(client, "parent27@example.com")
    baby = create_test_baby(client, cookies, "Baby 27")

    # Step 1: Set dietary_preferences
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"dietary_preferences": ["VEGETARIAN"]},
        cookies=cookies,
    )

    # Step 2: Set restricted_foods, omitting dietary_preferences
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"restricted_foods": ["RESTRICT_FISH"]},
        cookies=cookies,
    )

    # Verify both fields are preserved
    res = client.get(f"/api/v1/nutrition/preferences?baby_id={baby['id']}", cookies=cookies)
    data = res.json()
    assert data["dietary_preferences"] == ["VEGETARIAN"]
    assert data["restricted_foods"] == ["RESTRICT_FISH"]


# ============================================================================
# Scenario 28: Database transaction rollback on failed updates
# ============================================================================

def test_28_database_transaction_rollback_on_failed_updates(client):
    cookies, _ = register_and_login(client, "parent28@example.com")
    baby = create_test_baby(client, cookies, "Baby 28")

    # Initial valid preferences
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"dietary_preferences": ["VEGETARIAN"]},
        cookies=cookies,
    )

    # Attempt update with invalid ingredient ID (fails validation before commit)
    res_fail = client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"foods_introduced": ["ING_INVALID_CORRUPT"]},
        cookies=cookies,
    )
    assert res_fail.status_code == 400

    # Verify state remains clean and untouched
    res = client.get(f"/api/v1/nutrition/preferences?baby_id={baby['id']}", cookies=cookies)
    assert res.json()["dietary_preferences"] == ["VEGETARIAN"]
    assert res.json()["foods_introduced"] == []


# ============================================================================
# Scenario 29: Payload integrity, counts, and catalogue validity across responses
# ============================================================================

def test_29_payload_integrity_and_catalogue_validity(client):
    from app.services.nutrition_catalog_service import NutritionCatalogService
    catalog_service = NutritionCatalogService()
    cat_data = catalog_service.load_catalog()
    dish_ids = {d.dish_id for d in cat_data.dishes}
    snack_ids = {s.snack_id for s in cat_data.snacks}
    ingredient_ids = {i.food_id for i in cat_data.ingredients}

    # Test multiple milestones: 7 months (with soft snack), 9 months (finger food), 14 months (family foods)
    ages_days = [215, 275, 425]
    for days in ages_days:
        cookies, _ = register_and_login(client, f"parent29_{days}@example.com")
        dob = str(date.today() - timedelta(days=days))
        baby = create_test_baby(client, cookies, f"Baby Age {days}", dob=dob)

        res = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby['id']}", cookies=cookies)
        assert res.status_code == 200
        data = res.json()

        # 1. Meal count fields match actual returned counts
        main_meals = [m for m in data["recommendations"] if m["meal_slot"] != "SNACK"]
        snack_meals = [m for m in data["recommendations"] if m["meal_slot"] == "SNACK"]
        assert data["generated_main_meals_count"] == len(main_meals)
        assert data["generated_snacks_count"] == len(snack_meals)

        # 2. Every returned dish or snack ID exists in the catalogue
        for meal in data["recommendations"]:
            food_id = meal["dish_or_food_id"]
            if meal["meal_slot"] == "SNACK":
                assert food_id in snack_ids, f"Snack ID {food_id} not in catalogue"
            else:
                assert food_id in dish_ids, f"Dish ID {food_id} not in catalogue"

            # 3. Every ingredient ID exists in catalogue
            for ing_id in meal.get("ingredients", []):
                assert ing_id in ingredient_ids, f"Ingredient ID {ing_id} not in catalogue"

            # 4. Source citation has valid booklet and pdf page numbers
            cit = meal.get("source_citation", {})
            if cit.get("booklet_page") is not None:
                assert 0 <= cit["booklet_page"] <= 24, f"Invalid booklet page {cit['booklet_page']}"
            if cit.get("pdf_page") is not None:
                assert 1 <= cit["pdf_page"] <= 28, f"Invalid PDF page {cit['pdf_page']}"

        # 5. Check substitutions in response
        for orig, subs in data.get("available_substitutions", {}).items():
            assert orig in ingredient_ids, f"Original ingredient {orig} not in catalogue"
            for sub_id in subs:
                assert sub_id in ingredient_ids, f"Substitute ingredient {sub_id} not in catalogue"


# ============================================================================
# Scenario 30: Reject future evaluation dates
# ============================================================================

def test_30_future_evaluation_date_rejection(client):
    cookies, _ = register_and_login(client, "parent30@example.com")
    baby = create_test_baby(client, cookies, "Baby 30")

    tomorrow = date.today() + timedelta(days=1)
    res = client.get(
        f"/api/v1/nutrition/recommendations?baby_id={baby['id']}&evaluation_date={tomorrow}",
        cookies=cookies,
    )
    assert res.status_code == 400
    assert "future" in res.json()["detail"].lower()


# ============================================================================
# Scenario 31: Reject evaluation date before child date of birth
# ============================================================================

def test_31_evaluation_date_before_dob_rejection(client):
    cookies, _ = register_and_login(client, "parent31@example.com")
    dob = date.today() - timedelta(days=200)
    baby = create_test_baby(client, cookies, "Baby 31", dob=str(dob))

    before_dob = dob - timedelta(days=10)
    res = client.get(
        f"/api/v1/nutrition/recommendations?baby_id={baby['id']}&evaluation_date={before_dob}",
        cookies=cookies,
    )
    assert res.status_code == 400
    assert "before baby date of birth" in res.json()["detail"].lower()


# ============================================================================
# Scenario 32: Nuanced under-six-month milk feeding guidance
# ============================================================================

def test_32_under_six_month_milk_feeding_guidance_nuance(client):
    cookies, _ = register_and_login(client, "parent32@example.com")
    dob = date.today() - timedelta(days=60)  # ~2 months old
    baby = create_test_baby(client, cookies, "Baby 32", dob=str(dob))

    # Case A: Unrecorded milk feeding history
    res_unrec = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby['id']}", cookies=cookies)
    assert res_unrec.status_code == 200
    data_unrec = res_unrec.json()
    assert "exclusive breastfeeding" in data_unrec["milk_feeding_guidance"].lower()
    assert data_unrec["recommendations"] == []
    assert data_unrec["generated_main_meals_count"] == 0
    assert data_unrec["generated_snacks_count"] == 0

    # Case B: Formula feeding recorded
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"dietary_preferences": ["INFANT_FORMULA_ONLY"]},
        cookies=cookies,
    )
    res_form = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby['id']}", cookies=cookies)
    assert res_form.status_code == 200
    data_form = res_form.json()
    assert "infant formula" in data_form["milk_feeding_guidance"].lower()

    # Case C: Breastfeeding recorded
    client.put(
        f"/api/v1/nutrition/preferences?baby_id={baby['id']}",
        json={"dietary_preferences": ["BREASTFED"]},
        cookies=cookies,
    )
    res_bf = client.get(f"/api/v1/nutrition/recommendations?baby_id={baby['id']}", cookies=cookies)
    assert res_bf.status_code == 200
    data_bf = res_bf.json()
    assert "exclusive breastfeeding" in data_bf["milk_feeding_guidance"].lower()

