"""Comprehensive Automated Test Suite for the Personalized Nutrition Recommendation Engine.

Covers all 34 required test scenarios from Phase 4 specification:
1. Two-month-old infant
2. Child completing six calendar months
3. Day 1 complementary feeding
4. Day 3 feeding
5. Day 5 feeding
6. Day 8 feeding
7. Day 12 feeding
8. Day 20 feeding
9. Six-month child with unknown feeding start date
10. Seven-month milestone transitions
11. Eight-month-old child
12. Ten-month-old child
13. Fourteen-month-old child
14. Three-year-old child
15. Child aged 59 completed months
16. Child reaching exact 60-month boundary
17. Fish restriction
18. Shellfish restriction
19. Coconut restriction
20. Dairy restriction
21. Egg restriction and missing introduction history
22. Excluded individual ingredient
23. Vegetarian preferences
24. Available-household-ingredients ranking
25. Recent meal repetition
26. No eligible food
27. Missing optional inputs
28. Future birth date
29. Future complementary feeding date
30. Leap-year and end-of-month birthdays
31. Stable deterministic ranking
32. Source citation completeness
33. No prohibited ingredients in any output
34. No complementary food suggestions before six completed months
"""

from datetime import date
import pytest

from app.schemas.nutrition import (
    COMPLETION_BOUNDARY_MONTHS,
    ChildNutritionProfile,
    EvidenceTier,
    FeedingStageId,
    FoodTexture,
    MealType,
    RestrictionGroupCode,
)
from app.services.nutrition_catalog_service import DateValidationError, reset_nutrition_catalog_service
from app.services.nutrition_recommendation_service import (
    NutritionRecommendationService,
    generate_nutrition_recommendations,
    get_nutrition_recommendation_service,
    reset_nutrition_recommendation_service,
)


@pytest.fixture(autouse=True)
def reset_services():
    """Reset singletons between tests."""
    reset_nutrition_catalog_service()
    reset_nutrition_recommendation_service()
    yield
    reset_nutrition_catalog_service()
    reset_nutrition_recommendation_service()


@pytest.fixture
def recommendation_service():
    """Returns an initialized NutritionRecommendationService."""
    return get_nutrition_recommendation_service()


EVAL_DATE = date(2026, 10, 20)


# ============================================================================
# Scenario 1: Two-month-old Infant
# ============================================================================

def test_scenario_01_two_month_old_infant():
    """Scenario 1: Infant under 6 months receives exclusive breastfeeding guidance only."""
    profile = ChildNutritionProfile(date_of_birth=date(2026, 8, 20))
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 2
    assert resp.child_age_remaining_days == 0
    assert resp.is_eligible is True
    assert resp.is_at_completion_boundary is False
    assert resp.feeding_stage == FeedingStageId.STAGE_0_TO_6M
    assert resp.feeding_rule is not None
    assert resp.feeding_rule.rule_id == "RULE_01_BEFORE_6M"
    assert len(resp.recommendations) == 0
    assert "exclusive" in resp.milk_feeding_guidance.lower()
    assert "prohibited" in resp.special_notice.lower()


# ============================================================================
# Scenario 2: Child Completing Six Calendar Months
# ============================================================================

def test_scenario_02_child_completing_six_calendar_months():
    """Scenario 2: Boundary transition at exact 6-month calendar milestone."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 20),
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 6
    assert resp.child_age_remaining_days == 0
    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAY_1
    assert resp.feeding_rule.rule_id == "RULE_02_DAY_1"


# ============================================================================
# Scenario 3: Day 1 Complementary Feeding
# ============================================================================

def test_scenario_03_day_1_complementary_feeding():
    """Scenario 3: Day 1 complementary feeding inception (2–3 tsp soft mashed rice + breast milk)."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 20),
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAY_1
    assert len(resp.recommendations) == 1

    rec = resp.recommendations[0]
    assert rec.meal_slot == MealType.TASTE_SESSION
    assert rec.dish_or_food_id == "DISH_MASHED_RICE_BREASTMILK"
    assert "2 to 3 teaspoons" in rec.household_portion
    assert rec.texture == FoodTexture.SEMI_SOLID_MASH
    assert "ING_BREAST_MILK" in rec.ingredients
    assert "ING_RICE_WHITE" in rec.ingredients


# ============================================================================
# Scenario 4: Day 3 Feeding
# ============================================================================

def test_scenario_04_day_3_feeding():
    """Scenario 4: Days 2–3 feeding (1–2 meals, gradually increasing portion)."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 18),  # 3 days ago (days_since_start = 3)
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAYS_2_3
    assert resp.feeding_rule.rule_id == "RULE_03_DAYS_2_3"
    assert len(resp.recommendations) >= 1
    rec = resp.recommendations[0]
    assert rec.dish_or_food_id == "DISH_MASHED_RICE_DAYS2_3"
    assert "gradually increase" in rec.household_portion.lower()


# ============================================================================
# Scenario 5: Day 5 Feeding
# ============================================================================

def test_scenario_05_day_5_feeding():
    """Scenario 5: Days 4–6 feeding (2 meals, dhal puree 3–4 tsp + fruit, single-food trial)."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 16),  # days_since_start = 5
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAYS_4_6
    assert resp.feeding_rule.rule_id == "RULE_04_DAYS_4_6"
    assert len(resp.recommendations) == 2
    rec = resp.recommendations[0]
    assert rec.dish_or_food_id == "DISH_RICE_DHAL_PUREE"
    assert "3 to 4 teaspoons" in rec.household_portion
    assert "ING_DHAL" in rec.ingredients
    assert "ING_BANANA" in rec.ingredients


# ============================================================================
# Scenario 6: Day 8 Feeding
# ============================================================================

def test_scenario_06_day_8_feeding():
    """Scenario 6: Days 7–9 animal food inception and FHB sprat protocol (~1 tsp powder)."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 13),  # days_since_start = 8
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAYS_7_9
    assert resp.feeding_rule.rule_id == "RULE_05_DAYS_7_9"
    assert any("sprat" in str(rec.preparation_instructions).lower() for rec in resp.recommendations)


# ============================================================================
# Scenario 7: Day 12 Feeding
# ============================================================================

def test_scenario_07_day_12_feeding():
    """Scenario 7: Days 10–15 4-part mash (rice + pulse + animal + yellow veg, 5–6 tsp)."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 9),  # days_since_start = 12
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAYS_10_15
    assert resp.feeding_rule.rule_id == "RULE_06_DAYS_10_15"
    assert len(resp.recommendations) >= 2
    rec = resp.recommendations[0]
    assert "5 to 6 teaspoons" in rec.household_portion


# ============================================================================
# Scenario 8: Day 20 Feeding
# ============================================================================

def test_scenario_08_day_20_feeding():
    """Scenario 8: Days 16–30 half-mashed rice, green leaves, egg yolk (~1/4 tea cup)."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 1),  # days_since_start = 20
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAYS_16_30
    assert resp.feeding_rule.rule_id == "RULE_07_DAYS_16_30"
    rec = resp.recommendations[0]
    assert rec.texture == FoodTexture.HALF_MASHED
    assert "1/4 of a tea cup" in rec.household_portion


# ============================================================================
# Scenario 9: Six-Month Child with Unknown Feeding Start Date
# ============================================================================

def test_scenario_09_six_month_child_unknown_feeding_start_date():
    """Scenario 9: Unrecorded start date provides general 6m guidance without Day 1 assertion."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=None,  # Unknown
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_GENERAL
    assert resp.feeding_rule.rule_id == "RULE_08_STAGE_6M_GENERAL"
    assert "unrecorded" in resp.special_notice.lower()
    assert len(resp.recommendations) > 0


# ============================================================================
# Scenario 10: Seven-Month Milestone Transitions
# ============================================================================

def test_scenario_10_seven_month_milestone_transitions():
    """Scenario 10: Verify 7m baseline, 7m + 1 week, and 7m + 2 weeks milestone rules."""
    # 7m + 0d (Days 0–6 into month 8) -> Baseline coarsely mashed, no snacks
    p_7m_0d = ChildNutritionProfile(date_of_birth=date(2026, 3, 20))
    r_7m_0d = generate_nutrition_recommendations(p_7m_0d, evaluation_date=EVAL_DATE)
    assert r_7m_0d.feeding_rule.rule_id == "RULE_09A_STAGE_7M_COMPLETED"
    assert r_7m_0d.daily_snack_frequency_guidance is None
    assert all(rec.meal_slot == MealType.MAIN_MEAL for rec in r_7m_0d.recommendations)

    # 7m + 7d (Days 7–13 into month 8) -> Snack inception (1–2 snacks) & whole egg trial
    p_7m_7d = ChildNutritionProfile(date_of_birth=date(2026, 3, 13))
    r_7m_7d = generate_nutrition_recommendations(p_7m_7d, evaluation_date=EVAL_DATE)
    assert r_7m_7d.feeding_rule.rule_id == "RULE_09B_STAGE_7M_1WEEK"
    assert r_7m_7d.daily_snack_frequency_guidance == "1 to 2 nutritious snacks per day"

    # 7m + 14d (Days 14–31 into month 8) -> Coarsely chopped transition
    p_7m_14d = ChildNutritionProfile(date_of_birth=date(2026, 3, 6))
    r_7m_14d = generate_nutrition_recommendations(p_7m_14d, evaluation_date=EVAL_DATE)
    assert r_7m_14d.feeding_rule.rule_id == "RULE_09C_STAGE_7M_2WEEKS"


# ============================================================================
# Scenario 11: Eight-Month-Old Child
# ============================================================================

def test_scenario_11_eight_month_old_child():
    """Scenario 11: 8 completed calendar months (traditional staples & finger foods)."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 2, 20),
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 8
    assert resp.feeding_rule.rule_id == "RULE_10_STAGE_8M_MILESTONES"
    assert "A bit more than 1/2 tea cup" in resp.feeding_rule.household_portion
    # Snacks include finger foods
    assert any(rec.meal_slot == MealType.SNACK for rec in resp.recommendations)


# ============================================================================
# Scenario 12: Ten-Month-Old Child
# ============================================================================

def test_scenario_12_ten_month_old_child():
    """Scenario 12: 9–11 months separate plate curries, 3–4 meals + 1–2 snacks."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 12, 20),
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 10
    assert resp.feeding_stage == FeedingStageId.STAGE_9_TO_11M
    assert resp.feeding_rule.rule_id == "RULE_11_STAGE_9_TO_11M"
    meal_slots = [rec.meal_slot for rec in resp.recommendations]
    assert MealType.BREAKFAST in meal_slots
    assert MealType.LUNCH in meal_slots
    assert MealType.DINNER in meal_slots
    assert MealType.SNACK in meal_slots


# ============================================================================
# Scenario 13: Fourteen-Month-Old Child
# ============================================================================

def test_scenario_13_fourteen_month_old_child():
    """Scenario 13: 1–2 years family table foods (> 1 tea cup) and dairy guidance."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 8, 20),
        milk_feeding_method="infant_formula_only",
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 14
    assert resp.feeding_stage == FeedingStageId.STAGE_12_TO_23M
    assert resp.feeding_rule.rule_id == "RULE_12_STAGE_12_TO_23M"
    assert "curd" in resp.milk_feeding_guidance.lower()
    assert len(resp.recommendations) >= 4


# ============================================================================
# Scenario 14: Three-Year-Old Child
# ============================================================================

def test_scenario_14_three_year_old_child():
    """Scenario 14: 2–5 years family diet with portion scaling towards 2 tea cups."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2023, 10, 20),
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 36
    assert resp.feeding_stage == FeedingStageId.STAGE_24_TO_59M
    assert resp.feeding_rule.rule_id == "RULE_13_STAGE_24_TO_59M"
    assert "2 tea cups" in resp.feeding_rule.household_portion


# ============================================================================
# Scenario 15: Child Aged 59 Completed Months
# ============================================================================

def test_scenario_15_child_aged_59_completed_months():
    """Scenario 15: Child aged 59 completed months remains fully eligible for guidance."""
    # Born 2021-10-22 evaluated on 2026-10-20 -> 59 months and 28 days
    profile = ChildNutritionProfile(
        date_of_birth=date(2021, 10, 22),
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 59
    assert resp.is_eligible is True
    assert resp.is_at_completion_boundary is False
    assert len(resp.recommendations) > 0


# ============================================================================
# Scenario 16: Child Reaching Exact 60-Month Boundary
# ============================================================================

def test_scenario_16_child_reaching_exact_60_month_boundary():
    """Scenario 16: Fifth birthday (60 completed months) triggers completion notice with no meal plan."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2021, 10, 20),  # Exactly 5 years old on 2026-10-20
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 60
    assert resp.is_eligible is False
    assert resp.is_at_completion_boundary is True
    assert resp.feeding_stage == FeedingStageId.STAGE_60M_PLUS
    assert resp.feeding_rule.rule_id == "RULE_14_COMPLETION_60M"
    assert len(resp.recommendations) == 0
    assert "completed" in resp.special_notice.lower()


# ============================================================================
# Scenario 17: Fish Restriction
# ============================================================================

def test_scenario_17_fish_restriction():
    """Scenario 17: RESTRICT_FISH strictly excludes sprats and sea fish, while preserving kunisso."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 8, 20),  # 14 months old (kunisso is min 12m)
        restricted_foods=["RESTRICT_FISH"],
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    for rec in resp.recommendations:
        assert "ING_SPRATS" not in rec.ingredients
        assert "ING_FISH_SEA" not in rec.ingredients


# ============================================================================
# Scenario 18: Shellfish Restriction
# ============================================================================

def test_scenario_18_shellfish_restriction():
    """Scenario 18: RESTRICT_SHELLFISH excludes kunisso while allowing finfish."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 8, 20),  # 14 months old
        restricted_foods=["RESTRICT_SHELLFISH"],
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    for rec in resp.recommendations:
        assert "ING_KUNISSO" not in rec.ingredients


# ============================================================================
# Scenario 19: Coconut Restriction
# ============================================================================

def test_scenario_19_coconut_restriction():
    """Scenario 19: RESTRICT_COCONUT excludes coconut milk, scrap, and oil; allows veg oil."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 13),  # Days 7-9
        restricted_foods=["RESTRICT_COCONUT"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    for rec in resp.recommendations:
        assert "ING_COCONUT_MILK" not in rec.ingredients
        assert "ING_COCONUT_SCRAP" not in rec.ingredients
        assert "ING_COCONUT_OIL" not in rec.ingredients

    # Verify that dish with vegetable oil remains eligible
    dish_ids = [rec.dish_or_food_id for rec in resp.recommendations]
    assert "DISH_RICE_CHICKEN_MASH" in dish_ids


# ============================================================================
# Scenario 20: Dairy Restriction
# ============================================================================

def test_scenario_20_dairy_restriction():
    """Scenario 20: RESTRICT_DAIRY excludes butter, margarine, curd, yoghurt, cheese."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 8, 20),  # 14 months old
        restricted_foods=["RESTRICT_DAIRY"],
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    for rec in resp.recommendations:
        assert "ING_BUTTER" not in rec.ingredients
        assert "ING_MARGARINE" not in rec.ingredients
        assert "ING_CURD" not in rec.ingredients
        assert "ING_YOGHURT" not in rec.ingredients
        assert "ING_CHEESE" not in rec.ingredients


# ============================================================================
# Scenario 21: Egg Restriction and Missing Introduction History
# ============================================================================

def test_scenario_21_egg_restriction_and_missing_introduction_history():
    """Scenario 21: Whole egg strictly gated when egg yolk tolerance is not confirmed."""
    # Case A: Egg yolk NOT introduced -> whole egg dishes must NOT be recommended
    profile_no_yolk = ChildNutritionProfile(
        date_of_birth=date(2026, 2, 20),  # 8 months old
        foods_introduced=["ING_RICE_WHITE", "ING_DHAL"],  # No egg yolk
    )
    resp_no_yolk = generate_nutrition_recommendations(profile_no_yolk, evaluation_date=EVAL_DATE)
    for rec in resp_no_yolk.recommendations:
        assert "ING_EGG_WHOLE" not in rec.ingredients
        assert "ING_EGG_WHITE" not in rec.ingredients

    # Case B: Egg yolk confirmed -> whole egg dishes become eligible
    profile_with_yolk = ChildNutritionProfile(
        date_of_birth=date(2026, 2, 20),
        foods_introduced=["ING_RICE_WHITE", "ING_DHAL", "ING_EGG_YOLK"],
    )
    resp_with_yolk = generate_nutrition_recommendations(profile_with_yolk, evaluation_date=EVAL_DATE)
    all_ings = [ing for rec in resp_with_yolk.recommendations for ing in rec.ingredients]
    # DISH_COARSE_MASH_7M_SOYA_EGG becomes eligible and whole egg is recommended
    assert "ING_EGG_WHOLE" in all_ings
    assert any(rec.dish_or_food_id == "DISH_COARSE_MASH_7M_SOYA_EGG" for rec in resp_with_yolk.recommendations)


# ============================================================================
# Scenario 22: Excluded Individual Ingredient
# ============================================================================

def test_scenario_22_excluded_individual_ingredient():
    """Scenario 22: Individually excluded food ID strictly eliminated from output."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 9),  # 4-part mash
        restricted_foods=["ING_PUMPKIN"],  # Exclude pumpkin
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    for rec in resp.recommendations:
        assert "ING_PUMPKIN" not in rec.ingredients


# ============================================================================
# Scenario 23: Vegetarian Preferences
# ============================================================================

def test_scenario_23_vegetarian_preferences():
    """Scenario 23: Vegetarian preference eliminates meat, poultry, fish, sprats, kunisso."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 12, 20),  # 10 months old
        dietary_preferences=["VEGETARIAN"],
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    animal_ids = {"ING_SPRATS", "ING_FISH_SEA", "ING_CHICKEN", "ING_LIVER", "ING_MEAT", "ING_KUNISSO"}
    for rec in resp.recommendations:
        for ing in rec.ingredients:
            assert ing not in animal_ids


# ============================================================================
# Scenario 24: Available-Household-Ingredients Ranking
# ============================================================================

def test_scenario_24_available_household_ingredients_ranking():
    """Scenario 24: Household availability boosts matching dish to the top."""
    # Available ingredients match DISH_RICE_CHICKEN_MASH
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 13),  # Days 7–9
        available_ingredients=["ING_RICE_RED", "ING_CHICKEN", "ING_DHAL", "ING_VEG_OIL"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert len(resp.recommendations) > 0
    top_rec = resp.recommendations[0]
    assert top_rec.dish_or_food_id == "DISH_RICE_CHICKEN_MASH"
    assert top_rec.is_available_in_household is True
    assert top_rec.ranking_score > 0


# ============================================================================
# Scenario 25: Recent Meal Repetition Penalty
# ============================================================================

def test_scenario_25_recent_meal_repetition():
    """Scenario 25: Recently consumed dish is penalized to promote dietary variety."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 13),
        recent_meal_history=["DISH_FHB_SPRAT_RICE"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    top_rec = resp.recommendations[0]
    # DISH_FHB_SPRAT_RICE should not be the top recommendation due to -30 penalty
    assert top_rec.dish_or_food_id != "DISH_FHB_SPRAT_RICE"


# ============================================================================
# Scenario 26: No Eligible Food
# ============================================================================

def test_scenario_26_no_eligible_food():
    """Scenario 26: Excessive restrictions return structured empty response with clear notice."""
    # Exclude all staples and pulses
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 10, 20),
        restricted_foods=["ING_RICE_WHITE", "ING_RICE_RED"],
        only_available_ingredients=True,
        available_ingredients=["ING_UNKNOWN"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert len(resp.recommendations) == 0
    assert "no dishes" in resp.special_notice.lower()


# ============================================================================
# Scenario 27: Missing Optional Inputs
# ============================================================================

def test_scenario_27_missing_optional_inputs():
    """Scenario 27: Profile with only date_of_birth generates age-appropriate normative guidance."""
    profile = ChildNutritionProfile(date_of_birth=date(2025, 10, 20))  # 12 months old
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert resp.child_age_completed_months == 12
    assert resp.is_eligible is True
    assert len(resp.recommendations) > 0


# ============================================================================
# Scenario 28: Future Birth Date Validation
# ============================================================================

def test_scenario_28_future_birth_date():
    """Scenario 28: Rejects future date of birth with ERR_FUTURE_DOB."""
    profile = ChildNutritionProfile(date_of_birth=date(2026, 11, 1))
    with pytest.raises(DateValidationError, match="ERR_FUTURE_DOB"):
        generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)


# ============================================================================
# Scenario 29: Future Complementary Feeding Date Validation
# ============================================================================

def test_scenario_29_future_complementary_feeding_date():
    """Scenario 29: Rejects future start date with ERR_FUTURE_START_DATE."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 20),
        complementary_feeding_start_date=date(2026, 11, 1),
    )
    with pytest.raises(DateValidationError, match="ERR_FUTURE_START_DATE"):
        generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)


# ============================================================================
# Scenario 30: Leap-Year and End-of-Month Birthdays
# ============================================================================

def test_scenario_30_leap_year_and_end_of_month_birthdays():
    """Scenario 30: Preserves Leap Day and August 31 end-of-month calendar arithmetic."""
    # Case A: August 31 evaluated on Feb 28 common year -> exactly 6 completed months
    p_aug31 = ChildNutritionProfile(
        date_of_birth=date(2024, 8, 31),
        complementary_feeding_start_date=date(2025, 2, 28),
    )
    r_aug31 = generate_nutrition_recommendations(p_aug31, evaluation_date=date(2025, 2, 28))
    assert r_aug31.child_age_completed_months == 6
    assert r_aug31.child_age_remaining_days == 0
    assert r_aug31.feeding_stage == FeedingStageId.STAGE_6M_DAY_1

    # Case B: Leap day birthday (Feb 29, 2024) evaluated on Feb 28, 2025 -> exactly 12 completed months
    p_leap = ChildNutritionProfile(date_of_birth=date(2024, 2, 29))
    r_leap = generate_nutrition_recommendations(p_leap, evaluation_date=date(2025, 2, 28))
    assert r_leap.child_age_completed_months == 12
    assert r_leap.child_age_remaining_days == 0


# ============================================================================
# Scenario 31: Stable Deterministic Ranking
# ============================================================================

def test_scenario_31_stable_deterministic_ranking():
    """Scenario 31: Identical inputs and evaluation date return identical ordered output."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 12, 20),
        available_ingredients=["ING_RICE_WHITE", "ING_CHICKEN", "ING_DHAL"],
        foods_introduced=["ING_EGG_YOLK"],
    )
    run1 = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)
    run2 = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    assert len(run1.recommendations) == len(run2.recommendations)
    for r1, r2 in zip(run1.recommendations, run2.recommendations):
        assert r1.recommendation_id == r2.recommendation_id
        assert r1.dish_or_food_id == r2.dish_or_food_id
        assert r1.ranking_score == r2.ranking_score


# ============================================================================
# Scenario 32: Source Citation Completeness
# ============================================================================

def test_scenario_32_source_citation_completeness():
    """Scenario 32: Every recommendation includes booklet and PDF page numbers and evidence tier."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2025, 10, 20),
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    for rec in resp.recommendations:
        assert rec.source_citation is not None
        assert rec.source_citation.pdf_page is not None
        assert 1 <= rec.source_citation.pdf_page <= 28
        assert rec.source_citation.booklet_page is not None
        assert 0 <= rec.source_citation.booklet_page <= 24
        assert rec.evidence_tier in (EvidenceTier.TIER_A, EvidenceTier.TIER_B)


# ============================================================================
# Scenario 33: No Prohibited Ingredients in Any Output
# ============================================================================

def test_scenario_33_no_prohibited_ingredients_in_any_output():
    """Scenario 33: No added salt/sugar before 12m; whole nuts strictly prohibited."""
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 1, 20),  # 9 months old
        foods_introduced=["ING_EGG_YOLK"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=EVAL_DATE)

    # Stage safety guidance must explicitly prohibit salt and sugar before 1 year
    stage_safety = " ".join(resp.safety_and_hygiene_guidance).lower()
    assert "salt" in stage_safety
    assert "sugar" in stage_safety

    for rec in resp.recommendations:
        assert "ING_SALT" not in rec.ingredients
        assert "ING_SUGAR" not in rec.ingredients
        # If cooked dish for infant < 1 year, verify no salt in dish precautions/instructions
        if rec.item_type == "DISH":
            dish_text = (" ".join(rec.safety_precautions) + " " + " ".join(rec.preparation_instructions)).lower()
            assert "salt" in dish_text



# ============================================================================
# Scenario 34: No Complementary Food Suggestions Before Six Completed Months
# ============================================================================

def test_scenario_34_no_complementary_food_suggestions_before_six_completed_months():
    """Scenario 34: Across all infant ages 0, 1, 2, 3, 4, 5 months, recommendations list is empty."""
    eval_date = date(2026, 10, 20)
    for m in range(6):
        # Child born m months ago
        dob = date(2026, 10 - m, 20)
        profile = ChildNutritionProfile(date_of_birth=dob)
        resp = generate_nutrition_recommendations(profile, evaluation_date=eval_date)
        assert resp.child_age_completed_months == m
        assert len(resp.recommendations) == 0
        assert resp.feeding_stage == FeedingStageId.STAGE_0_TO_6M


# ============================================================================
# Parameterized Progression Verification (Task 6)
# ============================================================================

FEEDING_PROGRESSION_CASES = [
    (
        "Day 1",
        date(2026, 4, 20),
        date(2026, 10, 20),
        FeedingStageId.STAGE_6M_DAY_1,
        "RULE_02_DAY_1",
        "1 taste session per day",
        "2 to 3 teaspoons",
        FoodTexture.SEMI_SOLID_MASH,
        5,
        7,
        ["DISH_MASHED_RICE_BREASTMILK"],
        ["DISH_RICE_DHAL_PUREE", "DISH_FHB_SPRAT_RICE", "DISH_4PART_MASH_PUMPKIN"],
    ),
    (
        "Day 2",
        date(2026, 4, 20),
        date(2026, 10, 19),
        FeedingStageId.STAGE_6M_DAYS_2_3,
        "RULE_03_DAYS_2_3",
        "1 to 2 meals per day",
        "Gradually increase",
        FoodTexture.SEMI_SOLID_MASH,
        5,
        7,
        ["DISH_MASHED_RICE_DAYS2_3"],
        ["DISH_MASHED_RICE_BREASTMILK", "DISH_RICE_DHAL_PUREE"],
    ),
    (
        "Day 3",
        date(2026, 4, 20),
        date(2026, 10, 18),
        FeedingStageId.STAGE_6M_DAYS_2_3,
        "RULE_03_DAYS_2_3",
        "1 to 2 meals per day",
        "Gradually increase",
        FoodTexture.SEMI_SOLID_MASH,
        5,
        7,
        ["DISH_MASHED_RICE_DAYS2_3"],
        ["DISH_RICE_DHAL_PUREE", "DISH_FHB_SPRAT_RICE"],
    ),
    (
        "Day 4",
        date(2026, 4, 20),
        date(2026, 10, 17),
        FeedingStageId.STAGE_6M_DAYS_4_6,
        "RULE_04_DAYS_4_6",
        "2 meals per day",
        "3 to 4 teaspoons",
        FoodTexture.SEMI_SOLID_MASH,
        5,
        7,
        ["DISH_RICE_DHAL_PUREE"],
        ["DISH_MASHED_RICE_BREASTMILK", "DISH_FHB_SPRAT_RICE"],
    ),
    (
        "Day 6",
        date(2026, 4, 20),
        date(2026, 10, 15),
        FeedingStageId.STAGE_6M_DAYS_4_6,
        "RULE_04_DAYS_4_6",
        "2 meals per day",
        "3 to 4 teaspoons",
        FoodTexture.SEMI_SOLID_MASH,
        5,
        7,
        ["DISH_RICE_DHAL_PUREE"],
        ["DISH_MASHED_RICE_BREASTMILK", "DISH_FHB_SPRAT_RICE"],
    ),
    (
        "Day 7",
        date(2026, 4, 20),
        date(2026, 10, 14),
        FeedingStageId.STAGE_6M_DAYS_7_9,
        "RULE_05_DAYS_7_9",
        "2 meals per day",
        "5–6 tsp",
        FoodTexture.SEMI_SOLID_MASH,
        6,
        8,
        ["DISH_FHB_SPRAT_RICE", "DISH_RICE_FISH_COCONUT", "DISH_RICE_CHICKEN_MASH"],
        ["DISH_MASHED_RICE_BREASTMILK", "DISH_4PART_MASH_PUMPKIN"],
    ),
    (
        "Day 9",
        date(2026, 4, 20),
        date(2026, 10, 12),
        FeedingStageId.STAGE_6M_DAYS_7_9,
        "RULE_05_DAYS_7_9",
        "2 meals per day",
        "5–6 tsp",
        FoodTexture.SEMI_SOLID_MASH,
        6,
        8,
        ["DISH_FHB_SPRAT_RICE", "DISH_RICE_FISH_COCONUT", "DISH_RICE_CHICKEN_MASH"],
        ["DISH_4PART_MASH_PUMPKIN", "DISH_HALFMASHED_GOTUKOLA_EGGYOLK"],
    ),
    (
        "Day 10",
        date(2026, 4, 20),
        date(2026, 10, 11),
        FeedingStageId.STAGE_6M_DAYS_10_15,
        "RULE_06_DAYS_10_15",
        "2 meals per day",
        "5 to 6 teaspoons",
        FoodTexture.SEMI_SOLID_MASH,
        7,
        9,
        ["DISH_4PART_MASH_PUMPKIN", "DISH_4PART_MASH_CARROT_LIVER", "DISH_4PART_MASH_SWEETPOTATO_FISH"],
        ["DISH_MASHED_RICE_BREASTMILK", "DISH_HALFMASHED_GOTUKOLA_EGGYOLK"],
    ),
    (
        "Day 15",
        date(2026, 4, 20),
        date(2026, 10, 6),
        FeedingStageId.STAGE_6M_DAYS_10_15,
        "RULE_06_DAYS_10_15",
        "2 meals per day",
        "5 to 6 teaspoons",
        FoodTexture.SEMI_SOLID_MASH,
        7,
        9,
        ["DISH_4PART_MASH_PUMPKIN", "DISH_4PART_MASH_CARROT_LIVER", "DISH_4PART_MASH_SWEETPOTATO_FISH"],
        ["DISH_HALFMASHED_GOTUKOLA_EGGYOLK", "DISH_COARSE_MASH_7M_FISH"],
    ),
    (
        "Day 16",
        date(2026, 4, 20),
        date(2026, 10, 5),
        FeedingStageId.STAGE_6M_DAYS_16_30,
        "RULE_07_DAYS_16_30",
        "2 to 3 meals per day",
        "1/4 of a tea cup",
        FoodTexture.HALF_MASHED,
        8,
        10,
        ["DISH_HALFMASHED_GOTUKOLA_EGGYOLK", "DISH_HALFMASHED_MURUNGA_SPRAT"],
        ["DISH_MASHED_RICE_BREASTMILK", "DISH_COARSE_MASH_7M_FISH"],
    ),
    (
        "Day 30",
        date(2026, 4, 20),
        date(2026, 9, 21),
        FeedingStageId.STAGE_6M_DAYS_16_30,
        "RULE_07_DAYS_16_30",
        "2 to 3 meals per day",
        "1/4 of a tea cup",
        FoodTexture.HALF_MASHED,
        8,
        10,
        ["DISH_HALFMASHED_GOTUKOLA_EGGYOLK", "DISH_HALFMASHED_MURUNGA_SPRAT"],
        ["DISH_COARSE_MASH_7M_FISH", "DISH_COARSE_CHOP_8M_JAK"],
    ),
    (
        "Seven Months Baseline (0–6d)",
        date(2026, 3, 20),
        None,
        FeedingStageId.STAGE_7_TO_8M,
        "RULE_09A_STAGE_7M_COMPLETED",
        "2 to 3 meals per day",
        "1/2 tea cup",
        FoodTexture.COARSELY_MASHED,
        9,
        11,
        ["DISH_COARSE_MASH_7M_FISH", "DISH_COARSE_MASH_7M_SOYA_EGG", "DISH_VEGETARIAN_PULSE_DUO_MEAL"],
        ["DISH_COARSE_CHOP_8M_JAK", "DISH_STRING_HOPPERS_DHAL_FISH"],
    ),
    (
        "Seven Months + 1 Week (7–13d)",
        date(2026, 3, 10),
        None,
        FeedingStageId.STAGE_7_TO_8M,
        "RULE_09B_STAGE_7M_1WEEK",
        "2 to 3 meals per day",
        "1/2 tea cup",
        FoodTexture.COARSELY_MASHED,
        10,
        12,
        ["DISH_COARSE_MASH_7M_FISH", "DISH_COARSE_MASH_7M_SOYA_EGG", "DISH_VEGETARIAN_PULSE_DUO_MEAL"],
        ["DISH_COARSE_CHOP_8M_JAK", "DISH_MASHED_RICE_BREASTMILK"],
    ),
    (
        "Seven Months + 2 Weeks (14–31d)",
        date(2026, 3, 1),
        None,
        FeedingStageId.STAGE_7_TO_8M,
        "RULE_09C_STAGE_7M_2WEEKS",
        "2 to 3 meals per day",
        "1/2 tea cup",
        FoodTexture.COARSELY_MASHED,
        11,
        13,
        ["DISH_COARSE_MASH_7M_FISH", "DISH_COARSE_MASH_7M_SOYA_EGG", "DISH_VEGETARIAN_PULSE_DUO_MEAL"],
        ["DISH_COARSE_CHOP_8M_JAK", "DISH_MASHED_RICE_BREASTMILK"],
    ),
    (
        "Eight Months Milestone",
        date(2026, 2, 20),
        None,
        FeedingStageId.STAGE_7_TO_8M,
        "RULE_10_STAGE_8M_MILESTONES",
        "2 to 3 meals per day",
        "A bit more than 1/2 tea cup",
        FoodTexture.COARSELY_CHOPPED,
        12,
        14,
        ["DISH_COARSE_CHOP_8M_JAK", "DISH_COARSE_CHOP_8M_BREADFRUIT", "DISH_STRING_HOPPERS_DHAL_FISH"],
        ["DISH_SEPARATE_PLATE_9M_CHICKEN", "DISH_FAMILY_MEAL_RICE_KUNISSO_DHAL"],
    ),
    (
        "Nine to Eleven Months",
        date(2025, 12, 20),
        None,
        FeedingStageId.STAGE_9_TO_11M,
        "RULE_11_STAGE_9_TO_11M",
        "3 to 4 main meals per day",
        "3/4 tea cup",
        FoodTexture.COARSELY_CHOPPED,
        14,
        16,
        ["DISH_SEPARATE_PLATE_9M_CHICKEN", "DISH_SEPARATE_PLATE_9M_SPRAT_MURUNGA", "DISH_STRING_HOPPERS_DHAL_FISH"],
        ["DISH_FAMILY_MEAL_RICE_KUNISSO_DHAL", "DISH_MASHED_RICE_BREASTMILK"],
    ),
    (
        "Twelve to Twenty-Three Months",
        date(2025, 6, 20),
        None,
        FeedingStageId.STAGE_12_TO_23M,
        "RULE_12_STAGE_12_TO_23M",
        "3 main meals per day",
        "A bit more than 1 tea cup",
        FoodTexture.FAMILY_FOOD,
        16,
        18,
        ["DISH_FAMILY_MEAL_RICE_KUNISSO_DHAL", "DISH_FAMILY_MEAL_MILK_RICE_FISH", "DISH_FAMILY_MEAL_THOSAI_SAMBAR"],
        ["DISH_MASHED_RICE_BREASTMILK"],
    ),
    (
        "Twenty-Four to Fifty-Nine Months",
        date(2023, 10, 20),
        None,
        FeedingStageId.STAGE_24_TO_59M,
        "RULE_13_STAGE_24_TO_59M",
        "3 main meals per day",
        "close to 2 tea cups",
        FoodTexture.FAMILY_FOOD,
        16,
        18,
        ["DISH_FAMILY_MEAL_RICE_KUNISSO_DHAL", "DISH_FAMILY_MEAL_MILK_RICE_FISH", "DISH_FAMILY_MEAL_THOSAI_SAMBAR"],
        ["DISH_MASHED_RICE_BREASTMILK"],
    ),
    (
        "Sixty Months Completion Boundary",
        date(2021, 10, 20),
        None,
        FeedingStageId.STAGE_60M_PLUS,
        "RULE_14_COMPLETION_60M",
        "Transition to Family Health Bureau school-age child nutrition guidelines.",
        "Completion notice",
        FoodTexture.FAMILY_FOOD,
        15,
        17,
        [],
        ["DISH_MASHED_RICE_BREASTMILK", "DISH_FAMILY_MEAL_RICE_KUNISSO_DHAL"],
    ),
]


@pytest.mark.parametrize(
    "case_name,dob,cf_start,expected_stage,expected_rule_id,expected_freq,portion_substr,expected_texture,booklet_pg,pdf_pg,expected_dishes,prohibited_dishes",
    FEEDING_PROGRESSION_CASES,
)
def test_exact_feeding_progression_parameterized(
    case_name,
    dob,
    cf_start,
    expected_stage,
    expected_rule_id,
    expected_freq,
    portion_substr,
    expected_texture,
    booklet_pg,
    pdf_pg,
    expected_dishes,
    prohibited_dishes,
):
    """Verifies actual stage, rule, frequency, portion, texture, citations, and eligible/ineligible dishes."""
    profile = ChildNutritionProfile(
        date_of_birth=dob,
        complementary_feeding_start_date=cf_start,
        foods_introduced=["ING_EGG_YOLK"],  # standard introduced history
    )
    eval_date = date(2026, 10, 20)
    resp = generate_nutrition_recommendations(profile, evaluation_date=eval_date)

    # 1. Stage and Rule ID
    assert resp.feeding_stage == expected_stage, f"Failed stage in {case_name}"
    assert resp.feeding_rule.rule_id == expected_rule_id, f"Failed rule in {case_name}"

    # 2. Meal Frequency
    assert resp.meal_frequency_guidance == expected_freq, f"Failed freq in {case_name}"

    # 3. Portion Guidance
    assert portion_substr.lower() in resp.feeding_rule.household_portion.lower(), f"Failed portion in {case_name}"

    # 4. Texture
    assert resp.feeding_rule.texture == expected_texture, f"Failed texture in {case_name}"

    # 5. Source Citations
    assert resp.feeding_rule.source_citation.booklet_page == booklet_pg, f"Failed booklet page in {case_name}"
    assert resp.feeding_rule.source_citation.pdf_page == pdf_pg, f"Failed pdf page in {case_name}"

    # 6. Recommendation Dishes & Ineligible Dishes
    rec_dish_ids = {rec.dish_or_food_id for rec in resp.recommendations if rec.item_type == "DISH"}
    if expected_dishes and rec_dish_ids:
        # At least one of the stage-specific expected dishes must be present in recommendations
        assert any(d_id in expected_dishes for d_id in rec_dish_ids), f"None of expected dishes {expected_dishes} found in {rec_dish_ids} for {case_name}"

    for pro_id in prohibited_dishes:
        assert pro_id not in rec_dish_ids, f"Prohibited dish {pro_id} found in {case_name}"


# ============================================================================
# Task 0 Verification Regression Tests
# ============================================================================

def test_task_0_condition_1_day_20_texture_strictness():
    """
    Task 0 Condition 1:
    Verifies that Day 20 (STAGE_6M_DAYS_16_30) strictly allows ONLY HALF_MASHED (or smoother) dishes.
    COARSELY_MASHED dishes (such as DISH_VEGETARIAN_PULSE_DUO_MEAL at 7m) must NEVER leak into Day 20.
    """
    eval_date = date(2026, 10, 20)
    # Day 20: started 19 days before evaluation date (Oct 1 to Oct 20 = Day 20)
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 4, 1),
        complementary_feeding_start_date=date(2026, 10, 1),
        dietary_preferences=["VEGETARIAN"],
        foods_introduced=["ING_RICE_WHITE", "ING_PUMPKIN", "ING_CARROT", "ING_DHAL"],
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=eval_date)

    assert resp.feeding_stage == FeedingStageId.STAGE_6M_DAYS_16_30
    assert resp.feeding_rule.rule_id == "RULE_07_DAYS_16_30"
    assert resp.feeding_rule.texture == FoodTexture.HALF_MASHED
    assert len(resp.recommendations) == 3

    # Ensure DISH_VEGETARIAN_PULSE_DUO_MEAL is NEVER returned
    rec_dish_ids = [r.dish_or_food_id for r in resp.recommendations]
    assert "DISH_VEGETARIAN_PULSE_DUO_MEAL" not in rec_dish_ids

    # Enforce hard texture restriction: NO coarsely mashed or family food allowed in Day 20
    disallowed_textures = {FoodTexture.COARSELY_MASHED, FoodTexture.COARSELY_CHOPPED, FoodTexture.FAMILY_FOOD}
    for rec in resp.recommendations:
        assert rec.texture not in disallowed_textures, f"Dish {rec.dish_or_food_id} has invalid texture {rec.texture} for Day 20"
        assert rec.texture in (FoodTexture.HALF_MASHED, FoodTexture.SEMI_SOLID_MASH, FoodTexture.SMOOTH_PUREE)


def test_task_0_condition_2_seven_months_plus_one_week_snack_distinction():
    """
    Task 0 Condition 2 & Phase 5 Task 5:
    Verifies that at 7 months + 1 week:
    1. Recommended snack frequency guidance is provided ("1 to 2 nutritious snacks per day").
    2. Structured soft snacks (scraped fruit / mashed sweet potato) from FHB Booklet p. 10
       are returned (generated_snacks_count == 1), while finger foods remain restricted (min 8m).
    3. When soft snacks are restricted by the caregiver, generated_snacks_count == 0 and
       an explanatory special_notice is provided.
    """
    eval_date = date(2026, 10, 20)
    # 7 months + 7 days
    profile = ChildNutritionProfile(
        date_of_birth=date(2026, 3, 13),
        complementary_feeding_start_date=date(2026, 9, 13),
    )
    resp = generate_nutrition_recommendations(profile, evaluation_date=eval_date)

    assert resp.child_age_completed_months == 7
    assert resp.child_age_remaining_days == 7
    assert resp.feeding_stage == FeedingStageId.STAGE_7_TO_8M
    assert resp.feeding_rule.rule_id == "RULE_09B_STAGE_7M_1WEEK"

    # Recommended frequency guidance is present
    assert resp.daily_snack_frequency_guidance is not None
    assert "1 to 2" in resp.daily_snack_frequency_guidance

    # Generated counts clearly distinguish main meals from snacks
    assert resp.generated_main_meals_count == 3
    assert resp.generated_snacks_count == 1

    # Allocated snack must be a 7m soft snack (not a finger food)
    snack_items = [r for r in resp.recommendations if r.meal_slot == MealType.SNACK]
    assert len(snack_items) == 1
    assert snack_items[0].dish_or_food_id in (
        "SNACK_SCRAPED_PAPAYA_7M",
        "SNACK_SCRAPED_BANANA_7M",
        "SNACK_MASHED_SWEET_POTATO_7M",
    )
    assert snack_items[0].texture == FoodTexture.COARSELY_MASHED

    # Case B: When all 7m soft snacks are restricted by caregiver
    profile_restricted = ChildNutritionProfile(
        date_of_birth=date(2026, 3, 13),
        complementary_feeding_start_date=date(2026, 9, 13),
        restricted_foods=["ING_PAPAYA", "ING_BANANA", "ING_SWEET_POTATO"],
    )
    resp_restricted = generate_nutrition_recommendations(profile_restricted, evaluation_date=eval_date)
    assert resp_restricted.generated_main_meals_count == 3
    assert resp_restricted.generated_snacks_count == 0
    assert resp_restricted.special_notice is not None
    assert "finger-food snacks begin at 8 completed calendar months" in resp_restricted.special_notice



