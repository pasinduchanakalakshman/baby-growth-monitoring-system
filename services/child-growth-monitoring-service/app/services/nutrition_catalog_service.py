"""Nutrition Catalogue Loading, Validation, and Age Arithmetic Service.

Primary Reference:
'Right Food at the Right Time, To Make My Baby Healthy and Bright',
Family Health Bureau (FHB), Ministry of Health, Sri Lanka (2025).
"""

import calendar
import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from zoneinfo import ZoneInfo

from app.schemas.nutrition import (
    COMPLETION_BOUNDARY_MONTHS,
    MAX_ELIGIBLE_COMPLETED_MONTHS,
    MIN_ELIGIBLE_COMPLETED_MONTHS,
    DishRecord,
    EvidenceTier,
    FeedingRuleRecord,
    FeedingStageId,
    FoodGroup,
    FoodSubstitutionRecord,
    FoodTexture,
    IngredientRecord,
    MealType,
    NutritionCatalog,
    RestrictionGroupCode,
    RestrictionGroupRecord,
    SnackRecord,
    SourceCitation,
)

# ============================================================================
# Timezone & Calendar Constants
# ============================================================================

COLOMBO_TZ = ZoneInfo("Asia/Colombo")


def get_colombo_today() -> date:
    """Returns the current calendar date in the Asia/Colombo timezone."""
    return datetime.now(COLOMBO_TZ).date()


# ============================================================================
# Exceptions
# ============================================================================

class CatalogueInitializationError(Exception):
    """Raised when catalogue data is missing, corrupted, or violates integrity constraints."""
    pass


class DateValidationError(ValueError):
    """Raised when date validation fails (e.g. future DOB, future start date)."""
    pass


# ============================================================================
# Calendar Arithmetic & Date Validation Utilities
# ============================================================================

def validate_dates(dob: date, start_date: Optional[date] = None, today: Optional[date] = None) -> None:
    """
    Validates baby DOB and complementary feeding start date against calendar boundaries.
    - Rule D-01: Reject future date of birth.
    - Rule D-02: Reject future complementary feeding start date.
    - Rule D-03: Reject complementary feeding start date before date of birth.
    Uses Asia/Colombo timezone when today is None.
    """
    if today is None:
        today = get_colombo_today()

    if dob > today:
        raise DateValidationError("ERR_FUTURE_DOB: Child date of birth cannot be in the future.")

    if start_date is not None:
        if start_date > today:
            raise DateValidationError("ERR_FUTURE_START_DATE: Complementary feeding start date cannot be in the future.")
        if start_date < dob:
            raise DateValidationError("ERR_START_DATE_BEFORE_DOB: Complementary feeding start date cannot be before date of birth.")


def calculate_calendar_age(dob: date, today: Optional[date] = None) -> Tuple[int, int]:
    """
    Calculates exact completed calendar months and remaining days from DOB to evaluation date.
    Uses Asia/Colombo timezone when today is None.
    Properly handles:
    - Variable month lengths (28, 29, 30, 31 days)
    - Leap years (February 29 clamping)
    - End-of-month birthdays (e.g. August 31 clamps to Feb 28 in common years, Feb 29 in leap years)
    - February 29 leap day birthdays clamping to February 28 in common years.
    Returns: (completed_calendar_months, remaining_days)
    """
    if today is None:
        today = get_colombo_today()

    validate_dates(dob, today=today)

    months = (today.year - dob.year) * 12 + (today.month - dob.month)

    # Determine candidate milestone date in current month
    day_in_month = dob.day
    last_day_of_current = calendar.monthrange(today.year, today.month)[1]
    clamped_day = min(day_in_month, last_day_of_current)
    milestone_date = date(today.year, today.month, clamped_day)

    if today < milestone_date:
        months -= 1
        # Previous month milestone date
        prev_month = today.month - 1 if today.month > 1 else 12
        prev_year = today.year if today.month > 1 else today.year - 1
        last_day_prev = calendar.monthrange(prev_year, prev_month)[1]
        clamped_prev = min(day_in_month, last_day_prev)
        milestone_date = date(prev_year, prev_month, clamped_prev)

    remaining_days = (today - milestone_date).days
    return months, remaining_days


def is_age_eligible(dob: date, today: Optional[date] = None) -> bool:
    """
    Checks if child falls within the finalized research scope:
    0 to 59 completed calendar months (birth until immediately before 5th birthday).
    """
    completed_months, _ = calculate_calendar_age(dob, today)
    return MIN_ELIGIBLE_COMPLETED_MONTHS <= completed_months <= MAX_ELIGIBLE_COMPLETED_MONTHS


def is_at_completion_boundary(dob: date, today: Optional[date] = None) -> bool:
    """
    Checks if child has completed 60 calendar months (reached 5th birthday).
    At 60 months, child is no longer eligible for newly generated daily/weekly meal plans.
    """
    completed_months, _ = calculate_calendar_age(dob, today)
    return completed_months >= COMPLETION_BOUNDARY_MONTHS


# ============================================================================
# Catalogue Service Class
# ============================================================================

class NutritionCatalogService:
    """
    Service responsible for loading, validating, caching, and querying
    the Sri Lankan Infant and Young Child Nutrition Knowledge Base.
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            base_dir = Path(__file__).resolve().parent.parent
            self.data_dir = base_dir / "data" / "nutrition"
        else:
            self.data_dir = Path(data_dir)

        self._catalog: Optional[NutritionCatalog] = None
        self._ingredients_by_id: Dict[str, IngredientRecord] = {}
        self._dishes_by_id: Dict[str, DishRecord] = {}
        self._snacks_by_id: Dict[str, SnackRecord] = {}
        self._rules_by_id: Dict[str, FeedingRuleRecord] = {}
        self._rules_by_stage: Dict[FeedingStageId, List[FeedingRuleRecord]] = {}
        self._late_starter_rules: List[FeedingRuleRecord] = []
        self._restrictions_by_code: Dict[RestrictionGroupCode, RestrictionGroupRecord] = {}
        self._substitutions_by_primary: Dict[str, FoodSubstitutionRecord] = {}

    def load_catalog(self, force_reload: bool = False) -> NutritionCatalog:
        """Loads and strictly validates all catalogue data files."""
        if self._catalog is not None and not force_reload:
            return self._catalog

        if not self.data_dir.exists() or not self.data_dir.is_dir():
            raise CatalogueInitializationError(
                f"Nutrition catalogue directory does not exist: {self.data_dir}"
            )

        # 1. Load raw JSON files
        raw_ingredients = self._load_json_file("ingredients.json")
        raw_dishes = self._load_json_file("dishes.json")
        raw_snacks = self._load_json_file("snacks.json")
        raw_rules = self._load_json_file("feeding_rules.json")
        raw_restrictions = self._load_json_file("restrictions.json")
        raw_substitutions = self._load_json_file("substitutions.json")

        # 2. Parse and validate with Pydantic
        try:
            ingredients = [IngredientRecord.model_validate(item) for item in raw_ingredients]
            dishes = [DishRecord.model_validate(item) for item in raw_dishes]
            snacks = [SnackRecord.model_validate(item) for item in raw_snacks]
            feeding_rules = [FeedingRuleRecord.model_validate(item) for item in raw_rules]
            restrictions = [RestrictionGroupRecord.model_validate(item) for item in raw_restrictions]
            substitutions = [FoodSubstitutionRecord.model_validate(item) for item in raw_substitutions]
        except Exception as e:
            raise CatalogueInitializationError(f"Pydantic schema validation error in catalogue data: {e}") from e

        # 3. Build and validate indexes & cross-references
        self._validate_and_index(
            ingredients=ingredients,
            dishes=dishes,
            snacks=snacks,
            feeding_rules=feeding_rules,
            restrictions=restrictions,
            substitutions=substitutions,
        )

        # 4. Construct container model
        self._catalog = NutritionCatalog(
            ingredients=ingredients,
            dishes=dishes,
            snacks=snacks,
            feeding_rules=feeding_rules,
            restrictions=restrictions,
            substitutions=substitutions,
        )

        return self._catalog

    def _load_json_file(self, filename: str) -> list:
        filepath = self.data_dir / filename
        if not filepath.exists():
            raise CatalogueInitializationError(f"Mandatory catalogue file missing: {filepath}")
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if not isinstance(data, list):
                    raise CatalogueInitializationError(f"File {filename} must contain a JSON array, got {type(data)}")
                return data
        except json.JSONDecodeError as e:
            raise CatalogueInitializationError(f"Corrupted or invalid JSON in {filename}: {e}") from e

    def _validate_and_index(
        self,
        ingredients: List[IngredientRecord],
        dishes: List[DishRecord],
        snacks: List[SnackRecord],
        feeding_rules: List[FeedingRuleRecord],
        restrictions: List[RestrictionGroupRecord],
        substitutions: List[FoodSubstitutionRecord],
    ) -> None:
        """Strict cross-referential, structural, and overlap validation."""

        # A. Unique IDs check
        self._ingredients_by_id = {}
        for ing in ingredients:
            if ing.food_id in self._ingredients_by_id:
                raise CatalogueInitializationError(f"Duplicate ingredient ID found: {ing.food_id}")
            self._ingredients_by_id[ing.food_id] = ing

        self._dishes_by_id = {}
        for dish in dishes:
            if dish.dish_id in self._dishes_by_id:
                raise CatalogueInitializationError(f"Duplicate dish ID found: {dish.dish_id}")
            self._dishes_by_id[dish.dish_id] = dish

        self._snacks_by_id = {}
        for snack in snacks:
            if snack.snack_id in self._snacks_by_id:
                raise CatalogueInitializationError(f"Duplicate snack ID found: {snack.snack_id}")
            self._snacks_by_id[snack.snack_id] = snack

        self._rules_by_id = {}
        self._rules_by_stage = {}
        self._late_starter_rules = []

        for rule in feeding_rules:
            if rule.rule_id in self._rules_by_id:
                raise CatalogueInitializationError(f"Duplicate rule ID found: {rule.rule_id}")
            self._rules_by_id[rule.rule_id] = rule

            if rule.is_late_starter_rule:
                self._late_starter_rules.append(rule)
            else:
                if rule.stage_id not in self._rules_by_stage:
                    self._rules_by_stage[rule.stage_id] = []
                self._rules_by_stage[rule.stage_id].append(rule)

                # Also index under STAGE_7M and STAGE_8M if applicable for independent resolution
                if rule.stage_id == FeedingStageId.STAGE_7_TO_8M:
                    if rule.min_calendar_months == 7:
                        if FeedingStageId.STAGE_7M not in self._rules_by_stage:
                            self._rules_by_stage[FeedingStageId.STAGE_7M] = []
                        self._rules_by_stage[FeedingStageId.STAGE_7M].append(rule)
                    elif rule.min_calendar_months == 8:
                        if FeedingStageId.STAGE_8M not in self._rules_by_stage:
                            self._rules_by_stage[FeedingStageId.STAGE_8M] = []
                        self._rules_by_stage[FeedingStageId.STAGE_8M].append(rule)

        # Ambiguous overlapping rules check:
        # Check within each stage list to detect conflicting rules
        for stage, rules_list in self._rules_by_stage.items():
            for i, r1 in enumerate(rules_list):
                for j, r2 in enumerate(rules_list):
                    if i >= j:
                        continue
                    # Check if calendar months overlap
                    month_overlap = max(r1.min_calendar_months, r2.min_calendar_months) <= min(r1.max_calendar_months, r2.max_calendar_months)
                    if not month_overlap:
                        continue

                    # Check if day ranges overlap
                    r1_min_d = r1.min_days_into_month if r1.min_days_into_month is not None else 0
                    r1_max_d = r1.max_days_into_month if r1.max_days_into_month is not None else 31
                    r2_min_d = r2.min_days_into_month if r2.min_days_into_month is not None else 0
                    r2_max_d = r2.max_days_into_month if r2.max_days_into_month is not None else 31

                    day_overlap = max(r1_min_d, r2_min_d) <= min(r1_max_d, r2_max_d)

                    if day_overlap and r1.precedence == r2.precedence:
                        raise CatalogueInitializationError(
                            f"Ambiguous overlapping feeding rules detected in stage '{stage.value}': "
                            f"'{r1.rule_id}' and '{r2.rule_id}' have overlapping month/day ranges "
                            f"with identical precedence ({r1.precedence})."
                        )

        self._restrictions_by_code = {}
        for rest in restrictions:
            if rest.group_code in self._restrictions_by_code:
                raise CatalogueInitializationError(f"Duplicate restriction group found: {rest.group_code}")
            self._restrictions_by_code[rest.group_code] = rest

        self._substitutions_by_primary = {}
        for sub in substitutions:
            if sub.primary_food_id in self._substitutions_by_primary:
                raise CatalogueInitializationError(
                    f"Duplicate primary food in substitutions: {sub.primary_food_id}"
                )
            self._substitutions_by_primary[sub.primary_food_id] = sub

        # B. Ingredient Reference Integrity in Dishes
        for dish in dishes:
            constituent_restrictions: Set[RestrictionGroupCode] = set()
            max_ingredient_min_months = 0

            for ing_id in dish.ingredients:
                if ing_id not in self._ingredients_by_id:
                    raise CatalogueInitializationError(
                        f"Dish '{dish.dish_id}' references unknown ingredient '{ing_id}'"
                    )
                ing = self._ingredients_by_id[ing_id]
                constituent_restrictions.update(ing.restriction_groups)
                if ing.min_calendar_months > max_ingredient_min_months:
                    max_ingredient_min_months = ing.min_calendar_months

            if dish.min_calendar_months < max_ingredient_min_months:
                raise CatalogueInitializationError(
                    f"Dish '{dish.dish_id}' has min_calendar_months={dish.min_calendar_months}, "
                    f"which is less than constituent ingredient requirement {max_ingredient_min_months}."
                )

            for req_group in constituent_restrictions:
                if req_group not in dish.restriction_groups_contained:
                    raise CatalogueInitializationError(
                        f"Dish '{dish.dish_id}' contains ingredient with restriction '{req_group.value}', "
                        f"but does not declare it in restriction_groups_contained."
                    )

        # C. Ingredient Reference Integrity in Snacks
        for snack in snacks:
            constituent_restrictions: Set[RestrictionGroupCode] = set()
            max_ingredient_min_months = 0

            for ing_id in snack.ingredients:
                if ing_id not in self._ingredients_by_id:
                    raise CatalogueInitializationError(
                        f"Snack '{snack.snack_id}' references unknown ingredient '{ing_id}'"
                    )
                ing = self._ingredients_by_id[ing_id]
                constituent_restrictions.update(ing.restriction_groups)
                if ing.min_calendar_months > max_ingredient_min_months:
                    max_ingredient_min_months = ing.min_calendar_months

            if snack.min_calendar_months < max_ingredient_min_months:
                raise CatalogueInitializationError(
                    f"Snack '{snack.snack_id}' has min_calendar_months={snack.min_calendar_months}, "
                    f"which is less than constituent ingredient requirement {max_ingredient_min_months}."
                )

            for req_group in constituent_restrictions:
                if req_group not in snack.restriction_groups:
                    raise CatalogueInitializationError(
                        f"Snack '{snack.snack_id}' contains ingredient with restriction '{req_group.value}', "
                        f"but does not declare it in restriction_groups."
                    )

        # D. Substitutions Reference Integrity
        for sub in substitutions:
            if sub.primary_food_id not in self._ingredients_by_id:
                raise CatalogueInitializationError(
                    f"Substitution category '{sub.category}' references unknown primary food '{sub.primary_food_id}'"
                )
            for alt_id in sub.alternative_food_ids:
                if alt_id not in self._ingredients_by_id:
                    raise CatalogueInitializationError(
                        f"Substitution category '{sub.category}' references unknown alternative food '{alt_id}'"
                    )

        # E. Restriction Groups Matching Ingredients Check
        for rest in restrictions:
            for ing_id in rest.matching_ingredients:
                if ing_id not in self._ingredients_by_id:
                    raise CatalogueInitializationError(
                        f"Restriction group '{rest.group_code.value}' references unknown ingredient '{ing_id}'"
                    )

        # F. Required Stage Rules Check (At least Rules 1 through 14 must exist)
        if len(feeding_rules) < 14:
            raise CatalogueInitializationError(
                f"Feeding rules catalogue must contain at least 14 rules, found {len(feeding_rules)}"
            )

    # ========================================================================
    # Query API
    # ========================================================================

    def get_ingredient(self, food_id: str) -> Optional[IngredientRecord]:
        if self._catalog is None:
            self.load_catalog()
        return self._ingredients_by_id.get(food_id)

    def get_dish(self, dish_id: str) -> Optional[DishRecord]:
        if self._catalog is None:
            self.load_catalog()
        return self._dishes_by_id.get(dish_id)

    def get_snack(self, snack_id: str) -> Optional[SnackRecord]:
        if self._catalog is None:
            self.load_catalog()
        return self._snacks_by_id.get(snack_id)

    def get_feeding_rule(self, rule_id: str) -> Optional[FeedingRuleRecord]:
        if self._catalog is None:
            self.load_catalog()
        return self._rules_by_id.get(rule_id)

    def get_feeding_rules_for_stage(self, stage_id: FeedingStageId) -> List[FeedingRuleRecord]:
        if self._catalog is None:
            self.load_catalog()
        return list(self._rules_by_stage.get(stage_id, []))

    def get_feeding_rule_for_stage(
        self,
        stage_id: FeedingStageId,
        completed_months: Optional[int] = None,
        days_into_month: Optional[int] = None,
    ) -> Optional[FeedingRuleRecord]:
        """
        Resolves a single feeding rule for a stage.
        If a stage has multiple rules (e.g. STAGE_7_TO_8M), uses completed_months
        and days_into_month to resolve deterministically.
        """
        if self._catalog is None:
            self.load_catalog()

        rules = self._rules_by_stage.get(stage_id, [])
        if not rules:
            return None
        if len(rules) == 1:
            return rules[0]

        # Multi-rule stage resolution
        matching = list(rules)

        if completed_months is not None:
            month_match = [r for r in matching if r.min_calendar_months <= completed_months <= r.max_calendar_months]
            if month_match:
                matching = month_match

        if days_into_month is not None:
            day_match = [
                r for r in matching
                if (r.min_days_into_month is None or r.min_days_into_month <= days_into_month)
                and (r.max_days_into_month is None or days_into_month <= r.max_days_into_month)
            ]
            if day_match:
                matching = day_match

        # Deterministic precedence ordering: lower precedence value = higher priority, then day range, then rule_id
        matching.sort(key=lambda r: (r.precedence, r.min_days_into_month or 0, r.rule_id))
        return matching[0]

    def resolve_feeding_rule(
        self,
        completed_months: int,
        days_into_month: Optional[int] = None,
        days_since_start: Optional[int] = None,
        stage_id: Optional[FeedingStageId] = None,
    ) -> Optional[FeedingRuleRecord]:
        """
        Deterministically resolves the applicable feeding rule based on:
        - completed_calendar_months
        - days_into_month (for milestone resolution within a month, e.g. 7m + 1w)
        - days_since_start (for complementary feeding progression)
        - stage_id (optional filter)
        """
        if self._catalog is None:
            self.load_catalog()

        # 1. Scope Boundary: 60 completed months and above
        if completed_months >= COMPLETION_BOUNDARY_MONTHS:
            return self._rules_by_id.get("RULE_14_COMPLETION_60M")

        # 2. Late Starter Rule: Age >= 7m, complementary feeding started <= 30 days ago
        if completed_months >= 7 and days_since_start is not None and 1 <= days_since_start <= 30:
            late_starter = self._rules_by_id.get("RULE_15_LATE_STARTER_TRANSITION")
            if late_starter:
                return late_starter

        # 3. 0 to 5 completed months: Exclusive Breastfeeding
        if completed_months < 6:
            return self._rules_by_id.get("RULE_01_BEFORE_6M")

        # 4. 6 completed months (Introductory month)
        if completed_months == 6:
            if days_since_start is not None:
                if days_since_start == 1:
                    return self._rules_by_id.get("RULE_02_DAY_1")
                elif 2 <= days_since_start <= 3:
                    return self._rules_by_id.get("RULE_03_DAYS_2_3")
                elif 4 <= days_since_start <= 6:
                    return self._rules_by_id.get("RULE_04_DAYS_4_6")
                elif 7 <= days_since_start <= 9:
                    return self._rules_by_id.get("RULE_05_DAYS_7_9")
                elif 10 <= days_since_start <= 15:
                    return self._rules_by_id.get("RULE_06_DAYS_10_15")
                elif 16 <= days_since_start <= 30:
                    return self._rules_by_id.get("RULE_07_DAYS_16_30")
            # If start date unknown or days > 30:
            return self._rules_by_id.get("RULE_08_STAGE_6M_GENERAL")

        # 5. 7 completed months (Milestone resolution)
        if completed_months == 7:
            if days_into_month is not None:
                if 0 <= days_into_month <= 6:
                    return self._rules_by_id.get("RULE_09A_STAGE_7M_COMPLETED")
                elif 7 <= days_into_month <= 13:
                    return self._rules_by_id.get("RULE_09B_STAGE_7M_1WEEK")
                elif days_into_month >= 14:
                    return self._rules_by_id.get("RULE_09C_STAGE_7M_2WEEKS")
            # Default baseline for 7 completed months
            return self._rules_by_id.get("RULE_09A_STAGE_7M_COMPLETED")

        # 6. 8 completed months
        if completed_months == 8:
            return self._rules_by_id.get("RULE_10_STAGE_8M_MILESTONES")

        # 7. 9 to 11 completed months
        if 9 <= completed_months <= 11:
            return self._rules_by_id.get("RULE_11_STAGE_9_TO_11M")

        # 8. 12 to 23 completed months (1 to 2 years)
        if 12 <= completed_months <= 23:
            return self._rules_by_id.get("RULE_12_STAGE_12_TO_23M")

        # 9. 24 to 59 completed months (2 to 5 years)
        if 24 <= completed_months <= 59:
            return self._rules_by_id.get("RULE_13_STAGE_24_TO_59M")

        return None

    def filter_dishes_by_restrictions(
        self,
        dishes: List[DishRecord],
        restricted_groups: List[RestrictionGroupCode],
        excluded_food_ids: Optional[List[str]] = None,
    ) -> List[DishRecord]:
        """Filters out dishes containing any restricted group or individual food ID."""
        group_set = set(restricted_groups)
        food_set = set(excluded_food_ids or [])

        result = []
        for dish in dishes:
            if any(rg in group_set for rg in dish.restriction_groups_contained):
                continue
            if any(ing in food_set for ing in dish.ingredients):
                continue
            result.append(dish)
        return result

    def filter_snacks_by_restrictions(
        self,
        snacks: List[SnackRecord],
        restricted_groups: List[RestrictionGroupCode],
        excluded_food_ids: Optional[List[str]] = None,
    ) -> List[SnackRecord]:
        """Filters out snacks containing any restricted group or individual food ID."""
        group_set = set(restricted_groups)
        food_set = set(excluded_food_ids or [])

        result = []
        for snack in snacks:
            if any(rg in group_set for rg in snack.restriction_groups):
                continue
            if any(ing in food_set for ing in snack.ingredients):
                continue
            result.append(snack)
        return result

    def get_substitutes_for_food(
        self,
        food_id: str,
        restricted_groups: Optional[List[RestrictionGroupCode]] = None,
        excluded_food_ids: Optional[List[str]] = None,
        child_completed_months: Optional[int] = None,
        feeding_stage: Optional[FeedingStageId] = None,
        foods_introduced: Optional[List[str]] = None,
        target_texture: Optional[FoodTexture] = None,
    ) -> List[IngredientRecord]:
        """
        Returns eligible category substitutions for a primary food item,
        strictly enforcing:
        - Excluded ingredient IDs (excluded_food_ids)
        - Restricted ingredient groups (restricted_groups, e.g. RESTRICT_COCONUT, RESTRICT_DAIRY)
        - Chronological age minimums (child_completed_months)
        - Feeding stage suitability (feeding_stage)
        - Food introduction prerequisites (e.g. egg yolk must precede whole egg)
        - Texture suitability (target_texture)
        """
        if self._catalog is None:
            self.load_catalog()

        sub_record = self._substitutions_by_primary.get(food_id)
        if not sub_record:
            return []

        restricted_set = set(restricted_groups or [])
        excluded_id_set = set(excluded_food_ids or [])
        introduced_set = set(foods_introduced) if foods_introduced is not None else None
        eligible_alts = []

        for alt_id in sub_record.alternative_food_ids:
            # 1. Excluded individual ingredient IDs
            if alt_id in excluded_id_set:
                continue

            alt_ing = self._ingredients_by_id.get(alt_id)
            if not alt_ing:
                continue

            # 2. Hard restriction groups (e.g. RESTRICT_COCONUT, RESTRICT_DAIRY, RESTRICT_FISH)
            if any(rg in restricted_set for rg in alt_ing.restriction_groups):
                continue

            # 3. Chronological age eligibility
            if child_completed_months is not None and alt_ing.min_calendar_months > child_completed_months:
                continue

            # 4. Developmental feeding stage eligibility
            if feeding_stage is not None:
                # If stage is 0 to 6 months (pre-solids), no solids allowed
                if feeding_stage == FeedingStageId.STAGE_0_TO_6M and alt_id != "ING_BREAST_MILK":
                    continue
                # If early stage and ingredient min_calendar_months exceeds stage
                if feeding_stage in (
                    FeedingStageId.STAGE_6M_DAY_1,
                    FeedingStageId.STAGE_6M_DAYS_2_3,
                    FeedingStageId.STAGE_6M_DAYS_4_6,
                    FeedingStageId.STAGE_6M_DAYS_7_9,
                    FeedingStageId.STAGE_6M_DAYS_10_15,
                    FeedingStageId.STAGE_6M_DAYS_16_30,
                    FeedingStageId.STAGE_6M_GENERAL,
                ) and alt_ing.min_calendar_months > 6:
                    continue

            # 5. Food-introduction prerequisites
            if introduced_set is not None:
                # Whole Egg requires prior successful egg yolk introduction
                if alt_id == "ING_EGG_WHOLE" and "ING_EGG_YOLK" not in introduced_set:
                    continue

            # 6. Food texture suitability
            if target_texture is not None:
                # Cannot offer finger food texture if baby requires puree or semi-solid mash
                if target_texture in (FoodTexture.SMOOTH_PUREE, FoodTexture.SEMI_SOLID_MASH):
                    if alt_ing.texture in (FoodTexture.FINGER_FOOD, FoodTexture.FAMILY_FOOD):
                        continue

            eligible_alts.append(alt_ing)

        return eligible_alts


# ============================================================================
# Singleton Accessor
# ============================================================================

_catalog_service_instance: Optional[NutritionCatalogService] = None

def get_nutrition_catalog_service() -> NutritionCatalogService:
    """Returns singleton instance of the NutritionCatalogService."""
    global _catalog_service_instance
    if _catalog_service_instance is None:
        _catalog_service_instance = NutritionCatalogService()
        _catalog_service_instance.load_catalog()
    return _catalog_service_instance

def reset_nutrition_catalog_service() -> None:
    """Resets singleton instance for testing."""
    global _catalog_service_instance
    _catalog_service_instance = None
