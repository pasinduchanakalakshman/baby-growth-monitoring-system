"""Personalized Sri Lankan Nutrition Recommendation Engine Service.

Primary Reference:
'Right Food at the Right Time, To Make My Baby Healthy and Bright',
Family Health Bureau (FHB), Ministry of Health, Sri Lanka (2025).

Implements deterministic, explainable, and scientifically traceable nutrition
recommendations for infants and young children aged 0–59 completed calendar months.
"""

from datetime import date
from typing import Dict, List, Optional, Set, Tuple
from zoneinfo import ZoneInfo

from app.schemas.nutrition import (
    COMPLETION_BOUNDARY_MONTHS,
    MAX_ELIGIBLE_COMPLETED_MONTHS,
    MIN_ELIGIBLE_COMPLETED_MONTHS,
    ChildNutritionProfile,
    DishRecord,
    EvidenceTier,
    FeedingRuleRecord,
    FeedingStageId,
    FoodGroup,
    FoodTexture,
    MealRecommendationItem,
    MealType,
    NutritionRecommendationResponse,
    RestrictionGroupCode,
    SnackRecord,
    SourceCitation,
)
from app.services.nutrition_catalog_service import (
    COLOMBO_TZ,
    DateValidationError,
    NutritionCatalogService,
    calculate_calendar_age,
    get_colombo_today,
    get_nutrition_catalog_service,
    is_age_eligible,
    is_at_completion_boundary,
    validate_dates,
)


class NutritionRecommendationService:
    """
    Deterministic Personalized Nutrition Recommendation Engine.
    Executes the multi-stage recommendation pipeline:
    1. Child profile validation
    2. Calendar-accurate age & stage resolution
    3. Hard food eligibility filtering
    4. Personalization & deterministic scoring
    5. Meal slot allocation & parent-friendly explanations
    6. Structured composite output generation
    """

    def __init__(self, catalog_service: Optional[NutritionCatalogService] = None):
        self.catalog_service = catalog_service or get_nutrition_catalog_service()

    # ========================================================================
    # 1. Validation & Calendar Age Calculation
    # ========================================================================

    def validate_profile_inputs(
        self, profile: ChildNutritionProfile, today: date
    ) -> None:
        """Validates child profile inputs against system boundary rules."""
        validate_dates(
            dob=profile.date_of_birth,
            start_date=profile.complementary_feeding_start_date,
            today=today,
        )

    def calculate_child_age(
        self, profile: ChildNutritionProfile, today: date
    ) -> Tuple[int, int]:
        """Calculates exact completed calendar months and remaining days."""
        return calculate_calendar_age(dob=profile.date_of_birth, today=today)

    # ========================================================================
    # 2. Feeding Stage & Rule Resolution
    # ========================================================================

    def resolve_feeding_stage(
        self,
        completed_months: int,
        days_into_month: int,
        days_since_start: Optional[int],
    ) -> Tuple[FeedingStageId, FeedingRuleRecord]:
        """
        Deterministically resolves the feeding stage and governing rule.
        Correctly distinguishes chronological age from introductory days since start.
        """
        # A. Fifth-Year Completion Boundary (60 completed months and older)
        if completed_months >= COMPLETION_BOUNDARY_MONTHS:
            rule = self.catalog_service.get_feeding_rule("RULE_14_COMPLETION_60M")
            return FeedingStageId.STAGE_60M_PLUS, rule

        # B. Exclusive Breastfeeding (0–5 completed months)
        if completed_months < 6:
            rule = self.catalog_service.get_feeding_rule("RULE_01_BEFORE_6M")
            return FeedingStageId.STAGE_0_TO_6M, rule

        # C. Six Completed Months (Introductory Month)
        if completed_months == 6:
            if days_since_start is not None:
                if days_since_start == 1:
                    return FeedingStageId.STAGE_6M_DAY_1, self.catalog_service.get_feeding_rule("RULE_02_DAY_1")
                elif 2 <= days_since_start <= 3:
                    return FeedingStageId.STAGE_6M_DAYS_2_3, self.catalog_service.get_feeding_rule("RULE_03_DAYS_2_3")
                elif 4 <= days_since_start <= 6:
                    return FeedingStageId.STAGE_6M_DAYS_4_6, self.catalog_service.get_feeding_rule("RULE_04_DAYS_4_6")
                elif 7 <= days_since_start <= 9:
                    return FeedingStageId.STAGE_6M_DAYS_7_9, self.catalog_service.get_feeding_rule("RULE_05_DAYS_7_9")
                elif 10 <= days_since_start <= 15:
                    return FeedingStageId.STAGE_6M_DAYS_10_15, self.catalog_service.get_feeding_rule("RULE_06_DAYS_10_15")
                elif 16 <= days_since_start <= 30:
                    return FeedingStageId.STAGE_6M_DAYS_16_30, self.catalog_service.get_feeding_rule("RULE_07_DAYS_16_30")
                else:
                    return FeedingStageId.STAGE_6M_GENERAL, self.catalog_service.get_feeding_rule("RULE_08_STAGE_6M_GENERAL")
            # If start date unknown, provide safe normative general 6-month guidance
            return FeedingStageId.STAGE_6M_GENERAL, self.catalog_service.get_feeding_rule("RULE_08_STAGE_6M_GENERAL")

        # D. Late Starters (Age >= 7m, complementary feeding started <= 30 days ago)
        if completed_months >= 7 and days_since_start is not None and 1 <= days_since_start <= 30:
            late_rule = self.catalog_service.get_feeding_rule("RULE_15_LATE_STARTER_TRANSITION")
            if completed_months in (7, 8):
                return FeedingStageId.STAGE_7_TO_8M, late_rule
            elif 9 <= completed_months <= 11:
                return FeedingStageId.STAGE_9_TO_11M, late_rule
            elif 12 <= completed_months <= 23:
                return FeedingStageId.STAGE_12_TO_23M, late_rule
            else:
                return FeedingStageId.STAGE_24_TO_59M, late_rule

        # E. Seven Completed Months (Independent milestone rules)
        if completed_months == 7:
            if 0 <= days_into_month <= 6:
                return FeedingStageId.STAGE_7_TO_8M, self.catalog_service.get_feeding_rule("RULE_09A_STAGE_7M_COMPLETED")
            elif 7 <= days_into_month <= 13:
                return FeedingStageId.STAGE_7_TO_8M, self.catalog_service.get_feeding_rule("RULE_09B_STAGE_7M_1WEEK")
            else:
                return FeedingStageId.STAGE_7_TO_8M, self.catalog_service.get_feeding_rule("RULE_09C_STAGE_7M_2WEEKS")

        # F. Eight Completed Months (Traditional staples and finger foods)
        if completed_months == 8:
            return FeedingStageId.STAGE_7_TO_8M, self.catalog_service.get_feeding_rule("RULE_10_STAGE_8M_MILESTONES")

        # G. Nine to Eleven Completed Months (Separate curries & family plate)
        if 9 <= completed_months <= 11:
            return FeedingStageId.STAGE_9_TO_11M, self.catalog_service.get_feeding_rule("RULE_11_STAGE_9_TO_11M")

        # H. Twelve to Twenty-Three Completed Months (1 to 2 Years)
        if 12 <= completed_months <= 23:
            return FeedingStageId.STAGE_12_TO_23M, self.catalog_service.get_feeding_rule("RULE_12_STAGE_12_TO_23M")

        # I. Twenty-Four to Fifty-Nine Completed Months (2 to 5 Years)
        if 24 <= completed_months <= 59:
            return FeedingStageId.STAGE_24_TO_59M, self.catalog_service.get_feeding_rule("RULE_13_STAGE_24_TO_59M")

        return FeedingStageId.STAGE_60M_PLUS, self.catalog_service.get_feeding_rule("RULE_14_COMPLETION_60M")

    # ========================================================================
    # 3. Hard Eligibility Filtering
    # ========================================================================

    def filter_eligible_dishes(
        self,
        all_dishes: List[DishRecord],
        profile: ChildNutritionProfile,
        stage_id: FeedingStageId,
        completed_months: int,
        is_late_starter: bool,
    ) -> List[DishRecord]:
        """
        Applies hard eligibility constraints to all dishes.
        Hard restrictions can NEVER be bypassed by ranking scores or preferences.
        """
        # Parse restricted groups and food IDs
        restricted_group_set: Set[RestrictionGroupCode] = set()
        excluded_food_ids: Set[str] = set()

        for item in profile.restricted_foods:
            # Check if normalized restriction group code
            try:
                rg = RestrictionGroupCode(item)
                restricted_group_set.add(rg)
            except ValueError:
                # Treat as individual ingredient ID
                excluded_food_ids.add(item)

        # Check vegetarian preference
        is_vegetarian = "VEGETARIAN" in (p.upper() for p in profile.dietary_preferences)
        animal_meat_fish_ids = {
            "ING_SPRATS", "ING_FISH_SEA", "ING_CHICKEN", "ING_LIVER", "ING_MEAT", "ING_KUNISSO"
        }

        # Check egg introduction history
        egg_yolk_confirmed = "ING_EGG_YOLK" in profile.foods_introduced
        available_set = set(profile.available_ingredients)

        eligible: List[DishRecord] = []

        for dish in all_dishes:
            # 1. Chronological Age minimum
            if dish.min_calendar_months > completed_months:
                continue

            # 2. Stage eligibility
            if is_late_starter:
                # For late starters, introductory mash dishes or age-appropriate semi-solid dishes are eligible
                intro_stages = {
                    FeedingStageId.STAGE_6M_DAY_1,
                    FeedingStageId.STAGE_6M_DAYS_2_3,
                    FeedingStageId.STAGE_6M_DAYS_4_6,
                    FeedingStageId.STAGE_6M_DAYS_7_9,
                    FeedingStageId.STAGE_6M_DAYS_10_15,
                    FeedingStageId.STAGE_6M_DAYS_16_30,
                    FeedingStageId.STAGE_6M_GENERAL,
                }
                if not (any(st in intro_stages for st in dish.eligible_stages) or stage_id in dish.eligible_stages):
                    continue
                # Texture check for late starter: must be puree, semi-solid mash, or half-mashed
                if dish.texture not in (FoodTexture.SMOOTH_PUREE, FoodTexture.SEMI_SOLID_MASH, FoodTexture.HALF_MASHED):
                    continue
            else:
                if stage_id not in dish.eligible_stages:
                    continue

            # Hard Texture Check: Coarser textures cannot leak into earlier stages
            if stage_id in (
                FeedingStageId.STAGE_6M_DAY_1,
                FeedingStageId.STAGE_6M_DAYS_2_3,
                FeedingStageId.STAGE_6M_DAYS_4_6,
                FeedingStageId.STAGE_6M_DAYS_7_9,
                FeedingStageId.STAGE_6M_DAYS_10_15,
                FeedingStageId.STAGE_6M_GENERAL,
            ):
                if dish.texture not in (FoodTexture.SEMI_SOLID_MASH, FoodTexture.SMOOTH_PUREE, FoodTexture.LIQUID):
                    continue
            elif stage_id == FeedingStageId.STAGE_6M_DAYS_16_30:
                if dish.texture not in (FoodTexture.HALF_MASHED, FoodTexture.SEMI_SOLID_MASH, FoodTexture.SMOOTH_PUREE):
                    continue
            elif stage_id == FeedingStageId.STAGE_7_TO_8M and completed_months == 7:
                if dish.texture not in (FoodTexture.COARSELY_MASHED, FoodTexture.HALF_MASHED, FoodTexture.SEMI_SOLID_MASH):
                    continue

            # 3. Restriction groups contained check
            if any(rg in restricted_group_set for rg in dish.restriction_groups_contained):
                continue

            # 4. Individual excluded ingredient check
            if any(ing in excluded_food_ids for ing in dish.ingredients):
                continue

            # 5. Vegetarian preference check
            if is_vegetarian and any(ing in animal_meat_fish_ids for ing in dish.ingredients):
                continue

            # 6. Whole egg introduction prerequisite check
            # Dishes with whole egg or egg white are strictly gated until egg yolk is confirmed tolerated
            if any(ing in ("ING_EGG_WHOLE", "ING_EGG_WHITE") for ing in dish.ingredients):
                if not egg_yolk_confirmed:
                    continue

            # 7. Only Available Ingredients Mode check
            if profile.only_available_ingredients:
                if not all(ing in available_set for ing in dish.ingredients):
                    continue

            eligible.append(dish)

        return eligible

    def filter_eligible_snacks(
        self,
        all_snacks: List[SnackRecord],
        profile: ChildNutritionProfile,
        stage_id: FeedingStageId,
        completed_months: int,
    ) -> List[SnackRecord]:
        """Applies hard eligibility constraints to snacks."""
        if completed_months < 7:
            return []

        restricted_group_set: Set[RestrictionGroupCode] = set()
        excluded_food_ids: Set[str] = set()

        for item in profile.restricted_foods:
            try:
                rg = RestrictionGroupCode(item)
                restricted_group_set.add(rg)
            except ValueError:
                excluded_food_ids.add(item)

        is_vegetarian = "VEGETARIAN" in (p.upper() for p in profile.dietary_preferences)
        egg_yolk_confirmed = "ING_EGG_YOLK" in profile.foods_introduced
        available_set = set(profile.available_ingredients)

        eligible: List[SnackRecord] = []

        for snack in all_snacks:
            if snack.min_calendar_months > completed_months:
                continue

            # Hard Developmental Safety: Finger foods begin at 8 completed months (Booklet p. 11).
            # Soft spoon-fed snacks (scraped fruit, mashed sweet potato) are permitted at 7 months.
            if completed_months < 8 and snack.is_finger_food:
                continue

            if stage_id not in snack.eligible_stages:
                continue

            if any(rg in restricted_group_set for rg in snack.restriction_groups):
                continue

            if any(ing in excluded_food_ids for ing in snack.ingredients):
                continue

            if any(ing in ("ING_EGG_WHOLE", "ING_EGG_WHITE") for ing in snack.ingredients):
                if not egg_yolk_confirmed:
                    continue

            if profile.only_available_ingredients:
                if not all(ing in available_set for ing in snack.ingredients):
                    continue

            eligible.append(snack)

        return eligible

    # ========================================================================
    # 4. Personalization & Deterministic Ranking
    # ========================================================================

    def rank_dishes(
        self,
        eligible_dishes: List[DishRecord],
        profile: ChildNutritionProfile,
    ) -> List[Tuple[DishRecord, float, List[str]]]:
        """
        Ranks eligible dishes using explainable, deterministic scoring criteria:
        - Available household ingredients (+10 per ingredient, +15 if 100% available)
        - Vegetarian preference match (+20)
        - Previously introduced familiar foods (+10)
        - Recent meal repetition penalty (-30)
        - Egg yolk tolerance confirmed (+10)
        Deterministic tie-breaking: Tier A > Tier B, food group variety count, then dish_id.
        """
        available_set = set(profile.available_ingredients)
        introduced_set = set(profile.foods_introduced)
        recent_set = set(profile.recent_meal_history)
        is_vegetarian = "VEGETARIAN" in (p.upper() for p in profile.dietary_preferences)

        ranked: List[Tuple[DishRecord, float, List[str]]] = []

        for dish in eligible_dishes:
            score = 0.0
            factors: List[str] = []

            # 1. Household Availability
            avail_count = sum(1 for ing in dish.ingredients if ing in available_set)
            if avail_count > 0:
                score += avail_count * 10.0
                factors.append(f"{avail_count} ingredient(s) on-hand in kitchen")

            if len(dish.ingredients) > 0 and avail_count == len(dish.ingredients):
                score += 15.0
                factors.append("All ingredients fully available in household")

            # 2. Preference Matching
            if is_vegetarian:
                # Plant-based dishes receive bonus
                score += 20.0
                factors.append("Matches vegetarian dietary preference")

            # 3. Familiarity / Prior Introduction
            if len(dish.ingredients) > 0 and all(ing in introduced_set for ing in dish.ingredients):
                score += 10.0
                factors.append("Contains previously tolerated foods")

            # 4. Recent Repetition Penalty
            if dish.dish_id in recent_set:
                score -= 30.0
                factors.append("Recently consumed (rotated down for dietary variety)")

            # 5. Whole egg tolerance bonus
            if "ING_EGG_WHOLE" in dish.ingredients and "ING_EGG_YOLK" in introduced_set:
                score += 10.0
                factors.append("Safe whole egg progression (egg yolk tolerance confirmed)")

            ranked.append((dish, score, factors))

        # Deterministic sorting
        # Priority: score DESC, Tier A (1) > Tier B (0), food group count DESC, dish_id ASC
        def sort_key(item: Tuple[DishRecord, float, List[str]]):
            d, sc, _ = item
            tier_val = 2 if d.evidence_tier == EvidenceTier.TIER_A else (1 if d.evidence_tier == EvidenceTier.TIER_B else 0)
            return (-sc, -tier_val, -len(d.ingredients), d.dish_id)

        ranked.sort(key=sort_key)
        return ranked

    def rank_snacks(
        self,
        eligible_snacks: List[SnackRecord],
        profile: ChildNutritionProfile,
    ) -> List[Tuple[SnackRecord, float, List[str]]]:
        """Ranks eligible snacks using explainable, deterministic scoring."""
        available_set = set(profile.available_ingredients)
        recent_set = set(profile.recent_meal_history)

        ranked: List[Tuple[SnackRecord, float, List[str]]] = []

        for snack in eligible_snacks:
            score = 0.0
            factors: List[str] = []

            avail_count = sum(1 for ing in snack.ingredients if ing in available_set)
            if avail_count > 0:
                score += avail_count * 10.0
                factors.append(f"{avail_count} ingredient(s) available in household")

            if len(snack.ingredients) > 0 and avail_count == len(snack.ingredients):
                score += 15.0
                factors.append("All ingredients on-hand")

            if snack.snack_id in recent_set:
                score -= 30.0
                factors.append("Recently consumed snack (variety rotation)")

            ranked.append((snack, score, factors))

        def sort_key(item: Tuple[SnackRecord, float, List[str]]):
            sn, sc, _ = item
            tier_val = 2 if sn.evidence_tier == EvidenceTier.TIER_A else 1
            return (-sc, -tier_val, -len(sn.ingredients), sn.snack_id)

        ranked.sort(key=sort_key)
        return ranked

    # ========================================================================
    # 5. Composite Recommendations Builder
    # ========================================================================

    def build_recommendations(
        self,
        stage_id: FeedingStageId,
        rule: FeedingRuleRecord,
        ranked_dishes: List[Tuple[DishRecord, float, List[str]]],
        ranked_snacks: List[Tuple[SnackRecord, float, List[str]]],
        profile: ChildNutritionProfile,
    ) -> List[MealRecommendationItem]:
        """Maps ranked dishes and snacks into stage-appropriate meal slots."""
        items: List[MealRecommendationItem] = []
        available_set = set(profile.available_ingredients)

        # Early stages: 0 to 6 months
        if stage_id == FeedingStageId.STAGE_0_TO_6M:
            return []

        if stage_id == FeedingStageId.STAGE_6M_DAY_1:
            if ranked_dishes:
                dish, score, factors = ranked_dishes[0]
                items.append(self._dish_to_recommendation(
                    rec_id="REC_01_DAY1_TASTE",
                    meal_slot=MealType.TASTE_SESSION,
                    dish=dish,
                    rule=rule,
                    score=score,
                    factors=factors,
                    available_set=available_set,
                    custom_reason=(
                        "Day 1 Complementary Feeding Inception: Soft mashed rice mixed with expressed "
                        "breast milk gives a familiar flavor to ease transition to solid foods [Booklet p. 5, PDF p. 7]."
                    )
                ))
            return items

        if stage_id == FeedingStageId.STAGE_6M_DAYS_2_3:
            if ranked_dishes:
                dish, score, factors = ranked_dishes[0]
                items.append(self._dish_to_recommendation(
                    rec_id="REC_01_DAYS2_3_MEAL1",
                    meal_slot=MealType.MAIN_MEAL,
                    dish=dish,
                    rule=rule,
                    score=score,
                    factors=factors,
                    available_set=available_set,
                    custom_reason="Days 2–3 Early Progression: Practice swallowing soft semi-solid mashed rice [Booklet p. 5, PDF p. 7]."
                ))
            return items

        if stage_id == FeedingStageId.STAGE_6M_DAYS_4_6:
            # 2 Main meals
            if ranked_dishes:
                dish, score, factors = ranked_dishes[0]
                items.append(self._dish_to_recommendation(
                    rec_id="REC_01_DAYS4_6_MEAL1",
                    meal_slot=MealType.MAIN_MEAL,
                    dish=dish,
                    rule=rule,
                    score=score,
                    factors=factors,
                    available_set=available_set,
                    custom_reason="Days 4–6 Pulse Introduction: Red lentils (dhal) introduce plant protein and iron [Booklet p. 5, PDF p. 7]."
                ))
                items.append(self._dish_to_recommendation(
                    rec_id="REC_02_DAYS4_6_MEAL2",
                    meal_slot=MealType.MAIN_MEAL,
                    dish=dish,
                    rule=rule,
                    score=score,
                    factors=factors,
                    available_set=available_set,
                    custom_reason="Second daily meal reinforcing single-food tolerance and fruit pairing [Booklet p. 5, PDF p. 7]."
                ))
            return items

        # Determine meal slots based on stage
        meal_slots: List[MealType] = []
        snack_count = 0

        if stage_id in (FeedingStageId.STAGE_6M_DAYS_7_9, FeedingStageId.STAGE_6M_DAYS_10_15, FeedingStageId.STAGE_6M_GENERAL):
            meal_slots = [MealType.MAIN_MEAL, MealType.MAIN_MEAL]
        elif stage_id == FeedingStageId.STAGE_6M_DAYS_16_30:
            meal_slots = [MealType.MAIN_MEAL, MealType.MAIN_MEAL, MealType.MAIN_MEAL]
        elif stage_id == FeedingStageId.STAGE_7_TO_8M:
            # Check if 7m baseline (no snacks) or 7m+1w / 8m (with snacks)
            if rule.rule_id == "RULE_09A_STAGE_7M_COMPLETED":
                meal_slots = [MealType.MAIN_MEAL, MealType.MAIN_MEAL, MealType.MAIN_MEAL]
            else:
                meal_slots = [MealType.MAIN_MEAL, MealType.MAIN_MEAL, MealType.MAIN_MEAL]
                snack_count = 1
        elif stage_id == FeedingStageId.STAGE_9_TO_11M:
            meal_slots = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER]
            snack_count = 1
        elif stage_id in (FeedingStageId.STAGE_12_TO_23M, FeedingStageId.STAGE_24_TO_59M):
            meal_slots = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER]
            snack_count = 2

        # Allocate main meals with variety rotation
        if ranked_dishes:
            for i, slot in enumerate(meal_slots):
                # Pick distinct dishes if available, otherwise cycle
                dish_idx = i % len(ranked_dishes)
                dish, score, factors = ranked_dishes[dish_idx]

                rec_id = f"REC_{i+1:02d}_{slot.value}_{dish.dish_id}"
                items.append(self._dish_to_recommendation(
                    rec_id=rec_id,
                    meal_slot=slot,
                    dish=dish,
                    rule=rule,
                    score=score,
                    factors=factors,
                    available_set=available_set,
                ))

        # Allocate snacks
        if snack_count > 0 and ranked_snacks:
            for j in range(snack_count):
                snack_idx = j % len(ranked_snacks)
                snack, score, factors = ranked_snacks[snack_idx]
                rec_id = f"REC_SNACK_{j+1:02d}_{snack.snack_id}"
                items.append(self._snack_to_recommendation(
                    rec_id=rec_id,
                    snack=snack,
                    rule=rule,
                    score=score,
                    factors=factors,
                    available_set=available_set,
                ))

        return items

    def _dish_to_recommendation(
        self,
        rec_id: str,
        meal_slot: MealType,
        dish: DishRecord,
        rule: FeedingRuleRecord,
        score: float,
        factors: List[str],
        available_set: Set[str],
        custom_reason: Optional[str] = None,
    ) -> MealRecommendationItem:
        """Constructs a MealRecommendationItem from a DishRecord."""
        all_avail = len(dish.ingredients) > 0 and all(ing in available_set for ing in dish.ingredients)

        # Build food groups list
        food_groups = self._get_food_groups_for_ingredients(dish.ingredients)

        portion_desc = (
            f"Verified FHB portion: {dish.household_portion}"
            if dish.evidence_tier == EvidenceTier.TIER_A
            else f"Derived guidance portion: {dish.household_portion}"
        )
        # Reason for recommendation
        if custom_reason:
            reason = custom_reason
        else:
            reason = f"{dish.developmental_rationale} {portion_desc}."
            if factors:
                reason += f" Personalization notes: {', '.join(factors)}."

        return MealRecommendationItem(
            recommendation_id=rec_id,
            meal_slot=meal_slot,
            dish_or_food_id=dish.dish_id,
            name=dish.name,
            sinhala_name=dish.sinhala_name,
            item_type="DISH",
            ingredients=dish.ingredients,
            food_groups=food_groups,
            texture=dish.texture,
            household_portion=dish.household_portion,
            preparation_instructions=dish.preparation_steps,
            safety_precautions=dish.safety_precautions,
            recommendation_reason=reason,
            evidence_tier=dish.evidence_tier,
            source_citation=dish.source_citation,
            is_available_in_household=all_avail,
            ranking_score=score,
            ranking_factors=factors,
        )

    def _snack_to_recommendation(
        self,
        rec_id: str,
        snack: SnackRecord,
        rule: FeedingRuleRecord,
        score: float,
        factors: List[str],
        available_set: Set[str],
    ) -> MealRecommendationItem:
        """Constructs a MealRecommendationItem from a SnackRecord."""
        all_avail = len(snack.ingredients) > 0 and all(ing in available_set for ing in snack.ingredients)
        food_groups = self._get_food_groups_for_ingredients(snack.ingredients)

        finger_note = " Supervised finger food encouraging self-feeding and fine motor grasp." if snack.is_finger_food else ""
        portion_desc = (
            f"Derived guidance portion: {snack.household_portion}"
            if ("derived" in snack.household_portion.lower() or snack.evidence_tier == EvidenceTier.TIER_B)
            else f"Verified FHB portion: {snack.household_portion}"
        )
        reason = f"Nutritious Sri Lankan snack providing energy and micronutrients between meals.{finger_note} {portion_desc}."
        if factors:
            reason += f" Personalization notes: {', '.join(factors)}."

        return MealRecommendationItem(
            recommendation_id=rec_id,
            meal_slot=MealType.SNACK,
            dish_or_food_id=snack.snack_id,
            name=snack.name,
            sinhala_name=snack.sinhala_name,
            item_type="SNACK",
            ingredients=snack.ingredients,
            food_groups=food_groups,
            texture=snack.texture,
            household_portion=snack.household_portion,
            preparation_instructions=snack.preparation_instructions,
            safety_precautions=snack.safety_precautions,
            recommendation_reason=reason,
            evidence_tier=snack.evidence_tier,
            source_citation=snack.source_citation,
            is_available_in_household=all_avail,
            ranking_score=score,
            ranking_factors=factors,
        )

    def _get_food_groups_for_ingredients(self, ingredient_ids: List[str]) -> List[FoodGroup]:
        """Resolves canonical food groups for a list of ingredient IDs."""
        groups: Set[FoodGroup] = set()
        for ing_id in ingredient_ids:
            ing = self.catalog_service.get_ingredient(ing_id)
            if ing:
                groups.add(ing.food_group)
        # Deterministic sorting
        return sorted(list(groups), key=lambda g: g.value)

    # ========================================================================
    # 6. Public Service API
    # ========================================================================

    def generate_nutrition_recommendations(
        self,
        profile: ChildNutritionProfile,
        evaluation_date: Optional[date] = None,
    ) -> NutritionRecommendationResponse:
        """
        Executes the complete deterministic recommendation engine for a child profile.
        Returns a strongly validated NutritionRecommendationResponse.
        """
        # Ensure catalogue is loaded
        catalog = self.catalog_service.load_catalog()

        # 1. Determine evaluation date (Asia/Colombo default, injectable override)
        today = evaluation_date or get_colombo_today()

        # 2. Input validation
        self.validate_profile_inputs(profile=profile, today=today)

        # 3. Calendar age arithmetic
        completed_months, remaining_days = self.calculate_child_age(profile=profile, today=today)
        is_eligible = MIN_ELIGIBLE_COMPLETED_MONTHS <= completed_months <= MAX_ELIGIBLE_COMPLETED_MONTHS
        is_completion_boundary = completed_months >= COMPLETION_BOUNDARY_MONTHS

        # 4. Complementary feeding days since start calculation
        days_since_start: Optional[int] = None
        if profile.complementary_feeding_start_date is not None:
            days_since_start = (today - profile.complementary_feeding_start_date).days + 1

        # 5. Stage & Rule resolution
        stage_id, rule = self.resolve_feeding_stage(
            completed_months=completed_months,
            days_into_month=remaining_days,
            days_since_start=days_since_start,
        )

        is_late_starter = rule.is_late_starter_rule if rule else False

        # 6. Boundary Special Cases
        # Case A: Child reaching exact 60-month completion boundary
        if is_completion_boundary:
            return NutritionRecommendationResponse(
                child_age_completed_months=completed_months,
                child_age_remaining_days=remaining_days,
                is_eligible=False,
                is_at_completion_boundary=True,
                feeding_stage=stage_id,
                stage_name=rule.stage_name if rule else "Completion Boundary (5th Birthday)",
                feeding_rule=rule,
                meal_frequency_guidance="Transition to Family Health Bureau school-age child nutrition guidelines.",
                daily_snack_frequency_guidance=None,
                milk_feeding_guidance="Continue healthy family beverage patterns. Avoid sugary and ultra-processed drinks.",
                general_preparation_instructions=[
                    "The child has reached their fifth birthday (60 completed calendar months) and completed the early childhood research component boundary.",
                    "No newly generated daily or weekly complementary/preschool meal plan is produced under this research component.",
                    "Caregivers are encouraged to continue wholesome family table eating habits aligned with national school-age nutrition advice."
                ],
                safety_and_hygiene_guidance=[
                    "Continue nutritious family foods rich in vegetables, green leaves, fruits, and animal-source proteins.",
                    "Limit sugar, salt, and commercial ultra-processed foods."
                ],
                special_notice="Child has completed the 0–59 completed months research component boundary. Direct caregiver to school-age nutrition guidelines.",
                recommendations=[],
                available_substitutions={},
                evaluation_date=today,
                evidence_summary={"TIER_C": 1},
            )

        # Case B: Young infant before 6 completed months (0–5 completed months)
        if completed_months < 6:
            if profile.milk_feeding_method == "infant_formula_only":
                infant_milk_guidance = (
                    "National FHB guidelines mandate exclusive breast milk for infants under 6 completed months. "
                    "For infants not receiving breast milk, feed strictly infant formula prepared according to physician "
                    "instructions. No water, glucose water, tea, animal milk, or solid foods should be given [Booklet pp. 2, 5, PDF pp. 4, 7]."
                )
            elif profile.milk_feeding_method in ("exclusive_breastfeeding", "complementary_breastfeeding"):
                infant_milk_guidance = (
                    "Feed exclusively on breast milk on demand, day and night (at least 8 to 12 times in 24 hours). "
                    "No water, glucose water, formula milk, tea, or animal milk should be given unless ordered by a physician [Booklet pp. 2, 5, PDF pp. 4, 7]."
                )
            else:
                # Unknown / unrecorded feeding history: preserve FHB guidance without asserting actual method
                infant_milk_guidance = (
                    "National FHB guidelines mandate exclusive breastfeeding on demand, day and night (at least 8 to 12 times in 24 hours) "
                    "for infants under 6 completed calendar months. If the infant is not receiving breast milk, feed recommended infant formula "
                    "as ordered by a physician. Solid foods and animal milk are strictly prohibited before 6 completed months [Booklet pp. 2, 5, PDF pp. 4, 7]."
                )

            return NutritionRecommendationResponse(
                child_age_completed_months=completed_months,
                child_age_remaining_days=remaining_days,
                is_eligible=True,
                is_at_completion_boundary=False,
                feeding_stage=stage_id,
                stage_name=rule.stage_name if rule else "Exclusive Breastfeeding (0–6 Months)",
                feeding_rule=rule,
                meal_frequency_guidance=rule.daily_meal_frequency if rule else "On demand, day and night",
                daily_snack_frequency_guidance=None,
                milk_feeding_guidance=infant_milk_guidance,
                general_preparation_instructions=rule.preparation_instructions if rule else [],
                safety_and_hygiene_guidance=rule.safety_and_hygiene_guidance if rule else [],
                special_notice="Infant is under 6 completed calendar months. FHB guidelines mandate exclusive breastfeeding on demand. Solid foods and non-breast milk liquids are strictly prohibited.",
                recommendations=[],
                available_substitutions={},
                evaluation_date=today,
                evidence_summary={"TIER_A": 1},
            )

        # 7. Hard Constraint Filtering
        eligible_dishes = self.filter_eligible_dishes(
            all_dishes=catalog.dishes,
            profile=profile,
            stage_id=stage_id,
            completed_months=completed_months,
            is_late_starter=is_late_starter,
        )

        eligible_snacks = self.filter_eligible_snacks(
            all_snacks=catalog.snacks,
            profile=profile,
            stage_id=stage_id,
            completed_months=completed_months,
        )

        # 8. Deterministic Personalization & Ranking
        ranked_dishes = self.rank_dishes(eligible_dishes=eligible_dishes, profile=profile)
        ranked_snacks = self.rank_snacks(eligible_snacks=eligible_snacks, profile=profile)

        # 9. Build Recommendations
        recommendations = self.build_recommendations(
            stage_id=stage_id,
            rule=rule,
            ranked_dishes=ranked_dishes,
            ranked_snacks=ranked_snacks,
            profile=profile,
        )

        # 10. Available Substitutions for recommended primary foods
        available_substitutions: Dict[str, List[str]] = {}
        for rec in recommendations:
            for ing_id in rec.ingredients:
                if ing_id in available_substitutions:
                    continue
                # Query eligible category substitutes from Phase 3 catalog
                alts = self.catalog_service.get_substitutes_for_food(
                    food_id=ing_id,
                    restricted_groups=[RestrictionGroupCode(rg) for rg in profile.restricted_foods if rg in RestrictionGroupCode.__members__],
                    excluded_food_ids=[rg for rg in profile.restricted_foods if rg not in RestrictionGroupCode.__members__],
                    child_completed_months=completed_months,
                    feeding_stage=stage_id,
                    foods_introduced=profile.foods_introduced,
                )
                if alts:
                    available_substitutions[ing_id] = [a.food_id for a in alts]

        # 11. Milk Feeding Guidance Formulation
        if completed_months < 12:
            milk_guidance = (
                "Continue breastfeeding on demand after or between meals. "
                "Breast milk remains the primary source of nutrients and protective antibodies in the first year."
            )
        else:
            # 1–5 years
            if profile.milk_feeding_method in ("infant_formula_only", "cow_milk", "other"):
                milk_guidance = (
                    "Non-breastfed child (1–5 years): Provide 1 cup curd OR 1 cup plain yoghurt OR "
                    "1 matchbox-sized piece of cheese daily to provide adequate dietary calcium and protein [Booklet p. 16, PDF p. 18]."
                )
            elif profile.milk_feeding_method in ("exclusive_breastfeeding", "complementary_breastfeeding"):
                milk_guidance = (
                    "Continue breastfeeding 2 to 3 times a day after meals. "
                    "Breastfeeding provides valuable nutrition and comfort throughout the second year and beyond [Booklet p. 16, PDF p. 18]."
                )
            else:
                # Unknown method: provide both
                milk_guidance = (
                    "Breastfed children: Continue breastfeeding 2 to 3 times a day after meals [Booklet p. 16, PDF p. 18]. "
                    "Non-breastfed children: Offer 1 cup curd OR 1 cup yoghurt OR 1 matchbox-sized piece of cheese daily."
                )

        # 12. Special notice formulation
        special_notice: Optional[str] = None
        if stage_id == FeedingStageId.STAGE_6M_GENERAL and profile.complementary_feeding_start_date is None:
            special_notice = (
                "Complementary feeding start date is unrecorded. Providing safe normative 6-month introductory guidance. "
                "Caregiver can record the exact start date in check-in for day-by-day progression tracking."
            )
        elif is_late_starter:
            special_notice = (
                f"Child is {completed_months} completed months old and started complementary foods recently "
                f"({days_since_start} days ago). Applying introductory food tolerance transition guidance (Tier B) "
                f"while adapting meal portions to appetite and developmental readiness."
            )
        elif not recommendations:
            special_notice = (
                "No dishes in the knowledge base match the child's age, stage, and strict dietary exclusions "
                "without violating hard safety or allergy constraints."
            )

        # 13. Evidence summary & generated meal counts calculation
        evidence_counts: Dict[str, int] = {}
        main_meals_count = 0
        snacks_count = 0
        for rec in recommendations:
            tier_str = rec.evidence_tier.value
            evidence_counts[tier_str] = evidence_counts.get(tier_str, 0) + 1
            if rec.meal_slot == MealType.SNACK:
                snacks_count += 1
            else:
                main_meals_count += 1

        # Clarify distinction between recommended snack frequency and generated catalogue snacks
        if rule and rule.daily_snack_frequency and snacks_count == 0:
            snack_explanation = (
                f"Recommended snack frequency is {rule.daily_snack_frequency}. "
                "No structured catalogue snacks were allocated because formal finger-food snacks begin at 8 completed "
                "calendar months (Booklet p. 11). For 7-month infants, provide informal snacks between meals "
                "using fresh scraped fruit (such as ripe papaya or banana) or mashed sweet potato as tolerated."
            )
            if special_notice:
                special_notice = f"{special_notice} {snack_explanation}"
            else:
                special_notice = snack_explanation

        return NutritionRecommendationResponse(
            child_age_completed_months=completed_months,
            child_age_remaining_days=remaining_days,
            is_eligible=is_eligible,
            is_at_completion_boundary=is_completion_boundary,
            feeding_stage=stage_id,
            stage_name=rule.stage_name if rule else stage_id.value,
            feeding_rule=rule,
            meal_frequency_guidance=rule.daily_meal_frequency if rule else "Age-appropriate meal schedule",
            daily_snack_frequency_guidance=rule.daily_snack_frequency if rule else None,
            generated_main_meals_count=main_meals_count,
            generated_snacks_count=snacks_count,
            milk_feeding_guidance=milk_guidance,
            general_preparation_instructions=rule.preparation_instructions if rule else [],
            safety_and_hygiene_guidance=rule.safety_and_hygiene_guidance if rule else [],
            special_notice=special_notice,
            recommendations=recommendations,
            available_substitutions=available_substitutions,
            evaluation_date=today,
            evidence_summary=evidence_counts,
        )


# ============================================================================
# Singleton Accessor
# ============================================================================

_recommendation_service_instance: Optional[NutritionRecommendationService] = None

def get_nutrition_recommendation_service() -> NutritionRecommendationService:
    """Returns singleton instance of the NutritionRecommendationService."""
    global _recommendation_service_instance
    if _recommendation_service_instance is None:
        _recommendation_service_instance = NutritionRecommendationService()
    return _recommendation_service_instance

def reset_nutrition_recommendation_service() -> None:
    """Resets singleton instance for testing."""
    global _recommendation_service_instance
    _recommendation_service_instance = None

def generate_nutrition_recommendations(
    profile: ChildNutritionProfile,
    evaluation_date: Optional[date] = None,
) -> NutritionRecommendationResponse:
    """Convenience function delegating to the singleton NutritionRecommendationService."""
    service = get_nutrition_recommendation_service()
    return service.generate_nutrition_recommendations(profile=profile, evaluation_date=evaluation_date)
