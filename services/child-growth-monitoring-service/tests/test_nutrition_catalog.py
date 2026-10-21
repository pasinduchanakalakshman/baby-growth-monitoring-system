"""Automated Test Suite for the Sri Lankan Nutrition Knowledge Base & Catalogue Service.

Verifies:
1. Successful catalogue loading & cardinality
2. Duplicate identifiers detection
3. Invalid ingredient references
4. Unsupported feeding stages
5. Missing preparation instructions
6. Invalid evidence references
7. Ingredient restriction mapping & fish vs shellfish distinction
8. Composite dish restrictions & filtering
9. Food substitution relationships & practical rotations
10. Correct classification of Tier A, B and C records
11. Valid age and feeding-stage eligibility metadata
12. Finalized 0–59 completed-month age scope
13. Exact 60-month completion boundary
14. February 29 and end-of-month calendar cases
15. Missing or corrupted catalogue files handling
16. Seven-month versus eight-month rule resolution (Task 7.1)
17. Seven-month milestone transitions (Task 7.2)
18. Duplicate or conflicting stage rules detection (Task 7.3)
19. Coconut restriction filtering (Task 7.4)
20. Excluded individual ingredients in substitutions (Task 7.5)
21. Stage-ineligible substitutes (Task 7.6)
22. Food-introduction eligibility conditions (Task 7.7)
23. Incorrect evidence-tier assignments (Task 7.8)
24. Invalid PDF page references (Task 7.9)
25. Missing required source references (Task 7.10)
26. Asia/Colombo date handling (Task 7.11)
27. Late starter transition rule neutral evidence (Task 6)
"""

import json
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import pytest
from pydantic import ValidationError

from app.schemas.nutrition import (
    COMPLETION_BOUNDARY_MONTHS,
    MAX_ELIGIBLE_COMPLETED_MONTHS,
    MIN_ELIGIBLE_COMPLETED_MONTHS,
    EvidenceTier,
    FeedingRuleRecord,
    FeedingStageId,
    FoodGroup,
    FoodSubstitutionRecord,
    FoodTexture,
    IngredientRecord,
    MealType,
    RestrictionGroupCode,
    SourceCitation,
)
from app.services.nutrition_catalog_service import (
    COLOMBO_TZ,
    CatalogueInitializationError,
    DateValidationError,
    NutritionCatalogService,
    calculate_calendar_age,
    get_colombo_today,
    get_nutrition_catalog_service,
    is_age_eligible,
    is_at_completion_boundary,
    reset_nutrition_catalog_service,
    validate_dates,
)


@pytest.fixture(autouse=True)
def reset_service():
    """Reset singleton between tests."""
    reset_nutrition_catalog_service()
    yield
    reset_nutrition_catalog_service()


@pytest.fixture
def catalog_service():
    """Returns an initialized NutritionCatalogService instance."""
    service = NutritionCatalogService()
    service.load_catalog()
    return service


# ============================================================================
# 1. Successful Catalogue Loading & Cardinality
# ============================================================================

def test_successful_catalog_loading(catalog_service):
    """Test 1: Verify catalogue loads cleanly with all verified components."""
    catalog = catalog_service.load_catalog()
    assert catalog is not None
    assert len(catalog.ingredients) == 49
    assert len(catalog.dishes) == 22
    assert len(catalog.snacks) == 19
    assert len(catalog.feeding_rules) == 17
    assert len(catalog.restrictions) == 9
    assert len(catalog.substitutions) == 7

    assert catalog.version == "2.1.0"
    assert catalog.min_age_months == 0
    assert catalog.max_age_months == 59
    assert catalog.completion_boundary_months == 60


# ============================================================================
# 2. Duplicate Identifiers Detection
# ============================================================================

def test_duplicate_ingredient_identifier_detection(tmp_path):
    """Test 2a: Duplicate food_id raises CatalogueInitializationError."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["dishes.json", "snacks.json", "feeding_rules.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    ings = json.loads((valid_dir / "ingredients.json").read_text(encoding="utf-8"))
    ings.append(ings[0])  # Duplicate first ingredient
    (tmp_path / "ingredients.json").write_text(json.dumps(ings), encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Duplicate ingredient ID found"):
        service.load_catalog()


def test_duplicate_dish_identifier_detection(tmp_path):
    """Test 2b: Duplicate dish_id raises CatalogueInitializationError."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["ingredients.json", "snacks.json", "feeding_rules.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    dishes = json.loads((valid_dir / "dishes.json").read_text(encoding="utf-8"))
    dishes.append(dishes[0])
    (tmp_path / "dishes.json").write_text(json.dumps(dishes), encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Duplicate dish ID found"):
        service.load_catalog()


# ============================================================================
# 3. Invalid Ingredient References
# ============================================================================

def test_invalid_ingredient_reference_in_dish(tmp_path):
    """Test 3: Dish referencing non-existent food_id raises error."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["ingredients.json", "snacks.json", "feeding_rules.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    dishes = json.loads((valid_dir / "dishes.json").read_text(encoding="utf-8"))
    dishes[0]["ingredients"].append("ING_NON_EXISTENT_FOOD")
    (tmp_path / "dishes.json").write_text(json.dumps(dishes), encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="references unknown ingredient 'ING_NON_EXISTENT_FOOD'"):
        service.load_catalog()


# ============================================================================
# 4. Unsupported Feeding Stages
# ============================================================================

def test_unsupported_feeding_stage(tmp_path):
    """Test 4: Dish referencing invalid feeding stage raises schema validation error."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["ingredients.json", "snacks.json", "feeding_rules.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    dishes = json.loads((valid_dir / "dishes.json").read_text(encoding="utf-8"))
    dishes[0]["eligible_stages"].append("STAGE_UNKNOWN_INVALID")
    (tmp_path / "dishes.json").write_text(json.dumps(dishes), encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Pydantic schema validation error"):
        service.load_catalog()


# ============================================================================
# 5. Missing Preparation Instructions
# ============================================================================

def test_missing_preparation_instructions_in_dish(tmp_path):
    """Test 5: Empty preparation steps in dish raises schema validation error."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["ingredients.json", "snacks.json", "feeding_rules.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    dishes = json.loads((valid_dir / "dishes.json").read_text(encoding="utf-8"))
    dishes[0]["preparation_steps"] = []  # empty
    (tmp_path / "dishes.json").write_text(json.dumps(dishes), encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Pydantic schema validation error"):
        service.load_catalog()


# ============================================================================
# 6. Invalid Evidence References
# ============================================================================

def test_invalid_evidence_tier(tmp_path):
    """Test 6: Invalid evidence tier raises schema validation error."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["ingredients.json", "dishes.json", "snacks.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    rules = json.loads((valid_dir / "feeding_rules.json").read_text(encoding="utf-8"))
    rules[0]["evidence_tier"] = "TIER_INVALID"
    (tmp_path / "feeding_rules.json").write_text(json.dumps(rules), encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Pydantic schema validation error"):
        service.load_catalog()


# ============================================================================
# 7. Ingredient Restriction Mapping & Fish vs Shellfish
# ============================================================================

def test_ingredient_restriction_mapping(catalog_service):
    """Test 7: Verify specific ingredient restriction mappings and fish vs shellfish separation."""
    sprats = catalog_service.get_ingredient("ING_SPRATS")
    assert sprats is not None
    assert RestrictionGroupCode.RESTRICT_FISH in sprats.restriction_groups
    assert RestrictionGroupCode.RESTRICT_SHELLFISH not in sprats.restriction_groups

    kunisso = catalog_service.get_ingredient("ING_KUNISSO")
    assert kunisso is not None
    assert RestrictionGroupCode.RESTRICT_SHELLFISH in kunisso.restriction_groups
    assert RestrictionGroupCode.RESTRICT_FISH not in kunisso.restriction_groups

    butter = catalog_service.get_ingredient("ING_BUTTER")
    assert butter is not None
    assert RestrictionGroupCode.RESTRICT_DAIRY in butter.restriction_groups

    margarine = catalog_service.get_ingredient("ING_MARGARINE")
    assert margarine is not None
    assert RestrictionGroupCode.RESTRICT_DAIRY in margarine.restriction_groups

    veg_oil = catalog_service.get_ingredient("ING_VEG_OIL")
    assert veg_oil is not None
    assert RestrictionGroupCode.RESTRICT_DAIRY not in veg_oil.restriction_groups
    assert RestrictionGroupCode.RESTRICT_COCONUT not in veg_oil.restriction_groups

    coconut_oil = catalog_service.get_ingredient("ING_COCONUT_OIL")
    assert coconut_oil is not None
    assert RestrictionGroupCode.RESTRICT_COCONUT in coconut_oil.restriction_groups

    egg_yolk = catalog_service.get_ingredient("ING_EGG_YOLK")
    assert egg_yolk is not None
    assert RestrictionGroupCode.RESTRICT_EGG in egg_yolk.restriction_groups


# ============================================================================
# 8. Composite Dish Restrictions & Filtering
# ============================================================================

def test_composite_dish_restrictions(catalog_service):
    """Test 8: Verify composite dish restriction containment and filtering."""
    sprat_rice = catalog_service.get_dish("DISH_FHB_SPRAT_RICE")
    assert sprat_rice is not None
    assert RestrictionGroupCode.RESTRICT_FISH in sprat_rice.restriction_groups_contained

    # Filter all dishes for fish allergy
    all_dishes = catalog_service.load_catalog().dishes
    fish_free_dishes = catalog_service.filter_dishes_by_restrictions(
        all_dishes, restricted_groups=[RestrictionGroupCode.RESTRICT_FISH]
    )
    for dish in fish_free_dishes:
        assert RestrictionGroupCode.RESTRICT_FISH not in dish.restriction_groups_contained
        assert "ING_SPRATS" not in dish.ingredients
        assert "ING_FISH_SEA" not in dish.ingredients

    # Verify dairy restriction filters butter and margarine
    dairy_free_dishes = catalog_service.filter_dishes_by_restrictions(
        all_dishes, restricted_groups=[RestrictionGroupCode.RESTRICT_DAIRY]
    )
    for dish in dairy_free_dishes:
        assert RestrictionGroupCode.RESTRICT_DAIRY not in dish.restriction_groups_contained
        assert "ING_BUTTER" not in dish.ingredients
        assert "ING_MARGARINE" not in dish.ingredients


# ============================================================================
# 9. Food Substitution Relationships & Practical Rotations
# ============================================================================

def test_food_substitution_relationships(catalog_service):
    """Test 9: Verify category substitutions sharing practical dietary roles."""
    catalog = catalog_service.load_catalog()
    subs = {s.category: s for s in catalog.substitutions}

    assert "Grains and Staples" in subs
    staples_sub = subs["Grains and Staples"]
    assert staples_sub.primary_food_id == "ING_RICE_WHITE"
    assert "ING_STRING_HOPPERS" in staples_sub.alternative_food_ids
    assert "ING_HOPPER" in staples_sub.alternative_food_ids
    assert staples_sub.evidence_tier == EvidenceTier.TIER_B

    # Query substitutes with restrictions applied
    dhal_alts = catalog_service.get_substitutes_for_food("ING_DHAL")
    assert len(dhal_alts) >= 4  # green gram, cowpea, chickpeas, soya

    # Soya restricted
    dhal_alts_no_soya = catalog_service.get_substitutes_for_food(
        "ING_DHAL", restricted_groups=[RestrictionGroupCode.RESTRICT_SOYA]
    )
    assert all(ing.food_id != "ING_SOYA" for ing in dhal_alts_no_soya)


# ============================================================================
# 10. Correct Classification of Tier A, B and C Records
# ============================================================================

def test_evidence_tier_classification(catalog_service):
    """Test 10: Verify explicit distinction among Tier A, B, and C."""
    # Tier A: Direct FHB booklet examples
    sprats = catalog_service.get_ingredient("ING_SPRATS")
    assert sprats.evidence_tier == EvidenceTier.TIER_A
    assert sprats.source_citation.booklet_page == 6
    assert sprats.source_citation.pdf_page == 8

    # Tier B: Derived composite for vegetarians
    veg_dish = catalog_service.get_dish("DISH_VEGETARIAN_PULSE_DUO_MEAL")
    assert veg_dish.evidence_tier == EvidenceTier.TIER_B

    # Tier B: Practical substitution rotations
    catalog = catalog_service.load_catalog()
    for sub in catalog.substitutions:
        assert sub.evidence_tier == EvidenceTier.TIER_B
        assert sub.source_citation.evidence_tier == EvidenceTier.TIER_B

    # Tier C: 60-month project completion boundary
    completion_rule = catalog_service.get_feeding_rule("RULE_14_COMPLETION_60M")
    assert completion_rule.evidence_tier == EvidenceTier.TIER_C


# ============================================================================
# 11. Valid Age & Feeding-Stage Eligibility Metadata
# ============================================================================

def test_age_eligibility_metadata(catalog_service):
    """Test 11: Older child foods must not be available to younger children."""
    kunisso = catalog_service.get_ingredient("ING_KUNISSO")
    assert kunisso.min_calendar_months == 12

    # Dishes with Kunisso must require at least 12 months
    kunisso_dish = catalog_service.get_dish("DISH_FAMILY_MEAL_RICE_KUNISSO_DHAL")
    assert kunisso_dish.min_calendar_months >= 12
    assert FeedingStageId.STAGE_6M_DAY_1 not in kunisso_dish.eligible_stages
    assert FeedingStageId.STAGE_7_TO_8M not in kunisso_dish.eligible_stages

    # Peanuts snack must require 12 months and crushed texture
    peanut_snack = catalog_service.get_snack("SNACK_CRUSHED_PEANUT_PASTE")
    assert peanut_snack.min_calendar_months >= 12


# ============================================================================
# 12. Finalized 0–59 Completed Months Age Scope
# ============================================================================

def test_0_to_59_completed_months_age_scope():
    """Test 12: Verify research component boundary: birth to 59 completed months."""
    eval_date = date(2026, 10, 20)

    # Birth (0 months) -> Eligible
    dob_newborn = date(2026, 10, 15)
    assert is_age_eligible(dob_newborn, today=eval_date) is True
    assert is_at_completion_boundary(dob_newborn, today=eval_date) is False

    # 6 completed months -> Eligible
    dob_6m = date(2026, 4, 20)
    assert is_age_eligible(dob_6m, today=eval_date) is True

    # 59 completed months and 29 days (day before 5th birthday) -> Eligible
    dob_59m = date(2021, 10, 21)
    months, days = calculate_calendar_age(dob_59m, today=eval_date)
    assert months == 59
    assert is_age_eligible(dob_59m, today=eval_date) is True
    assert is_at_completion_boundary(dob_59m, today=eval_date) is False


# ============================================================================
# 13. Exact 60-Month Completion Boundary
# ============================================================================

def test_exact_60_month_completion_boundary(catalog_service):
    """Test 13: Exact 5th birthday (60 completed months) triggers completion boundary."""
    eval_date = date(2026, 10, 20)

    # Born on 2021-10-20, evaluated on 2026-10-20 (exact 5th birthday)
    dob_5th_bday = date(2021, 10, 20)
    months, days = calculate_calendar_age(dob_5th_bday, today=eval_date)
    assert months == 60
    assert days == 0

    assert is_age_eligible(dob_5th_bday, today=eval_date) is False
    assert is_at_completion_boundary(dob_5th_bday, today=eval_date) is True

    # Check feeding rule resolution at 60 months
    rule_60m = catalog_service.resolve_feeding_rule(completed_months=60)
    assert rule_60m is not None
    assert rule_60m.rule_id == "RULE_14_COMPLETION_60M"
    assert rule_60m.evidence_tier == EvidenceTier.TIER_C

    # Beyond 60 months (e.g. 61 months) also triggers completion notice
    rule_61m = catalog_service.resolve_feeding_rule(completed_months=61)
    assert rule_61m is not None
    assert rule_61m.rule_id == "RULE_14_COMPLETION_60M"


# ============================================================================
# 14. February 29 & End-of-Month Calendar Cases
# ============================================================================

def test_calendar_arithmetic_end_of_month_and_leap_year():
    """Test 14: Leap-year February 29, variable month lengths, and end-of-month clamping."""
    # Case A: August 31, 2024 (DOB) -> Feb 28, 2025 (non-leap year, last day of Feb)
    dob_aug31 = date(2024, 8, 31)
    eval_feb28_common = date(2025, 2, 28)
    months, days = calculate_calendar_age(dob_aug31, today=eval_feb28_common)
    assert months == 6
    assert days == 0

    # March 1, 2025 -> 6 months and 1 day
    eval_mar1 = date(2025, 3, 1)
    months_mar, days_mar = calculate_calendar_age(dob_aug31, today=eval_mar1)
    assert months_mar == 6
    assert days_mar == 1

    # Case B: August 31, 2023 (DOB) -> Feb 28, 2024 (leap year, Feb has 29 days)
    dob_aug31_2023 = date(2023, 8, 31)
    eval_feb28_leap = date(2024, 2, 28)
    months_leap_pre, days_leap_pre = calculate_calendar_age(dob_aug31_2023, today=eval_feb28_leap)
    assert months_leap_pre == 5
    assert days_leap_pre == 28

    eval_feb29_leap = date(2024, 2, 29)
    months_leap, days_leap = calculate_calendar_age(dob_aug31_2023, today=eval_feb29_leap)
    assert months_leap == 6
    assert days_leap == 0

    # Case C: Leap Day Birthday (February 29, 2024) -> Feb 28, 2025 (non-leap year)
    dob_leap_day = date(2024, 2, 29)
    eval_feb28_1y = date(2025, 2, 28)
    months_1y, days_1y = calculate_calendar_age(dob_leap_day, today=eval_feb28_1y)
    assert months_1y == 12
    assert days_1y == 0

    # Date validation: Future DOB rejected
    with pytest.raises(DateValidationError, match="ERR_FUTURE_DOB"):
        validate_dates(dob=date(2026, 12, 1), today=date(2026, 10, 20))

    # Date validation: Future start date rejected
    with pytest.raises(DateValidationError, match="ERR_FUTURE_START_DATE"):
        validate_dates(dob=date(2026, 4, 20), start_date=date(2026, 11, 1), today=date(2026, 10, 20))

    # Date validation: Start date before DOB rejected
    with pytest.raises(DateValidationError, match="ERR_START_DATE_BEFORE_DOB"):
        validate_dates(dob=date(2026, 4, 20), start_date=date(2026, 3, 1), today=date(2026, 10, 20))


# ============================================================================
# 15. Missing or Corrupted Catalogue Files Handling
# ============================================================================

def test_missing_catalogue_file_error(tmp_path):
    """Test 15a: Missing mandatory catalogue file raises CatalogueInitializationError."""
    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Mandatory catalogue file missing"):
        service.load_catalog()


def test_corrupted_json_catalogue_file_error(tmp_path):
    """Test 15b: Corrupted JSON syntax raises CatalogueInitializationError."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["dishes.json", "snacks.json", "feeding_rules.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    (tmp_path / "ingredients.json").write_text("{ corrupted invalid json :::", encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Corrupted or invalid JSON"):
        service.load_catalog()


# ============================================================================
# 16. Seven-Month vs Eight-Month Rule Resolution (Task 7.1)
# ============================================================================

def test_seven_month_vs_eight_month_rule_resolution(catalog_service):
    """Test 16: Ensure 7-month guidance is NOT overwritten by 8-month guidance and resolves independently."""
    # Seven months completed resolution
    rule_7m = catalog_service.resolve_feeding_rule(completed_months=7, days_into_month=0)
    assert rule_7m is not None
    assert rule_7m.rule_id == "RULE_09A_STAGE_7M_COMPLETED"
    assert rule_7m.texture == FoodTexture.COARSELY_MASHED
    assert rule_7m.daily_snack_frequency is None
    assert "1/2 tea cup" in rule_7m.household_portion

    # Eight months completed resolution
    rule_8m = catalog_service.resolve_feeding_rule(completed_months=8)
    assert rule_8m is not None
    assert rule_8m.rule_id == "RULE_10_STAGE_8M_MILESTONES"
    assert rule_8m.texture == FoodTexture.COARSELY_CHOPPED
    assert rule_8m.daily_snack_frequency == "1 to 2 snacks per day"
    assert "A bit more than 1/2 tea cup" in rule_8m.household_portion

    # Stage-level multi-rule queries
    rules_7_8 = catalog_service.get_feeding_rules_for_stage(FeedingStageId.STAGE_7_TO_8M)
    assert len(rules_7_8) == 4
    rule_ids = [r.rule_id for r in rules_7_8]
    assert "RULE_09A_STAGE_7M_COMPLETED" in rule_ids
    assert "RULE_09B_STAGE_7M_1WEEK" in rule_ids
    assert "RULE_09C_STAGE_7M_2WEEKS" in rule_ids
    assert "RULE_10_STAGE_8M_MILESTONES" in rule_ids

    # Query with completed_months parameter to get stage rule
    r7_from_stage = catalog_service.get_feeding_rule_for_stage(FeedingStageId.STAGE_7_TO_8M, completed_months=7)
    assert r7_from_stage.min_calendar_months == 7

    r8_from_stage = catalog_service.get_feeding_rule_for_stage(FeedingStageId.STAGE_7_TO_8M, completed_months=8)
    assert r8_from_stage.min_calendar_months == 8
    assert r8_from_stage.rule_id == "RULE_10_STAGE_8M_MILESTONES"


# ============================================================================
# 17. Seven-Month Milestone Transitions (Task 7.2)
# ============================================================================

def test_seven_month_milestone_transitions(catalog_service):
    """Test 17: Verify 7m, 7m + 1 week, 7m + 2 weeks, and 8m boundaries."""
    # 7m + 0 days (Day 0) -> Baseline 7m rule (no snacks)
    r_7m_0d = catalog_service.resolve_feeding_rule(completed_months=7, days_into_month=0)
    assert r_7m_0d.rule_id == "RULE_09A_STAGE_7M_COMPLETED"
    assert r_7m_0d.daily_snack_frequency is None

    # 7m + 5 days (Day 5) -> Baseline 7m rule
    r_7m_5d = catalog_service.resolve_feeding_rule(completed_months=7, days_into_month=5)
    assert r_7m_5d.rule_id == "RULE_09A_STAGE_7M_COMPLETED"

    # 7m + 7 days (Day 7, + 1 week) -> Inception of snacks and whole egg trial
    r_7m_1w = catalog_service.resolve_feeding_rule(completed_months=7, days_into_month=7)
    assert r_7m_1w.rule_id == "RULE_09B_STAGE_7M_1WEEK"
    assert r_7m_1w.daily_snack_frequency == "1 to 2 nutritious snacks per day"
    assert "Whole Egg" in r_7m_1w.preparation_instructions[3]

    # 7m + 12 days (Day 12) -> Snack inception rule
    r_7m_12d = catalog_service.resolve_feeding_rule(completed_months=7, days_into_month=12)
    assert r_7m_12d.rule_id == "RULE_09B_STAGE_7M_1WEEK"

    # 7m + 14 days (Day 14, + 2 weeks) -> Coarsely chopped transition
    r_7m_2w = catalog_service.resolve_feeding_rule(completed_months=7, days_into_month=14)
    assert r_7m_2w.rule_id == "RULE_09C_STAGE_7M_2WEEKS"
    assert "coarsely chopped" in r_7m_2w.preparation_instructions[0].lower()

    # 7m + 28 days (Day 28) -> Coarsely chopped transition
    r_7m_28d = catalog_service.resolve_feeding_rule(completed_months=7, days_into_month=28)
    assert r_7m_28d.rule_id == "RULE_09C_STAGE_7M_2WEEKS"

    # 8 months completed (Day 0 of month 8) -> 8-Month traditional staples
    r_8m = catalog_service.resolve_feeding_rule(completed_months=8, days_into_month=0)
    assert r_8m.rule_id == "RULE_10_STAGE_8M_MILESTONES"


# ============================================================================
# 18. Duplicate or Conflicting Stage Rules Detection (Task 7.3)
# ============================================================================

def test_duplicate_or_conflicting_stage_rules_detection(tmp_path):
    """Test 18: Verify detection of ambiguous overlapping rules with identical precedence."""
    valid_dir = Path("app/data/nutrition")
    for fname in ["ingredients.json", "dishes.json", "snacks.json", "restrictions.json", "substitutions.json"]:
        (tmp_path / fname).write_text((valid_dir / fname).read_text(encoding="utf-8"), encoding="utf-8")

    rules = json.loads((valid_dir / "feeding_rules.json").read_text(encoding="utf-8"))
    # Clone 09A with a new rule_id but identical month and day range and precedence
    conflicting_rule = dict(rules[8])  # 09A
    conflicting_rule["rule_id"] = "RULE_09_CONFLICTING_DUPLICATE"
    rules.append(conflicting_rule)
    (tmp_path / "feeding_rules.json").write_text(json.dumps(rules), encoding="utf-8")

    service = NutritionCatalogService(data_dir=tmp_path)
    with pytest.raises(CatalogueInitializationError, match="Ambiguous overlapping feeding rules detected"):
        service.load_catalog()


# ============================================================================
# 19. Coconut Restriction Filtering (Task 7.4)
# ============================================================================

def test_coconut_restriction_filtering(catalog_service):
    """Test 19: Verify coconut oil separated from veg oil and RESTRICT_COCONUT applied strictly."""
    # 1. Ingredient properties
    c_oil = catalog_service.get_ingredient("ING_COCONUT_OIL")
    v_oil = catalog_service.get_ingredient("ING_VEG_OIL")
    assert RestrictionGroupCode.RESTRICT_COCONUT in c_oil.restriction_groups
    assert RestrictionGroupCode.RESTRICT_COCONUT not in v_oil.restriction_groups

    # 2. Substitutions for coconut milk with RESTRICT_COCONUT active
    alts = catalog_service.get_substitutes_for_food(
        "ING_COCONUT_MILK", restricted_groups=[RestrictionGroupCode.RESTRICT_COCONUT]
    )
    alt_ids = [a.food_id for a in alts]
    # Coconut oil must be filtered out
    assert "ING_COCONUT_OIL" not in alt_ids
    # Non-coconut vegetable oil must be permitted
    assert "ING_VEG_OIL" in alt_ids
    # Butter is permitted unless dairy is restricted
    assert "ING_BUTTER" in alt_ids

    # 3. Both coconut and dairy restricted
    alts_strict = catalog_service.get_substitutes_for_food(
        "ING_COCONUT_MILK",
        restricted_groups=[RestrictionGroupCode.RESTRICT_COCONUT, RestrictionGroupCode.RESTRICT_DAIRY],
    )
    strict_ids = [a.food_id for a in alts_strict]
    assert "ING_COCONUT_OIL" not in strict_ids
    assert "ING_BUTTER" not in strict_ids
    assert "ING_MARGARINE" not in strict_ids
    assert "ING_VEG_OIL" in strict_ids


# ============================================================================
# 20. Excluded Individual Ingredients in Substitutions (Task 7.5)
# ============================================================================

def test_excluded_individual_ingredients_in_substitutions(catalog_service):
    """Test 20: Ensure individually excluded food_ids are strictly filtered out."""
    alts = catalog_service.get_substitutes_for_food(
        "ING_DHAL", excluded_food_ids=["ING_SOYA", "ING_GREEN_GRAM"]
    )
    alt_ids = [a.food_id for a in alts]
    assert "ING_SOYA" not in alt_ids
    assert "ING_GREEN_GRAM" not in alt_ids
    assert "ING_COWPEA" in alt_ids
    assert "ING_CHICKPEAS" in alt_ids


# ============================================================================
# 21. Stage-Ineligible Substitutes (Task 7.6)
# ============================================================================

def test_stage_ineligible_substitutes(catalog_service):
    """Test 21: Substitutions must not bypass developmental stage or age eligibility."""
    # Stage 6M Day 1: Kunisso (min 12m) cannot be offered as a substitute for sprats
    alts_day1 = catalog_service.get_substitutes_for_food(
        "ING_SPRATS",
        feeding_stage=FeedingStageId.STAGE_6M_DAY_1,
        child_completed_months=6,
    )
    day1_ids = [a.food_id for a in alts_day1]
    assert "ING_KUNISSO" not in day1_ids
    assert "ING_EGG_WHOLE" not in day1_ids

    # Pre-solids stage (0 to 6m): no solid substitutes allowed
    alts_presolids = catalog_service.get_substitutes_for_food(
        "ING_RICE_WHITE",
        feeding_stage=FeedingStageId.STAGE_0_TO_6M,
        child_completed_months=3,
    )
    assert len(alts_presolids) == 0


# ============================================================================
# 22. Food-Introduction Eligibility Conditions (Task 7.7)
# ============================================================================

def test_food_introduction_eligibility_conditions(catalog_service):
    """Test 22: Whole egg requires prior introduction of egg yolk."""
    # Case A: Egg yolk NOT yet introduced -> Whole egg must NOT be offered
    alts_without_yolk = catalog_service.get_substitutes_for_food(
        "ING_SPRATS",
        child_completed_months=7,
        foods_introduced=["ING_RICE_WHITE", "ING_DHAL"],
    )
    ids_without_yolk = [a.food_id for a in alts_without_yolk]
    assert "ING_EGG_WHOLE" not in ids_without_yolk

    # Case B: Egg yolk introduced and tolerated -> Whole egg IS offered
    alts_with_yolk = catalog_service.get_substitutes_for_food(
        "ING_SPRATS",
        child_completed_months=7,
        foods_introduced=["ING_RICE_WHITE", "ING_DHAL", "ING_EGG_YOLK"],
    )
    ids_with_yolk = [a.food_id for a in alts_with_yolk]
    assert "ING_EGG_WHOLE" in ids_with_yolk


# ============================================================================
# 23. Incorrect Evidence-Tier Assignments (Task 7.8)
# ============================================================================

def test_incorrect_evidence_tier_assignments():
    """Test 23: Pydantic schema rejects mismatch between entity tier and citation tier."""
    citation = SourceCitation(
        booklet_page=5,
        pdf_page=7,
        evidence_tier=EvidenceTier.TIER_B,
        evidence_description="Test Tier B citation",
    )
    # FeedingRule claims TIER_A but citation is TIER_B
    with pytest.raises(ValidationError, match="does not match citation tier"):
        FeedingRuleRecord(
            rule_id="RULE_TEST_MISMATCH",
            stage_id=FeedingStageId.STAGE_6M_DAY_1,
            stage_name="Test Rule",
            min_calendar_months=6,
            max_calendar_months=6,
            daily_meal_frequency="1 meal",
            household_portion="2 tsp",
            texture=FoodTexture.SEMI_SOLID_MASH,
            recommended_food_groups=[FoodGroup.GRAINS_AND_STAPLES],
            preparation_instructions=["Wash and boil."],
            safety_and_hygiene_guidance=["No salt."],
            evidence_tier=EvidenceTier.TIER_A,  # MISMATCH!
            source_citation=citation,
        )


# ============================================================================
# 24. Invalid PDF Page References (Task 7.9)
# ============================================================================

def test_invalid_pdf_page_references():
    """Test 24: PDF page outside 1–28 range raises validation error."""
    # Beyond booklet length (29 > 28)
    with pytest.raises(ValidationError, match="pdf_page must be between 1 and 28"):
        SourceCitation(
            booklet_page=5,
            pdf_page=29,
            evidence_tier=EvidenceTier.TIER_A,
            evidence_description="Invalid page reference",
        )

    # 0 is not a valid 1-indexed PDF page
    with pytest.raises(ValidationError, match="pdf_page must be between 1 and 28"):
        SourceCitation(
            booklet_page=0,
            pdf_page=0,
            evidence_tier=EvidenceTier.TIER_A,
            evidence_description="Invalid zero page reference",
        )


# ============================================================================
# 25. Missing Required Source References (Task 7.10)
# ============================================================================

def test_missing_required_source_references():
    """Test 25: Tier A records without PDF or booklet page reference fail validation."""
    with pytest.raises(ValidationError, match="Tier A evidence requires an explicit pdf_page reference"):
        SourceCitation(
            booklet_page=5,
            pdf_page=None,  # Missing
            evidence_tier=EvidenceTier.TIER_A,
            evidence_description="Missing pdf page",
        )

    with pytest.raises(ValidationError, match="Tier A evidence requires an explicit booklet_page reference"):
        SourceCitation(
            booklet_page=None,  # Missing
            pdf_page=7,
            evidence_tier=EvidenceTier.TIER_A,
            evidence_description="Missing booklet page",
        )


# ============================================================================
# 26. Asia/Colombo Date Handling (Task 7.11)
# ============================================================================

def test_asia_colombo_date_handling():
    """Test 26: Verify Asia/Colombo timezone evaluation and injectable deterministic overrides."""
    # 1. get_colombo_today returns date in Asia/Colombo
    colombo_now = datetime.now(COLOMBO_TZ).date()
    colombo_today = get_colombo_today()
    assert colombo_today == colombo_now

    # 2. validate_dates defaults to Colombo time when today is None
    dob_past = date(2025, 1, 1)
    validate_dates(dob=dob_past)  # Should not raise

    # 3. calculate_calendar_age defaults to Colombo time when today is None
    months, days = calculate_calendar_age(dob=dob_past)
    assert months >= 0

    # 4. Injectable deterministic date works as expected
    deterministic_today = date(2026, 10, 20)
    months_det, days_det = calculate_calendar_age(dob=date(2026, 4, 20), today=deterministic_today)
    assert months_det == 6
    assert days_det == 0


# ============================================================================
# 27. Late Starter Transition Rule Neutral Evidence (Task 6)
# ============================================================================

def test_late_starter_transition_rule(catalog_service):
    """Test 27: Verify RULE_15 is renamed, neutral, evidence-accurate Tier B."""
    rule_15 = catalog_service.get_feeding_rule("RULE_15_LATE_STARTER_TRANSITION")
    assert rule_15 is not None
    assert rule_15.is_late_starter_rule is True
    assert rule_15.evidence_tier == EvidenceTier.TIER_B
    assert rule_15.source_citation.evidence_tier == EvidenceTier.TIER_B

    # Must NOT contain unsupported physiological gut claims
    full_text = " ".join(rule_15.preparation_instructions).lower()
    assert "gut priming" not in full_text
    assert "gut microbiome tolerance" not in full_text

    # Resolve late starter rule for child aged 8 months who started solids 10 days ago
    resolved_late = catalog_service.resolve_feeding_rule(
        completed_months=8, days_since_start=10
    )
    assert resolved_late is not None
    assert resolved_late.rule_id == "RULE_15_LATE_STARTER_TRANSITION"
