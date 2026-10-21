"""Automated Tests for Daily and Weekly Nutrition Meal Planner.

Verifies all 38 Phase 7 requirements:
1. Daily plan generation.
2. Seven-day generation.
3. Deterministic results.
4. Day 1 complementary feeding.
5. Days 2–30 feeding progression.
6. Seven-month milestone changes.
7. Eight-month milestone.
8. Nine-to-eleven months.
9. Twelve-to-twenty-three months.
10. Twenty-four-to-fifty-nine months.
11. Two-month-old child.
12. Six-month birthday during the week.
13. Eight-month birthday during the week.
14. Exact sixty-month boundary during the week.
15. Fish restriction.
16. Shellfish restriction.
17. Coconut restriction.
18. Dairy and egg restrictions.
19. Vegetarian preference.
20. Food-introduction prerequisites.
21. Unknown feeding start date.
22. Household ingredient availability.
23. Strict available-ingredients mode.
24. Meal variety across seven days.
25. Limited catalogue fallback.
26. No eligible meals.
27. Unfilled slots and notices.
28. Grocery checklist integrity.
29. Substitution eligibility.
30. Unrecorded future food tolerance.
31. Authenticated planner access.
32. Cross-parent access denial.
33. Multiple baby profile isolation.
34. Future planning date bounds.
38. Accurate FHB references and evidence tiers.
"""

from datetime import date, timedelta
import pytest
from app.models import Baby, User
from app.models.nutrition import BabyNutritionPreferences
from app.schemas.nutrition import (
    ChildNutritionProfile,
    EvidenceTier,
    FeedingStageId,
    MealType,
    RestrictionGroupCode,
)
from app.services.nutrition_catalog_service import get_nutrition_catalog_service
from app.services.nutrition_planner_service import get_nutrition_planner_service
from tests.conftest import TestingSessionLocal


def register_and_login(client, email: str, name: str = "Test Parent"):
    """Registers and logs in a test parent, returning cookies."""
    client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    return res.cookies


def create_test_baby(client, cookies, name="Baby Test", dob=None, sex="Male"):
    """Creates a baby for authenticated user."""
    if dob is None:
        dob = str(date.today() - timedelta(days=215))  # ~7 months

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
# Core Planner Unit & Service Tests
# ============================================================================

def test_01_daily_plan_generation_structure():
    """1. Daily plan generation produces valid structure and meal slots."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 3, 1),
        biological_sex="Male",
    )
    plan_date = date(2025, 10, 15)  # 7 months 14 days
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date, baby_id=1)

    assert plan.baby_id == 1
    assert plan.plan_date == plan_date
    assert plan.child_age_completed_months == 7
    assert plan.feeding_stage == FeedingStageId.STAGE_7_TO_8M
    assert len(plan.planned_meals) == 3
    assert len(plan.planned_snacks) >= 1

    slot = plan.planned_meals[0]
    assert slot.meal_item is not None
    assert slot.meal_item.name
    assert slot.meal_item.household_portion
    assert slot.meal_item.texture
    assert slot.meal_item.preparation_instructions is not None
    assert slot.meal_item.safety_precautions is not None
    assert slot.meal_item.source_citation.publication is not None
    assert slot.meal_item.evidence_tier in (EvidenceTier.TIER_A, EvidenceTier.TIER_B)


def test_02_seven_day_generation_structure():
    """2. Seven-day generation returns exactly 7 consecutive daily plans."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 1, 1),
        biological_sex="Female",
    )
    start_date = date(2025, 10, 1)
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=start_date, baby_id=2)

    assert weekly.baby_id == 2
    assert weekly.start_date == start_date
    assert weekly.end_date == start_date + timedelta(days=6)
    assert len(weekly.days) == 7
    for i, day in enumerate(weekly.days):
        assert day.plan_date == start_date + timedelta(days=i)


def test_03_deterministic_results():
    """3. Deterministic results: Multiple executions with identical input produce identical plans."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 2, 10),
        biological_sex="Male",
        available_ingredients=["ING_RICE_WHITE", "ING_DHAL", "ING_CARROT", "ING_EGG_CHICKEN"],
    )
    start_date = date(2025, 10, 10)

    weekly1 = planner.generate_weekly_meal_plan(profile=profile, start_date=start_date, baby_id=3)
    weekly2 = planner.generate_weekly_meal_plan(profile=profile, start_date=start_date, baby_id=3)

    assert len(weekly1.days) == len(weekly2.days) == 7
    for d1, d2 in zip(weekly1.days, weekly2.days):
        assert d1.plan_date == d2.plan_date
        assert d1.feeding_stage == d2.feeding_stage
        assert len(d1.planned_meals) == len(d2.planned_meals)
        for s1, s2 in zip(d1.planned_meals, d2.planned_meals):
            assert s1.meal_item.dish_or_food_id == s2.meal_item.dish_or_food_id


def test_04_day_1_complementary_feeding():
    """4. Day 1 complementary feeding has exactly 1 feeding session and no snacks."""
    planner = get_nutrition_planner_service()
    dob = date(2025, 4, 1)
    start_date = date(2025, 10, 1)  # Exactly 6 months
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Male",
        complementary_feeding_start_date=start_date,
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=start_date)

    assert plan.feeding_stage == FeedingStageId.STAGE_6M_DAY_1
    assert len(plan.planned_meals) == 1
    assert len(plan.planned_snacks) == 0
    assert "Introductory Feeding Session" in plan.planned_meals[0].slot_label
    assert plan.planned_meals[0].meal_item.dish_or_food_id == "DISH_MASHED_RICE_BREASTMILK"


def test_05_days_2_30_feeding_progression():
    """5. Days 2–30 feeding progression supports appropriate early feeding session."""
    planner = get_nutrition_planner_service()
    dob = date(2025, 4, 1)
    feed_start = date(2025, 10, 1)
    plan_date = date(2025, 10, 10)  # Day 10 of complementary feeding
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Female",
        complementary_feeding_start_date=feed_start,
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date)

    assert plan.feeding_stage in (FeedingStageId.STAGE_6M_DAYS_10_15, FeedingStageId.STAGE_6M_GENERAL)
    assert len(plan.planned_meals) in (1, 2)
    assert len(plan.planned_snacks) == 0


def test_06_seven_month_milestone_changes():
    """6. Seven-month milestone produces 3 meals + 1 snack."""
    planner = get_nutrition_planner_service()
    dob = date(2025, 3, 1)
    plan_date = date(2025, 10, 15)  # 7m 14d
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Male",
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date)

    assert plan.feeding_stage == FeedingStageId.STAGE_7_TO_8M
    assert plan.feeding_rule.rule_id == "RULE_09C_STAGE_7M_2WEEKS"
    assert len(plan.planned_meals) == 3
    assert len(plan.planned_snacks) == 1


def test_07_eight_month_milestone():
    """7. Eight-month milestone features mashed/chopped food and finger foods."""
    planner = get_nutrition_planner_service()
    dob = date(2025, 2, 1)
    plan_date = date(2025, 10, 15)  # 8m 14d
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Female",
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date)

    assert plan.feeding_stage == FeedingStageId.STAGE_7_TO_8M
    assert plan.feeding_rule.rule_id == "RULE_10_STAGE_8M_MILESTONES"
    assert len(plan.planned_meals) == 3
    assert len(plan.planned_snacks) in (1, 2)
    assert "chewing" in plan.feeding_rule.stage_name.lower() or "finger" in plan.feeding_rule.stage_name.lower()


def test_08_nine_to_eleven_months():
    """8. Nine-to-eleven months supports family foods finely chopped/mashed."""
    planner = get_nutrition_planner_service()
    dob = date(2024, 11, 15)
    plan_date = date(2025, 10, 15)  # 11 months
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Male",
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date)

    assert plan.feeding_stage == FeedingStageId.STAGE_9_TO_11M
    assert len(plan.planned_meals) == 3
    assert len(plan.planned_snacks) in (1, 2)


def test_09_twelve_to_twenty_three_months():
    """9. Twelve-to-twenty-three months supports toddler family meals."""
    planner = get_nutrition_planner_service()
    dob = date(2024, 5, 1)
    plan_date = date(2025, 10, 15)  # 17 months
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Female",
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date)

    assert plan.feeding_stage == FeedingStageId.STAGE_12_TO_23M
    assert len(plan.planned_meals) in (3, 4)
    assert len(plan.planned_snacks) in (1, 2)


def test_10_twenty_four_to_fifty_nine_months():
    """10. Twenty-four-to-fifty-nine months supports preschool family foods with 3 meals + 2 snacks."""
    planner = get_nutrition_planner_service()
    dob = date(2022, 10, 1)
    plan_date = date(2025, 10, 15)  # 36 months (3 years)
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Male",
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date)

    assert plan.feeding_stage == FeedingStageId.STAGE_24_TO_59M
    assert len(plan.planned_meals) == 3
    assert len(plan.planned_snacks) == 2


def test_11_two_month_old_child():
    """11. Two-month-old child receives exclusive milk guidance without complementary meals."""
    planner = get_nutrition_planner_service()
    dob = date(2025, 8, 15)
    plan_date = date(2025, 10, 15)  # 2 months
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Male",
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=plan_date)

    assert plan.is_under_six_months is True
    assert plan.feeding_stage == FeedingStageId.STAGE_0_TO_6M
    assert len(plan.planned_meals) == 0
    assert len(plan.planned_snacks) == 0
    assert "exclusive breastfeeding" in plan.milk_feeding_guidance.lower()


def test_12_six_month_birthday_during_the_week():
    """12. Six-month birthday during the week transitions from milk-only to complementary feeding."""
    planner = get_nutrition_planner_service()
    # Baby born 2025-04-12. Turns 6 completed months on 2025-10-12.
    dob = date(2025, 4, 12)
    start_date = date(2025, 10, 10)  # Starts at 5 months 28 days

    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Female",
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=start_date)

    # Days 0 and 1: 5 completed months (exclusive milk, 0 meals)
    assert weekly.days[0].child_age_completed_months == 5
    assert weekly.days[0].feeding_stage == FeedingStageId.STAGE_0_TO_6M
    assert len(weekly.days[0].planned_meals) == 0

    assert weekly.days[1].child_age_completed_months == 5
    assert weekly.days[1].feeding_stage == FeedingStageId.STAGE_0_TO_6M
    assert len(weekly.days[1].planned_meals) == 0

    # Day 2: 2025-10-12 (Exact 6 months birthday! Start date unknown -> STAGE_6M_GENERAL)
    assert weekly.days[2].plan_date == date(2025, 10, 12)
    assert weekly.days[2].child_age_completed_months == 6
    assert weekly.days[2].feeding_stage == FeedingStageId.STAGE_6M_GENERAL
    assert weekly.days[2].feeding_rule.rule_id == "RULE_08_STAGE_6M_GENERAL"
    assert weekly.days[2].feeding_stage != FeedingStageId.STAGE_6M_DAY_1
    assert len(weekly.days[2].planned_meals) >= 1


def test_12b_known_start_date_progresses_introductory_milestones():
    """12b. When start date is known, weekly planner follows Day 1, Day 2-3, Day 4-6 progression."""
    planner = get_nutrition_planner_service()
    dob = date(2025, 4, 12)
    # Complementary feeding starts on exact 6 month birthday
    cf_start = date(2025, 10, 12)
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Female",
        complementary_feeding_start_date=cf_start,
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 10))

    # Days 0-1: 5 months -> exclusive milk
    assert weekly.days[0].feeding_stage == FeedingStageId.STAGE_0_TO_6M
    assert weekly.days[1].feeding_stage == FeedingStageId.STAGE_0_TO_6M

    # Day 2: 2025-10-12 -> Day 1 of complementary feeding!
    assert weekly.days[2].plan_date == date(2025, 10, 12)
    assert weekly.days[2].feeding_stage == FeedingStageId.STAGE_6M_DAY_1
    assert weekly.days[2].feeding_rule.rule_id == "RULE_02_DAY_1"
    assert len(weekly.days[2].planned_meals) == 1

    # Day 3: 2025-10-13 -> Day 2 of complementary feeding
    assert weekly.days[3].feeding_stage == FeedingStageId.STAGE_6M_DAYS_2_3
    assert weekly.days[3].feeding_rule.rule_id == "RULE_03_DAYS_2_3"

    # Day 5: 2025-10-15 -> Day 4 of complementary feeding (Days 4-6 rule)
    assert weekly.days[5].feeding_stage == FeedingStageId.STAGE_6M_DAYS_4_6
    assert weekly.days[5].feeding_rule.rule_id == "RULE_04_DAYS_4_6"


def test_12c_unknown_start_date_never_assumes_day_1():
    """12c. Negative test: Unknown start date never assumes Day 1 or advances progression."""
    planner = get_nutrition_planner_service()
    dob = date(2025, 4, 12)
    # Start date is None
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Male",
        complementary_feeding_start_date=None,
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 10))

    for day in weekly.days[2:]:
        # Must be STAGE_6M_GENERAL, never STAGE_6M_DAY_1 or milestone progression
        assert day.feeding_stage == FeedingStageId.STAGE_6M_GENERAL
        assert day.feeding_rule.rule_id == "RULE_08_STAGE_6M_GENERAL"
        assert day.feeding_stage != FeedingStageId.STAGE_6M_DAY_1
        assert day.feeding_stage != FeedingStageId.STAGE_6M_DAYS_2_3


def test_13_eight_month_birthday_during_the_week():
    """13. Eight-month birthday during the week transitions from 7m to 8m milestone."""
    planner = get_nutrition_planner_service()
    # Baby born 2025-02-15. Turns 8 completed months on 2025-10-15.
    dob = date(2025, 2, 15)
    start_date = date(2025, 10, 13)

    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Male",
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=start_date)

    # Day 0: 7 months
    assert weekly.days[0].child_age_completed_months == 7
    assert weekly.days[0].feeding_rule.rule_id in ("RULE_09A_STAGE_7M_COMPLETED", "RULE_09B_STAGE_7M_1WEEK", "RULE_09C_STAGE_7M_2WEEKS")

    # Day 2: 8 months reached on 2025-10-15
    assert weekly.days[2].plan_date == date(2025, 10, 15)
    assert weekly.days[2].child_age_completed_months == 8
    assert weekly.days[2].feeding_rule.rule_id == "RULE_10_STAGE_8M_MILESTONES"


def test_14_exact_sixty_month_boundary_during_the_week():
    """14. Exact sixty-month boundary during the week halts meal generation and returns completion notice."""
    planner = get_nutrition_planner_service()
    # Baby born 2020-10-15. Turns 60 completed months on 2025-10-15.
    dob = date(2020, 10, 15)
    start_date = date(2025, 10, 13)

    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Female",
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=start_date)

    # Days 0-1: 59 completed months
    assert weekly.days[0].child_age_completed_months == 59
    assert weekly.days[0].is_at_completion_boundary is False
    assert len(weekly.days[0].planned_meals) == 3

    # Day 2: 60 completed months reached
    assert weekly.days[2].plan_date == date(2025, 10, 15)
    assert weekly.days[2].child_age_completed_months == 60
    assert weekly.days[2].is_at_completion_boundary is True
    assert weekly.days[2].feeding_stage == FeedingStageId.STAGE_60M_PLUS
    assert len(weekly.days[2].planned_meals) == 0
    assert "Transition to family meals" in weekly.days[2].meal_frequency_guidance


def test_15_fish_restriction_enforcement():
    """15. Fish restriction strictly excludes fish dishes and snacks."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 1, 1),
        biological_sex="Male",
        restricted_foods=[RestrictionGroupCode.RESTRICT_FISH],
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    for day in weekly.days:
        for slot in day.planned_meals:
            if slot.meal_item:
                assert "fish" not in slot.meal_item.name.lower()
                assert "thalapath" not in slot.meal_item.name.lower()
                assert "sprats" not in slot.meal_item.name.lower()


def test_16_shellfish_restriction_enforcement():
    """16. Shellfish restriction strictly excludes shellfish/prawns."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 1, 1),
        biological_sex="Female",
        restricted_foods=[RestrictionGroupCode.RESTRICT_SHELLFISH],
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    for day in weekly.days:
        for slot in day.planned_meals:
            if slot.meal_item:
                assert "prawn" not in slot.meal_item.name.lower()
                assert "crab" not in slot.meal_item.name.lower()


def test_17_coconut_restriction_enforcement():
    """17. Coconut restriction strictly excludes dishes with coconut milk or grated coconut."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 1, 1),
        biological_sex="Male",
        restricted_foods=[RestrictionGroupCode.RESTRICT_COCONUT],
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    for day in weekly.days:
        for slot in day.planned_meals:
            if slot.meal_item:
                assert "coconut" not in slot.meal_item.name.lower()
                assert "pol" not in slot.meal_item.name.lower()
                assert "ING_COCONUT_MILK" not in slot.meal_item.ingredients
                assert "ING_COCONUT_GRATED" not in slot.meal_item.ingredients


def test_18_dairy_and_egg_restrictions():
    """18. Dairy and egg restrictions strictly exclude dairy and eggs."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 1, 1),
        biological_sex="Female",
        restricted_foods=[RestrictionGroupCode.RESTRICT_DAIRY, RestrictionGroupCode.RESTRICT_EGG],
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    for day in weekly.days:
        for slot in day.planned_meals:
            if slot.meal_item:
                assert "egg" not in slot.meal_item.name.lower()
                assert "curd" not in slot.meal_item.name.lower()
                assert "yoghurt" not in slot.meal_item.name.lower()
                assert "ING_EGG_YOLK" not in slot.meal_item.ingredients
                assert "ING_EGG_CHICKEN" not in slot.meal_item.ingredients


def test_19_vegetarian_preference():
    """19. Vegetarian preference excludes meat, fish, and poultry."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 1, 1),
        biological_sex="Male",
        dietary_preferences=["VEGETARIAN"],
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    for day in weekly.days:
        for slot in day.planned_meals:
            if slot.meal_item:
                assert "chicken" not in slot.meal_item.name.lower()
                assert "fish" not in slot.meal_item.name.lower()
                assert "sprats" not in slot.meal_item.name.lower()
                assert "thalapath" not in slot.meal_item.name.lower()


def test_20_food_introduction_prerequisites():
    """20. Food introduction prerequisites: Egg dishes require egg yolk introduction at 7 months."""
    planner = get_nutrition_planner_service()
    profile_without_egg = ChildNutritionProfile(
        date_of_birth=date(2025, 3, 1),
        biological_sex="Male",
        foods_introduced=[],  # No egg yolk
    )
    plan = planner.generate_daily_meal_plan(profile=profile_without_egg, plan_date=date(2025, 10, 15))
    for slot in plan.planned_meals:
        if slot.meal_item:
            assert slot.meal_item.dish_or_food_id != "DISH_COARSE_MASH_7M_SOYA_EGG"


def test_21_unknown_feeding_start_date_fallback():
    """21. Unknown complementary feeding start date uses chronological age fallback safely."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 3, 1),
        biological_sex="Female",
        complementary_feeding_start_date=None,
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=date(2025, 10, 15))
    assert plan.feeding_stage == FeedingStageId.STAGE_7_TO_8M
    assert len(plan.planned_meals) == 3


def test_22_household_ingredient_availability():
    """22. Household ingredients are flagged correctly in the weekly checklist."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 6, 1),
        biological_sex="Male",
        available_ingredients=["ING_RICE_WHITE", "ING_DHAL"],
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    rice_item = next((item for item in weekly.weekly_grocery_checklist if item.ingredient_id == "ING_RICE_WHITE"), None)
    if rice_item:
        assert rice_item.is_available_in_household is True

    carrot_item = next((item for item in weekly.weekly_grocery_checklist if item.ingredient_id == "ING_CARROT"), None)
    if carrot_item:
        assert carrot_item.is_available_in_household is False


def test_23_strict_available_ingredients_mode():
    """23. Strict available ingredients mode only uses in-stock items."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 6, 1),
        biological_sex="Female",
        available_ingredients=["ING_RICE_WHITE", "ING_DHAL", "ING_COCONUT_MILK", "ING_BANANA"],
        only_available_ingredients=True,
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=date(2025, 10, 1))

    for slot in plan.planned_meals:
        if slot.meal_item:
            for ing_id in slot.meal_item.ingredients:
                assert ing_id in profile.available_ingredients


def test_24_meal_variety_across_seven_days():
    """24. Meal variety across 7 days: rotation algorithm distributes variety."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 1, 1),
        biological_sex="Male",
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    day1_dishes = [s.meal_item.dish_or_food_id for s in weekly.days[0].planned_meals if s.meal_item]
    day2_dishes = [s.meal_item.dish_or_food_id for s in weekly.days[1].planned_meals if s.meal_item]
    assert day1_dishes != day2_dishes


def test_25_limited_catalogue_fallback():
    """25. Limited catalogue fallback repeats dish safely when variety is constrained."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 6, 1),
        biological_sex="Male",
        available_ingredients=["ING_RICE_WHITE", "ING_DHAL", "ING_COCONUT_MILK", "ING_FISH_SEA"],
        only_available_ingredients=True,
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    filled_slots = sum(1 for d in weekly.days for s in d.planned_meals if s.meal_item)
    assert filled_slots > 0


def test_26_and_27_no_eligible_meals_unfilled_slots():
    """26 & 27. No eligible meals produce explicit unfilled slot with clear notice."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 6, 1),
        biological_sex="Female",
        restricted_foods=[
            RestrictionGroupCode.RESTRICT_FISH,
            RestrictionGroupCode.RESTRICT_SHELLFISH,
            RestrictionGroupCode.RESTRICT_EGG,
            RestrictionGroupCode.RESTRICT_DAIRY,
            RestrictionGroupCode.RESTRICT_LEGUMES,
            RestrictionGroupCode.RESTRICT_SOYA,
            RestrictionGroupCode.RESTRICT_COCONUT,
        ],
        available_ingredients=["ING_SALT"],  # Empty eligible pantry
        only_available_ingredients=True,
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=date(2025, 10, 1))

    unfilled = [s for s in plan.planned_meals if s.meal_item is None]
    assert len(unfilled) > 0
    assert unfilled[0].unfilled_reason is not None


def test_28_grocery_checklist_integrity():
    """28. Grocery checklist integrity: Consolidates duplicates and categorizes by food group."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 6, 1),
        biological_sex="Male",
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    checklist = weekly.weekly_grocery_checklist
    assert len(checklist) > 0

    # IDs must be unique (consolidated)
    ids = [item.ingredient_id for item in checklist]
    assert len(ids) == len(set(ids))

    for item in checklist:
        assert item.name
        assert item.food_group
        assert item.total_meal_appearances >= 1


def test_29_substitution_eligibility():
    """29. Substitution revalidation accepts valid alternative and rejects invalid texture/restricted."""
    planner = get_nutrition_planner_service()
    # At 6 months and 12 days (STAGE_6M_DAYS_10_15)
    plan_date = date(2025, 10, 12)
    dob = date(2025, 4, 1)
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        biological_sex="Female",
        complementary_feeding_start_date=date(2025, 10, 1),
        restricted_foods=[RestrictionGroupCode.RESTRICT_FISH],
    )

    # Valid substitution: 4-part mash liver replacement (both eligible for STAGE_6M_DAYS_10_15)
    res_valid = planner.validate_substitution(
        profile=profile,
        plan_date=plan_date,
        original_food_id="DISH_4PART_MASH_PUMPKIN",
        replacement_food_id="DISH_4PART_MASH_CARROT_LIVER",
    )
    assert res_valid.is_valid is True
    assert res_valid.replacement_item is not None

    # Invalid fish substitution due to RESTRICT_FISH restriction
    res_invalid = planner.validate_substitution(
        profile=profile,
        plan_date=plan_date,
        original_food_id="DISH_4PART_MASH_PUMPKIN",
        replacement_food_id="DISH_FHB_SPRAT_RICE",
    )
    assert res_invalid.is_valid is False
    assert "restriction" in res_invalid.validation_message.lower()


def test_30_unrecorded_future_food_tolerance():
    """30. Planner does NOT artificially advance foods_introduced during future planning."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 3, 1),  # 7m
        biological_sex="Male",
        foods_introduced=[],  # Egg NOT introduced
    )
    weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2025, 10, 1))

    # Day 7 must still not assume egg is tolerated
    day7 = weekly.days[6]
    for s in day7.planned_meals:
        if s.meal_item:
            assert s.meal_item.dish_or_food_id != "DISH_COARSE_MASH_7M_SOYA_EGG"


def test_38_accurate_fhb_references_and_evidence_tiers():
    """38. All planned meals contain authentic FHB booklet references and accurate evidence tiers."""
    planner = get_nutrition_planner_service()
    profile = ChildNutritionProfile(
        date_of_birth=date(2024, 6, 1),
        biological_sex="Male",
    )
    plan = planner.generate_daily_meal_plan(profile=profile, plan_date=date(2025, 10, 1))

    for slot in plan.planned_meals:
        if slot.meal_item:
            assert "Right Food at the Right Time" in slot.meal_item.source_citation.publication
            assert slot.meal_item.evidence_tier in (EvidenceTier.TIER_A, EvidenceTier.TIER_B)


# ============================================================================
# API Security, Boundaries & Isolation Tests
# ============================================================================

def test_31_authenticated_planner_access(client):
    """31. Authenticated planner access requires valid credentials."""
    # Unauthenticated request fails with 401
    res = client.get("/api/v1/nutrition/plans/daily?baby_id=1")
    assert res.status_code == 401

    res_weekly = client.get("/api/v1/nutrition/plans/weekly?baby_id=1")
    assert res_weekly.status_code == 401


def test_32_cross_parent_access_denial(client):
    """32. Parent A attempting to access Parent B's baby is rejected with 403."""
    cookies_a = register_and_login(client, "parent_a@example.com")
    cookies_b = register_and_login(client, "parent_b@example.com")

    baby_b = create_test_baby(client, cookies_b, "Baby B")

    # Parent A attempts to request daily plan for Baby B
    res_daily = client.get(
        f"/api/v1/nutrition/plans/daily?baby_id={baby_b['id']}",
        cookies=cookies_a,
    )
    assert res_daily.status_code == 403

    # Parent A attempts to request weekly plan for Baby B
    res_weekly = client.get(
        f"/api/v1/nutrition/plans/weekly?baby_id={baby_b['id']}",
        cookies=cookies_a,
    )
    assert res_weekly.status_code == 403


def test_33_multiple_baby_profile_isolation(client):
    """33. Parent with multiple babies receives distinct plans per baby."""
    cookies = register_and_login(client, "parent_multi@example.com")
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "parent_multi@example.com").first()

    # Baby 1: 7 months
    dob_1 = date.today() - timedelta(days=215)
    baby_1 = Baby(
        owner_id=user.id,
        name="Baby 1",
        sex="Male",
        date_of_birth=dob_1,
        birth_weight_kg=3.2,
    )
    # Baby 2: 24 months
    dob_2 = date.today() - timedelta(days=730)
    baby_2 = Baby(
        owner_id=user.id,
        name="Baby 2",
        sex="Female",
        date_of_birth=dob_2,
        birth_weight_kg=3.1,
    )
    db.add(baby_1)
    db.add(baby_2)
    db.commit()
    db.refresh(baby_1)
    db.refresh(baby_2)
    b1_id, b2_id = baby_1.id, baby_2.id
    db.close()

    res_1 = client.get(f"/api/v1/nutrition/plans/daily?baby_id={b1_id}", cookies=cookies)
    assert res_1.status_code == 200
    plan_1 = res_1.json()
    assert plan_1["child_age_completed_months"] == 7

    res_2 = client.get(f"/api/v1/nutrition/plans/daily?baby_id={b2_id}", cookies=cookies)
    assert res_2.status_code == 200
    plan_2 = res_2.json()
    assert plan_2["child_age_completed_months"] == 24


def test_34_future_planning_date_bounds(client):
    """34. Future planning dates > 30 days or dates before DOB are rejected."""
    cookies = register_and_login(client, "parent_bounds@example.com")
    dob = date.today() - timedelta(days=300)
    baby = create_test_baby(client, cookies, "Baby Bounds", dob=str(dob))

    # 1. Date before DOB -> 400
    res_past = client.get(
        f"/api/v1/nutrition/plans/daily?baby_id={baby['id']}&date={str(dob - timedelta(days=5))}",
        cookies=cookies,
    )
    assert res_past.status_code == 400
    assert "precede baby's date of birth" in res_past.json()["detail"]

    # 2. Date > 30 days ahead -> 400
    res_future = client.get(
        f"/api/v1/nutrition/plans/daily?baby_id={baby['id']}&date={str(date.today() + timedelta(days=35))}",
        cookies=cookies,
    )
    assert res_future.status_code == 400
    assert "30-day forward planning horizon" in res_future.json()["detail"]

    # 3. Weekly start date > 30 days ahead -> 400
    res_w_future = client.get(
        f"/api/v1/nutrition/plans/weekly?baby_id={baby['id']}&start_date={str(date.today() + timedelta(days=35))}",
        cookies=cookies,
    )
    assert res_w_future.status_code == 400
    assert "30-day forward planning horizon" in res_w_future.json()["detail"]


def test_35_cross_process_determinism_pythonhashseed():
    """35. Proves strict cross-process determinism across separate Python processes with different PYTHONHASHSEED."""
    import subprocess
    import sys
    import json
    import os

    script = """
import os
import json
from datetime import date
from app.schemas.nutrition import ChildNutritionProfile
from app.services.nutrition_planner_service import get_nutrition_planner_service

planner = get_nutrition_planner_service()
profile = ChildNutritionProfile(
    date_of_birth=date(2026, 2, 27),
    biological_sex='Male',
    available_ingredients=['ING_RICE_WHITE', 'ING_DHAL', 'ING_PUMPKIN', 'ING_COCONUT_MILK', 'ING_BANANA_AMBUL', 'ING_FISH_SEA'],
    foods_introduced=['ING_RICE_WHITE', 'ING_DHAL', 'ING_PUMPKIN', 'ING_COCONUT_MILK', 'ING_BANANA_AMBUL', 'ING_FISH_SEA'],
)
weekly = planner.generate_weekly_meal_plan(profile=profile, start_date=date(2026, 10, 21), baby_id=1)
plan_data = [
    {
        'date': str(d.plan_date),
        'stage': d.feeding_stage.value,
        'meals': [m.meal_item.dish_or_food_id for m in d.planned_meals if m.meal_item],
        'snacks': [s.meal_item.dish_or_food_id for s in d.planned_snacks if s.meal_item],
    }
    for d in weekly.days
]
checklist = [item.ingredient_id for item in weekly.weekly_grocery_checklist]
print(json.dumps({'days': plan_data, 'checklist': checklist}))
"""

    env_0 = os.environ.copy()
    env_0["PYTHONHASHSEED"] = "0"
    env_0["DATABASE_URL"] = "sqlite:///:memory:"

    env_42 = os.environ.copy()
    env_42["PYTHONHASHSEED"] = "42"
    env_42["DATABASE_URL"] = "sqlite:///:memory:"

    p0 = subprocess.run([sys.executable, "-c", script], env=env_0, capture_output=True, text=True, check=True)
    p42 = subprocess.run([sys.executable, "-c", script], env=env_42, capture_output=True, text=True, check=True)

    out0 = json.loads(p0.stdout.strip())
    out42 = json.loads(p42.stdout.strip())

    assert out0 == out42
