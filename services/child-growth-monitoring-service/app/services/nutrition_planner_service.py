"""Personalized Sri Lankan Nutrition Meal Planner Service.

Primary Reference:
'Right Food at the Right Time, To Make My Baby Healthy and Bright',
Family Health Bureau (FHB), Ministry of Health, Sri Lanka (2025).

Implements deterministic, age-appropriate Daily and Weekly Meal Planning
for infants and young children aged 0–59 completed calendar months.
"""

from datetime import date, timedelta
from typing import Dict, List, Optional, Set, Tuple

from app.schemas.nutrition import (
    COMPLETION_BOUNDARY_MONTHS,
    MAX_ELIGIBLE_COMPLETED_MONTHS,
    MIN_ELIGIBLE_COMPLETED_MONTHS,
    ChildNutritionProfile,
    DailyMealPlanResponse,
    DishRecord,
    EvidenceTier,
    FeedingRuleRecord,
    FeedingStageId,
    FoodGroup,
    MealRecommendationItem,
    MealType,
    PlannedMealSlot,
    SnackRecord,
    SubstituteValidationResponse,
    WeeklyGroceryItem,
    WeeklyMealPlanResponse,
)
from app.services.nutrition_catalog_service import (
    NutritionCatalogService,
    calculate_calendar_age,
    get_colombo_today,
    get_nutrition_catalog_service,
    is_age_eligible,
    is_at_completion_boundary,
    validate_dates,
)
from app.services.nutrition_recommendation_service import (
    NutritionRecommendationService,
    get_nutrition_recommendation_service,
)


class NutritionPlannerService:
    """
    Deterministic Daily and Weekly Meal Planner Service.
    
    Adheres strictly to Family Health Bureau (FHB) 2025 guidelines:
    - Resolves child age and feeding stage independently on EACH calendar date.
    - Preserves hard allergy, texture, age, and food-introduction constraints.
    - Implements an explainable, deterministic rotation scoring algorithm for 7-day variety.
    - Generates a consolidated household pantry/grocery checklist without synthetic gram conversions.
    - Never generates meal plans at or after 60 completed calendar months.
    """

    def __init__(
        self,
        catalog_service: Optional[NutritionCatalogService] = None,
        recommendation_service: Optional[NutritionRecommendationService] = None,
    ):
        self.catalog_service = catalog_service or get_nutrition_catalog_service()
        self.recommendation_service = recommendation_service or get_nutrition_recommendation_service()

    # ========================================================================
    # Daily Meal Plan Generation
    # ========================================================================

    def generate_daily_meal_plan(
        self,
        profile: ChildNutritionProfile,
        plan_date: Optional[date] = None,
        recent_history_override: Optional[List[str]] = None,
        accumulated_week_dishes: Optional[Dict[str, List[date]]] = None,
        accumulated_week_snacks: Optional[Dict[str, List[date]]] = None,
        baby_id: int = 0,
    ) -> DailyMealPlanResponse:
        """
        Generates an age-appropriate daily meal plan for a single calendar date.
        """
        catalog = self.catalog_service.load_catalog()
        today = plan_date or get_colombo_today()

        # Input validation for planning date
        colombo_today = get_colombo_today()
        if profile.date_of_birth > colombo_today:
            raise DateValidationError("ERR_FUTURE_DOB: Child date of birth cannot be in the future.")
        if profile.date_of_birth > today:
            raise DateValidationError("ERR_EVAL_BEFORE_DOB: Evaluation date cannot precede baby's date of birth.")
        if profile.complementary_feeding_start_date is not None:
            if profile.complementary_feeding_start_date > colombo_today:
                raise DateValidationError("ERR_FUTURE_START_DATE: Complementary feeding start date cannot be in the future.")
            if profile.complementary_feeding_start_date < profile.date_of_birth:
                raise DateValidationError("ERR_START_DATE_BEFORE_DOB: Complementary feeding start date cannot be before date of birth.")

        # Calendar age arithmetic on the specific plan date
        completed_months, remaining_days = calculate_calendar_age(dob=profile.date_of_birth, today=today)
        is_eligible = MIN_ELIGIBLE_COMPLETED_MONTHS <= completed_months <= MAX_ELIGIBLE_COMPLETED_MONTHS
        is_completion_boundary = completed_months >= COMPLETION_BOUNDARY_MONTHS
        is_under_six = completed_months < 6

        day_name = today.strftime("%A")

        # 1. Scope Boundary: 60 completed months and above
        if is_completion_boundary:
            rule = self.catalog_service.resolve_feeding_rule(completed_months=completed_months)
            return DailyMealPlanResponse(
                baby_id=baby_id,
                plan_date=today,
                day_of_week=day_name,
                child_age_completed_months=completed_months,
                child_age_remaining_days=remaining_days,
                is_eligible=False,
                is_at_completion_boundary=True,
                is_under_six_months=False,
                feeding_stage=FeedingStageId.STAGE_60M_PLUS,
                stage_name=rule.stage_name if rule else "Five Years Completed (FHB School-Age Guidance)",
                feeding_rule=rule,
                meal_frequency_guidance="Transition to family meals and school-age child nutrition guidelines.",
                daily_snack_frequency_guidance=None,
                milk_feeding_guidance="Offer 1 to 2 portions of dairy daily (curd, yoghurt, or milk) as part of family food.",
                planned_meals=[],
                planned_snacks=[],
                general_preparation_instructions=rule.preparation_instructions if rule else [],
                safety_and_hygiene_guidance=rule.safety_and_hygiene_guidance if rule else [],
                special_notice="Child has reached 60 completed calendar months (5th birthday). Research boundary complete. Please refer to Ministry of Health school-age guidelines.",
                evidence_summary={"TIER_A": 1},
                source_citation=rule.source_citation if rule else None,
            )

        # 2. Stage Resolution for this specific date
        days_since_start: Optional[int] = None
        if profile.complementary_feeding_start_date is not None and today >= profile.complementary_feeding_start_date:
            days_since_start = (today - profile.complementary_feeding_start_date).days + 1

        stage_id, rule = self.recommendation_service.resolve_feeding_stage(
            completed_months=completed_months,
            days_into_month=remaining_days,
            days_since_start=days_since_start,
        )

        # 3. Under 6 completed months: Exclusive Milk Feeding
        if is_under_six:
            if profile.milk_feeding_method == "infant_formula_only":
                infant_milk_guidance = (
                    "For infants not receiving breast milk, feed strictly infant formula prepared according to physician "
                    "instructions. No water, glucose water, tea, animal milk, or solid foods should be given [Booklet pp. 2, 5]."
                )
            elif profile.milk_feeding_method in ("exclusive_breastfeeding", "complementary_breastfeeding"):
                infant_milk_guidance = (
                    "Feed exclusively on breast milk on demand, day and night (at least 8 to 12 times in 24 hours). "
                    "No water, glucose water, formula milk, tea, or animal milk should be given [Booklet pp. 2, 5]."
                )
            else:
                infant_milk_guidance = (
                    "National FHB guidelines mandate exclusive breastfeeding on demand, day and night (at least 8 to 12 times in 24 hours) "
                    "for infants under 6 completed calendar months. Solid foods and non-breast milk liquids are strictly prohibited."
                )

            return DailyMealPlanResponse(
                baby_id=baby_id,
                plan_date=today,
                day_of_week=day_name,
                child_age_completed_months=completed_months,
                child_age_remaining_days=remaining_days,
                is_eligible=True,
                is_at_completion_boundary=False,
                is_under_six_months=True,
                feeding_stage=stage_id,
                stage_name=rule.stage_name if rule else "Exclusive Breastfeeding (0–6 Months)",
                feeding_rule=rule,
                meal_frequency_guidance=rule.daily_meal_frequency if rule else "On demand, day and night",
                daily_snack_frequency_guidance=None,
                milk_feeding_guidance=infant_milk_guidance,
                planned_meals=[],
                planned_snacks=[],
                general_preparation_instructions=rule.preparation_instructions if rule else [],
                safety_and_hygiene_guidance=rule.safety_and_hygiene_guidance if rule else [],
                special_notice="Infant is under 6 completed calendar months. FHB guidelines mandate exclusive milk feeding on demand. Complementary food slots are omitted.",
                evidence_summary={"TIER_A": 1},
                source_citation=rule.source_citation if rule else None,
            )

        # 4. Milk feeding guidance formulation for complementary feeding children
        if completed_months < 12:
            milk_guidance = (
                "Continue breastfeeding on demand after or between meals. "
                "Breast milk remains the primary source of nutrients and protective antibodies in the first year."
            )
        else:
            if profile.milk_feeding_method in ("infant_formula_only", "cow_milk", "other"):
                milk_guidance = (
                    "Non-breastfed child (1–5 years): Provide 1 cup curd OR 1 cup plain yoghurt OR "
                    "1 matchbox-sized piece of cheese daily to provide adequate dietary calcium and protein [Booklet p. 16]."
                )
            elif profile.milk_feeding_method in ("exclusive_breastfeeding", "complementary_breastfeeding"):
                milk_guidance = (
                    "Continue breastfeeding 2 to 3 times a day after meals. "
                    "Breastfeeding provides valuable nutrition throughout the second year and beyond [Booklet p. 16]."
                )
            else:
                milk_guidance = (
                    "Breastfed children: Continue breastfeeding 2 to 3 times a day after meals [Booklet p. 16]. "
                    "Non-breastfed children: Offer 1 cup curd OR 1 cup yoghurt OR 1 matchbox-sized piece of cheese daily."
                )

        # 5. Hard Constraint Filtering
        is_late_starter = completed_months >= 7 and days_since_start is not None and 1 <= days_since_start <= 30
        eligible_dishes = self.recommendation_service.filter_eligible_dishes(
            all_dishes=catalog.dishes,
            profile=profile,
            stage_id=stage_id,
            completed_months=completed_months,
            is_late_starter=is_late_starter,
        )

        eligible_snacks = self.recommendation_service.filter_eligible_snacks(
            all_snacks=catalog.snacks,
            profile=profile,
            stage_id=stage_id,
            completed_months=completed_months,
        )

        # 6. Determine Required Number of Meal & Snack Slots based on Stage & Rule
        num_main_meals, num_snacks = self._determine_slot_counts(
            stage_id=stage_id,
            completed_months=completed_months,
            days_since_start=days_since_start,
        )

        # 7. Rotation-Aware Deterministic Selection of Daily Meals
        # Merge recent history from profile and weekly accumulation
        recent_ids: List[str] = list(recent_history_override or profile.recent_meal_history or [])
        if accumulated_week_dishes:
            for dish_id, dates_used in accumulated_week_dishes.items():
                if any(abs((today - d).days) <= 2 for d in dates_used):
                    recent_ids.append(dish_id)

        planned_meal_slots = self._allocate_meal_slots(
            eligible_dishes=eligible_dishes,
            num_slots=num_main_meals,
            profile=profile,
            today=today,
            recent_ids=recent_ids,
            accumulated_week_dishes=accumulated_week_dishes,
            stage_id=stage_id,
            rule=rule,
        )

        # 8. Allocate Snacks if applicable
        recent_snack_ids: List[str] = []
        if accumulated_week_snacks:
            for snack_id, dates_used in accumulated_week_snacks.items():
                if any(abs((today - d).days) <= 2 for d in dates_used):
                    recent_snack_ids.append(snack_id)

        planned_snack_slots = self._allocate_snack_slots(
            eligible_snacks=eligible_snacks,
            num_slots=num_snacks,
            profile=profile,
            today=today,
            recent_ids=recent_snack_ids,
            accumulated_week_snacks=accumulated_week_snacks,
            stage_id=stage_id,
            rule=rule,
        )

        # 9. Evidence counts summary
        evidence_counts: Dict[str, int] = {}
        for slot in planned_meal_slots + planned_snack_slots:
            if slot.meal_item:
                tier_str = slot.meal_item.evidence_tier.value
                evidence_counts[tier_str] = evidence_counts.get(tier_str, 0) + 1

        # 10. Special notice formulation
        special_notice: Optional[str] = None
        if stage_id == FeedingStageId.STAGE_6M_GENERAL and profile.complementary_feeding_start_date is None:
            special_notice = (
                "Complementary feeding start date is unrecorded. Providing normative introductory meals. "
                "Record the exact start date in preferences for personalized day-by-day progression."
            )
        elif is_late_starter:
            special_notice = (
                f"Child is {completed_months} completed months old and began complementary feeding recently "
                f"({days_since_start} days ago). Providing progressive tolerance transition meals."
            )
        elif any(s.is_unfilled for s in planned_meal_slots):
            special_notice = (
                "Some meal slots could not be filled because strict dietary restrictions or kitchen pantry "
                "availability eliminated all matching catalogue dishes for this stage."
            )

        return DailyMealPlanResponse(
            baby_id=baby_id,
            plan_date=today,
            day_of_week=day_name,
            child_age_completed_months=completed_months,
            child_age_remaining_days=remaining_days,
            is_eligible=True,
            is_at_completion_boundary=False,
            is_under_six_months=False,
            feeding_stage=stage_id,
            stage_name=rule.stage_name if rule else stage_id.value,
            feeding_rule=rule,
            meal_frequency_guidance=rule.daily_meal_frequency if rule else "Age-appropriate schedule",
            daily_snack_frequency_guidance=rule.daily_snack_frequency if rule else None,
            milk_feeding_guidance=milk_guidance,
            planned_meals=planned_meal_slots,
            planned_snacks=planned_snack_slots,
            general_preparation_instructions=rule.preparation_instructions if rule else [],
            safety_and_hygiene_guidance=rule.safety_and_hygiene_guidance if rule else [],
            special_notice=special_notice,
            evidence_summary=evidence_counts,
            source_citation=rule.source_citation if rule else None,
        )

    # ========================================================================
    # Seven-Day Weekly Meal Plan Generation
    # ========================================================================

    def generate_weekly_meal_plan(
        self,
        profile: ChildNutritionProfile,
        start_date: Optional[date] = None,
        baby_id: int = 0,
    ) -> WeeklyMealPlanResponse:
        """
        Generates a deterministic 7-day meal plan for seven consecutive dates.
        Resolves the child's age, stage, and feeding rules on EACH date independently.
        """
        today = get_colombo_today()
        base_date = start_date or today

        daily_plans: List[DailyMealPlanResponse] = []
        accumulated_dishes: Dict[str, List[date]] = {}
        accumulated_snacks: Dict[str, List[date]] = {}
        stage_transitions: List[str] = []
        special_notices: List[str] = []
        seen_stages: List[FeedingStageId] = []

        available_set = set(profile.available_ingredients or [])

        # Process each of the 7 consecutive calendar dates
        for day_offset in range(7):
            current_date = base_date + timedelta(days=day_offset)

            # Generate plan for this date with full rotation tracking
            day_plan = self.generate_daily_meal_plan(
                profile=profile,
                plan_date=current_date,
                accumulated_week_dishes=accumulated_dishes,
                accumulated_week_snacks=accumulated_snacks,
                baby_id=baby_id,
            )
            daily_plans.append(day_plan)

            # Track stage transitions across days
            if seen_stages and day_plan.feeding_stage != seen_stages[-1]:
                trans_msg = (
                    f"Day {day_offset + 1} ({current_date.strftime('%a, %d %b')}): "
                    f"Child transitions to '{day_plan.stage_name}' (Age: {day_plan.child_age_completed_months}m + {day_plan.child_age_remaining_days}d)."
                )
                stage_transitions.append(trans_msg)
            seen_stages.append(day_plan.feeding_stage)

            if day_plan.special_notice and day_plan.special_notice not in special_notices:
                special_notices.append(f"{current_date.strftime('%a')}: {day_plan.special_notice}")

            # Record used dishes and snacks for rotation awareness
            for slot in day_plan.planned_meals:
                if slot.meal_item:
                    dish_id = slot.meal_item.dish_or_food_id
                    accumulated_dishes.setdefault(dish_id, []).append(current_date)

            for slot in day_plan.planned_snacks:
                if slot.meal_item:
                    snack_id = slot.meal_item.dish_or_food_id
                    accumulated_snacks.setdefault(snack_id, []).append(current_date)

        # Build aggregated weekly grocery checklist
        grocery_checklist = self._build_weekly_grocery_checklist(
            daily_plans=daily_plans,
            available_set=available_set,
        )

        # Calculate rotation variety notes
        total_slots = sum(len(d.planned_meals) for d in daily_plans)
        unique_dishes = len(accumulated_dishes)
        variety_notes = [
            f"Planned {total_slots} main meal slots using {unique_dishes} unique dish recipes across 7 days.",
            "Rotation algorithm applies diversity penalties to prevent immediate consecutive meal repetition while ensuring eligible fallback when catalogue choices are constrained.",
        ]

        return WeeklyMealPlanResponse(
            baby_id=baby_id,
            start_date=base_date,
            end_date=base_date + timedelta(days=6),
            days=daily_plans,
            weekly_grocery_checklist=grocery_checklist,
            stage_transitions=stage_transitions,
            variety_notes=variety_notes,
            special_notices=special_notices,
            source_attribution=(
                "Family Health Bureau, Ministry of Health, Sri Lanka (2025). "
                "'Right Food at the Right Time, To Make My Baby Healthy and Bright'"
            ),
        )

    # ========================================================================
    # Substitution Revalidation
    # ========================================================================

    def validate_substitution(
        self,
        profile: ChildNutritionProfile,
        plan_date: date,
        original_food_id: str,
        replacement_food_id: str,
    ) -> SubstituteValidationResponse:
        """
        Revalidates on the backend that a proposed replacement dish or snack satisfies
        all hard clinical and developmental constraints for the child on plan_date.
        """
        catalog = self.catalog_service.load_catalog()
        completed_months, remaining_days = calculate_calendar_age(dob=profile.date_of_birth, today=plan_date)

        if completed_months < 6:
            return SubstituteValidationResponse(
                is_valid=False,
                validation_message="Cannot substitute complementary foods for an infant under 6 completed months (exclusive milk stage).",
            )
        if completed_months >= COMPLETION_BOUNDARY_MONTHS:
            return SubstituteValidationResponse(
                is_valid=False,
                validation_message="Child has completed the 0–59 months monitoring boundary.",
            )

        days_since_start: Optional[int] = None
        if profile.complementary_feeding_start_date is not None and plan_date >= profile.complementary_feeding_start_date:
            days_since_start = (plan_date - profile.complementary_feeding_start_date).days + 1

        stage_id, rule = self.recommendation_service.resolve_feeding_stage(
            completed_months=completed_months,
            days_into_month=remaining_days,
            days_since_start=days_since_start,
        )

        # Check if replacement is a Dish
        dish = self.catalog_service.get_dish(replacement_food_id)
        if dish:
            is_late_starter = completed_months >= 7 and days_since_start is not None and 1 <= days_since_start <= 30
            eligible_dishes = self.recommendation_service.filter_eligible_dishes(
                all_dishes=[dish],
                profile=profile,
                stage_id=stage_id,
                completed_months=completed_months,
                is_late_starter=is_late_starter,
            )
            if not eligible_dishes:
                return SubstituteValidationResponse(
                    is_valid=False,
                    validation_message=f"Dish '{dish.name}' does not meet safety, texture ({dish.texture.value}), or dietary restriction constraints for this stage.",
                )

            available_set = set(profile.available_ingredients or [])
            item = self.recommendation_service._dish_to_recommendation(
                rec_id=f"SUB_{dish.dish_id}",
                dish=dish,
                meal_slot=MealType.MAIN_MEAL,
                rule=rule,
                score=100.0,
                factors=["Caregiver-selected substitution validated by FHB knowledge base"],
                available_set=available_set,
            )
            return SubstituteValidationResponse(
                is_valid=True,
                validation_message=f"Substitution verified: '{dish.name}' is developmentally appropriate for stage '{stage_id.value}'.",
                replacement_item=item,
            )

        # Check if replacement is a Snack
        snack = self.catalog_service.get_snack(replacement_food_id)
        if snack:
            eligible_snacks = self.recommendation_service.filter_eligible_snacks(
                all_snacks=[snack],
                profile=profile,
                stage_id=stage_id,
                completed_months=completed_months,
            )
            if not eligible_snacks:
                return SubstituteValidationResponse(
                    is_valid=False,
                    validation_message=f"Snack '{snack.name}' does not meet age minimum ({snack.min_calendar_months}m) or dietary restriction constraints for this stage.",
                )

            available_set = set(profile.available_ingredients or [])
            item = self.recommendation_service._snack_to_recommendation(
                rec_id=f"SUB_{snack.snack_id}",
                snack=snack,
                rule=rule,
                score=100.0,
                factors=["Caregiver-selected substitution validated by FHB knowledge base"],
                available_set=available_set,
            )
            return SubstituteValidationResponse(
                is_valid=True,
                validation_message=f"Substitution verified: '{snack.name}' is developmentally appropriate for stage '{stage_id.value}'.",
                replacement_item=item,
            )

        return SubstituteValidationResponse(
            is_valid=False,
            validation_message=f"Unknown replacement food ID '{replacement_food_id}' in nutrition catalogue.",
        )

    # ========================================================================
    # Internal Allocation & Rotation Helpers
    # ========================================================================

    def _determine_slot_counts(
        self,
        stage_id: FeedingStageId,
        completed_months: int,
        days_since_start: Optional[int],
    ) -> Tuple[int, int]:
        """
        Determines the recommended number of main meal and snack slots according to FHB guidance.
        """
        if completed_months < 6:
            return 0, 0

        # Introductory 6-month milestones
        if completed_months == 6:
            if days_since_start is not None and days_since_start <= 9:
                # Days 1 to 9: exactly 1 introductory feeding session
                return 1, 0
            elif days_since_start is not None and days_since_start <= 30:
                # Days 10 to 30: 2 main meal sessions
                return 2, 0
            else:
                # General 6 months: 2 main meals
                return 2, 0

        # 7 to 8 completed months: 2 to 3 main meals + 1 to 2 snacks
        if completed_months in (7, 8):
            return 3, 1

        # 9 to 11 completed months: 3 to 4 main meals + 1 to 2 snacks
        if 9 <= completed_months <= 11:
            return 3, 1

        # 12 to 23 completed months: 3 main meals + 1 snack
        if 12 <= completed_months <= 23:
            return 3, 1

        # 24 to 59 completed months: 3 main meals + 2 snacks
        if 24 <= completed_months <= 59:
            return 3, 2

        return 0, 0

    def _get_slot_label(self, stage_id: FeedingStageId, slot_num: int, total_slots: int, slot_type: MealType) -> str:
        """Assigns caregiver-friendly labels without inappropriate adult meal terms for early infants."""
        if slot_type == MealType.SNACK:
            return f"Nutritious Snack {slot_num}" if total_slots > 1 else "Nutritious Snack"

        # Early 6 months (single session)
        if total_slots == 1:
            return "Introductory Feeding Session"

        # 2 sessions (e.g. 6m Days 10-30)
        if total_slots == 2:
            return "Feeding Session 1 (Morning)" if slot_num == 1 else "Feeding Session 2 (Midday)"

        # 3 or more sessions
        labels = ["Main Meal 1 (Morning)", "Main Meal 2 (Midday)", "Main Meal 3 (Evening)", "Main Meal 4 (Night)"]
        if slot_num <= len(labels):
            return labels[slot_num - 1]
        return f"Main Meal {slot_num}"

    def _allocate_meal_slots(
        self,
        eligible_dishes: List[DishRecord],
        num_slots: int,
        profile: ChildNutritionProfile,
        today: date,
        recent_ids: List[str],
        accumulated_week_dishes: Optional[Dict[str, List[date]]],
        stage_id: FeedingStageId,
        rule: FeedingRuleRecord,
    ) -> List[PlannedMealSlot]:
        """
        Deterministically allocates eligible dishes to meal slots applying rotation penalties.
        """
        slots: List[PlannedMealSlot] = []
        if num_slots == 0:
            return slots

        available_set = set(profile.available_ingredients or [])
        used_today: List[str] = []

        # Get base ranked dishes
        base_ranked = self.recommendation_service.rank_dishes(eligible_dishes=eligible_dishes, profile=profile)

        for slot_idx in range(1, num_slots + 1):
            slot_label = self._get_slot_label(stage_id, slot_idx, num_slots, MealType.MAIN_MEAL)

            if not eligible_dishes:
                slots.append(
                    PlannedMealSlot(
                        slot_number=slot_idx,
                        slot_label=slot_label,
                        slot_type=MealType.MAIN_MEAL,
                        meal_item=None,
                        is_unfilled=True,
                        unfilled_reason="No eligible dishes satisfy the hard nutritional constraints, allergies, or kitchen pantry availability.",
                        eligible_substitutes=[],
                    )
                )
                continue

            # Calculate rotation-adjusted scores for this slot
            scored_candidates: List[Tuple[float, DishRecord, List[str]]] = []
            for dish, base_score, factors in base_ranked:
                adjusted_score = base_score
                rot_factors = list(factors)

                # Penalty 1: Used earlier today (strongest penalty)
                if dish.dish_id in used_today:
                    adjusted_score -= 50.0
                    rot_factors.append("Penalty: Already served earlier today")

                # Penalty 2: Used in recent history (yesterday or 2 days ago)
                if dish.dish_id in recent_ids:
                    count_recent = recent_ids.count(dish.dish_id)
                    adjusted_score -= (25.0 * count_recent)
                    rot_factors.append("Rotation penalty: Served recently")

                # Penalty 3: Overall weekly frequency
                if accumulated_week_dishes and dish.dish_id in accumulated_week_dishes:
                    freq = len(accumulated_week_dishes[dish.dish_id])
                    adjusted_score -= (10.0 * freq)
                    rot_factors.append(f"Frequency penalty: Used {freq} time(s) this week")

                scored_candidates.append((adjusted_score, dish, rot_factors))

            # Deterministic sorting: highest adjusted score, tie-break by dish_id (lexicographical ASC)
            scored_candidates.sort(key=lambda x: (-x[0], x[1].dish_id))

            # Select top candidate
            chosen_score, chosen_dish, chosen_factors = scored_candidates[0]
            used_today.append(chosen_dish.dish_id)

            # Record eligible alternatives for substitution
            substitutes = [c[1].dish_id for c in scored_candidates if c[1].dish_id != chosen_dish.dish_id][:5]

            rec_item = self.recommendation_service._dish_to_recommendation(
                rec_id=f"PLAN_D_{today.strftime('%Y%m%d')}_S{slot_idx}",
                dish=chosen_dish,
                meal_slot=MealType.MAIN_MEAL,
                rule=rule,
                score=chosen_score,
                factors=chosen_factors,
                available_set=available_set,
            )

            slots.append(
                PlannedMealSlot(
                    slot_number=slot_idx,
                    slot_label=slot_label,
                    slot_type=MealType.MAIN_MEAL,
                    meal_item=rec_item,
                    is_unfilled=False,
                    unfilled_reason=None,
                    eligible_substitutes=substitutes,
                )
            )

        return slots

    def _allocate_snack_slots(
        self,
        eligible_snacks: List[SnackRecord],
        num_slots: int,
        profile: ChildNutritionProfile,
        today: date,
        recent_ids: List[str],
        accumulated_week_snacks: Optional[Dict[str, List[date]]],
        stage_id: FeedingStageId,
        rule: FeedingRuleRecord,
    ) -> List[PlannedMealSlot]:
        """
        Deterministically allocates eligible snacks to snack slots.
        """
        slots: List[PlannedMealSlot] = []
        if num_slots == 0:
            return slots

        available_set = set(profile.available_ingredients or [])
        used_today: List[str] = []

        base_ranked = self.recommendation_service.rank_snacks(eligible_snacks=eligible_snacks, profile=profile)

        for slot_idx in range(1, num_slots + 1):
            slot_label = self._get_slot_label(stage_id, slot_idx, num_slots, MealType.SNACK)

            if not eligible_snacks:
                slots.append(
                    PlannedMealSlot(
                        slot_number=slot_idx,
                        slot_label=slot_label,
                        slot_type=MealType.SNACK,
                        meal_item=None,
                        is_unfilled=True,
                        unfilled_reason="No structured snacks in catalogue match age or dietary constraints.",
                        eligible_substitutes=[],
                    )
                )
                continue

            scored_candidates: List[Tuple[float, SnackRecord, List[str]]] = []
            for snack, base_score, factors in base_ranked:
                adjusted_score = base_score
                rot_factors = list(factors)

                if snack.snack_id in used_today:
                    adjusted_score -= 40.0
                    rot_factors.append("Penalty: Already served earlier today")

                if snack.snack_id in recent_ids:
                    count_recent = recent_ids.count(snack.snack_id)
                    adjusted_score -= (20.0 * count_recent)
                    rot_factors.append("Rotation penalty: Served recently")

                if accumulated_week_snacks and snack.snack_id in accumulated_week_snacks:
                    freq = len(accumulated_week_snacks[snack.snack_id])
                    adjusted_score -= (8.0 * freq)

                scored_candidates.append((adjusted_score, snack, rot_factors))

            # Deterministic sorting: highest adjusted score, tie-break by snack_id (lexicographical ASC)
            scored_candidates.sort(key=lambda x: (-x[0], x[1].snack_id))
            chosen_score, chosen_snack, chosen_factors = scored_candidates[0]
            used_today.append(chosen_snack.snack_id)

            substitutes = [c[1].snack_id for c in scored_candidates if c[1].snack_id != chosen_snack.snack_id][:5]

            rec_item = self.recommendation_service._snack_to_recommendation(
                rec_id=f"PLAN_S_{today.strftime('%Y%m%d')}_S{slot_idx}",
                snack=chosen_snack,
                rule=rule,
                score=chosen_score,
                factors=chosen_factors,
                available_set=available_set,
            )

            slots.append(
                PlannedMealSlot(
                    slot_number=slot_idx,
                    slot_label=slot_label,
                    slot_type=MealType.SNACK,
                    meal_item=rec_item,
                    is_unfilled=False,
                    unfilled_reason=None,
                    eligible_substitutes=substitutes,
                )
            )

        return slots

    def _build_weekly_grocery_checklist(
        self,
        daily_plans: List[DailyMealPlanResponse],
        available_set: Set[str],
    ) -> List[WeeklyGroceryItem]:
        """
        Consolidates all ingredients across 7 days into a structured pantry checklist.
        """
        ingredients_map: Dict[str, Dict] = {}

        for day in daily_plans:
            for slot in day.planned_meals + day.planned_snacks:
                if slot.meal_item:
                    dish_name = slot.meal_item.name
                    for ing_id in slot.meal_item.ingredients:
                        ing_record = self.catalog_service.get_ingredient(ing_id)
                        if not ing_record:
                            continue

                        if ing_id not in ingredients_map:
                            ingredients_map[ing_id] = {
                                "ingredient_id": ing_id,
                                "name": ing_record.name,
                                "sinhala_name": ing_record.sinhala_name,
                                "food_group": ing_record.food_group,
                                "is_available_in_household": ing_id in available_set,
                                "days_used": set(),
                                "meal_names": set(),
                                "total_meal_appearances": 0,
                            }

                        ingredients_map[ing_id]["days_used"].add(day.plan_date)
                        ingredients_map[ing_id]["meal_names"].add(dish_name)
                        ingredients_map[ing_id]["total_meal_appearances"] += 1

        checklist: List[WeeklyGroceryItem] = []
        for ing_id, data in ingredients_map.items():
            checklist.append(
                WeeklyGroceryItem(
                    ingredient_id=data["ingredient_id"],
                    name=data["name"],
                    sinhala_name=data["sinhala_name"],
                    food_group=data["food_group"],
                    is_available_in_household=data["is_available_in_household"],
                    days_used=sorted(list(data["days_used"])),
                    meal_names=sorted(list(data["meal_names"])),
                    total_meal_appearances=data["total_meal_appearances"],
                )
            )

        # Sort deterministically by food group, availability (on-hand first), then ingredient name and ID
        checklist.sort(key=lambda x: (x.food_group.value, 0 if x.is_available_in_household else 1, x.name, x.ingredient_id))
        return checklist


# ============================================================================
# Singleton Accessor
# ============================================================================

_planner_service_instance: Optional[NutritionPlannerService] = None

def get_nutrition_planner_service() -> NutritionPlannerService:
    """Returns singleton instance of NutritionPlannerService."""
    global _planner_service_instance
    if _planner_service_instance is None:
        _planner_service_instance = NutritionPlannerService()
    return _planner_service_instance

def reset_nutrition_planner_service() -> None:
    """Resets singleton instance for testing."""
    global _planner_service_instance
    _planner_service_instance = None
