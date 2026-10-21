"""Pydantic schemas and domain models for the Sri Lankan Nutrition Knowledge Base.

Primary Reference:
'Right Food at the Right Time, To Make My Baby Healthy and Bright',
Family Health Bureau (FHB), Ministry of Health, Sri Lanka (2025).
"""

from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

# ============================================================================
# Core Project Age-Scope Constants
# ============================================================================

MIN_ELIGIBLE_COMPLETED_MONTHS: int = 0
MAX_ELIGIBLE_COMPLETED_MONTHS: int = 59
COMPLETION_BOUNDARY_MONTHS: int = 60

# ============================================================================
# Enums
# ============================================================================

class EvidenceTier(str, Enum):
    """Evidence tier classification for scientific traceability."""
    TIER_A = "TIER_A"  # Explicit FHB 2025 booklet text, tables, recipes, protocols
    TIER_B = "TIER_B"  # Derived application logic, composite scheduling, rotations
    TIER_C = "TIER_C"  # Project requirements and recognized standards (e.g. 0–59m scope)


class FoodGroup(str, Enum):
    """The 7 canonical Sri Lankan childhood food groups + Human Milk."""
    GRAINS_AND_STAPLES = "GRAINS_AND_STAPLES"
    PULSES_AND_LEGUMES = "PULSES_AND_LEGUMES"
    ANIMAL_SOURCE_FOODS = "ANIMAL_SOURCE_FOODS"
    VEGETABLES = "VEGETABLES"
    GREEN_LEAVES = "GREEN_LEAVES"
    FRUITS = "FRUITS"
    FATS_AND_DAIRY = "FATS_AND_DAIRY"
    HUMAN_MILK = "HUMAN_MILK"


class FeedingStageId(str, Enum):
    """Developmental feeding stage identifiers."""
    STAGE_0_TO_6M = "STAGE_0_TO_6M"
    STAGE_6M_DAY_1 = "STAGE_6M_DAY_1"
    STAGE_6M_DAYS_2_3 = "STAGE_6M_DAYS_2_3"
    STAGE_6M_DAYS_4_6 = "STAGE_6M_DAYS_4_6"
    STAGE_6M_DAYS_7_9 = "STAGE_6M_DAYS_7_9"
    STAGE_6M_DAYS_10_15 = "STAGE_6M_DAYS_10_15"
    STAGE_6M_DAYS_16_30 = "STAGE_6M_DAYS_16_30"
    STAGE_6M_GENERAL = "STAGE_6M_GENERAL"
    STAGE_7_TO_8M = "STAGE_7_TO_8M"
    STAGE_7M = "STAGE_7M"
    STAGE_8M = "STAGE_8M"
    STAGE_9_TO_11M = "STAGE_9_TO_11M"
    STAGE_12_TO_23M = "STAGE_12_TO_23M"
    STAGE_24_TO_59M = "STAGE_24_TO_59M"
    STAGE_60M_PLUS = "STAGE_60M_PLUS"


class FoodTexture(str, Enum):
    """Progressive food texture classifications from FHB guidelines."""
    LIQUID = "LIQUID"
    SMOOTH_PUREE = "SMOOTH_PUREE"
    SEMI_SOLID_MASH = "SEMI_SOLID_MASH"
    HALF_MASHED = "HALF_MASHED"
    COARSELY_MASHED = "COARSELY_MASHED"
    COARSELY_CHOPPED = "COARSELY_CHOPPED"
    FINGER_FOOD = "FINGER_FOOD"
    FAMILY_FOOD = "FAMILY_FOOD"


class MealType(str, Enum):
    """Meal slot category."""
    MAIN_MEAL = "MAIN_MEAL"
    SNACK = "SNACK"
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    DINNER = "DINNER"
    TASTE_SESSION = "TASTE_SESSION"


class RestrictionGroupCode(str, Enum):
    """Normalized restriction group codes for allergy and cultural exclusions."""
    RESTRICT_FISH = "RESTRICT_FISH"
    RESTRICT_SHELLFISH = "RESTRICT_SHELLFISH"
    RESTRICT_DAIRY = "RESTRICT_DAIRY"
    RESTRICT_EGG = "RESTRICT_EGG"
    RESTRICT_SOYA = "RESTRICT_SOYA"
    RESTRICT_LEGUMES = "RESTRICT_LEGUMES"
    RESTRICT_PEANUT = "RESTRICT_PEANUT"
    RESTRICT_TREE_NUT = "RESTRICT_TREE_NUT"
    RESTRICT_COCONUT = "RESTRICT_COCONUT"


# ============================================================================
# Models
# ============================================================================

class SourceCitation(BaseModel):
    """Documentary evidence citation metadata."""
    model_config = ConfigDict(extra="forbid")

    publication: str = Field(
        default="Right Food at the Right Time, To Make My Baby Healthy and Bright",
        description="Name of publication"
    )
    organization: str = Field(
        default="Family Health Bureau, Ministry of Health, Sri Lanka",
        description="Issuing public health authority"
    )
    year: int = Field(default=2025, description="Publication year")
    booklet_page: Optional[int] = Field(default=None, description="Printed booklet page number (0-24)")
    pdf_page: Optional[int] = Field(default=None, description="Absolute PDF page index (1-28)")
    evidence_tier: EvidenceTier = Field(..., description="Evidence tier classification")
    evidence_description: str = Field(..., description="Summary of extracted guidance or justification")

    @model_validator(mode="after")
    def validate_citation_rules(self) -> "SourceCitation":
        # Tier A requires explicit booklet and PDF page numbers
        if self.evidence_tier == EvidenceTier.TIER_A:
            if self.pdf_page is None:
                raise ValueError("Tier A evidence requires an explicit pdf_page reference.")
            if self.booklet_page is None:
                raise ValueError("Tier A evidence requires an explicit booklet_page reference.")

        # If PDF page is provided, validate within actual 28-page FHB document range
        if self.pdf_page is not None:
            if not (1 <= self.pdf_page <= 28):
                raise ValueError(f"pdf_page must be between 1 and 28 (got {self.pdf_page}).")

        # Booklet page range (0 = cover/inside cover, 1-24 = numbered pages)
        if self.booklet_page is not None:
            if not (0 <= self.booklet_page <= 24):
                raise ValueError(f"booklet_page must be between 0 and 24 (got {self.booklet_page}).")

        return self


class IngredientRecord(BaseModel):
    """Sri Lankan raw/primary food ingredient entity."""
    model_config = ConfigDict(extra="forbid")

    food_id: str = Field(..., description="Stable unique identifier, e.g. ING_SPRATS")
    name: str = Field(..., description="English common name")
    sinhala_name: Optional[str] = Field(default=None, description="Sinhala cultural name")
    food_group: FoodGroup = Field(..., description="Canonical FHB food group")
    min_calendar_months: int = Field(..., ge=0, le=60, description="Minimum completed calendar months")
    introductory_stage: Optional[FeedingStageId] = Field(
        default=None,
        description="Introductory feeding stage for initial exposure"
    )
    texture: FoodTexture = Field(..., description="Texture form at earliest introduction")
    preparation_notes: str = Field(..., description="Preparation instructions and food safety notes")
    restriction_groups: List[RestrictionGroupCode] = Field(
        default_factory=list,
        description="Restriction groups this ingredient belongs to"
    )
    evidence_tier: EvidenceTier = Field(..., description="Evidence tier")
    source_citation: SourceCitation = Field(..., description="Primary documentary citation")

    @model_validator(mode="after")
    def validate_tier_consistency(self) -> "IngredientRecord":
        if self.evidence_tier != self.source_citation.evidence_tier:
            raise ValueError(
                f"Ingredient '{self.food_id}' evidence_tier ({self.evidence_tier}) "
                f"does not match citation tier ({self.source_citation.evidence_tier})."
            )
        return self


class DishRecord(BaseModel):
    """Composite dish / meal combination entity."""
    model_config = ConfigDict(extra="forbid")

    dish_id: str = Field(..., description="Stable unique identifier, e.g. DISH_FHB_SPRAT_RICE")
    name: str = Field(..., description="English dish name")
    sinhala_name: Optional[str] = Field(default=None, description="Sinhala dish name")
    meal_category: MealType = Field(..., description="Meal category")
    ingredients: List[str] = Field(..., min_length=1, description="List of constituent food_ids")
    min_calendar_months: int = Field(..., ge=0, le=60, description="Minimum completed calendar months")
    eligible_stages: List[FeedingStageId] = Field(..., min_length=1, description="Eligible developmental stages")
    texture: FoodTexture = Field(..., description="Texture form")
    household_portion: str = Field(..., description="FHB household portion measure")
    energy_enrichment: Optional[str] = Field(default=None, description="Energy enrichment instruction")
    preparation_steps: List[str] = Field(..., min_length=1, description="Step-by-step preparation instructions")
    safety_precautions: List[str] = Field(default_factory=list, description="Safety precautions (salt, choking, etc.)")
    restriction_groups_contained: List[RestrictionGroupCode] = Field(
        default_factory=list,
        description="Union of restriction groups from constituent ingredients"
    )
    developmental_rationale: str = Field(..., description="Parent-friendly explanation from booklet")
    evidence_tier: EvidenceTier = Field(..., description="Evidence tier")
    source_citation: SourceCitation = Field(..., description="Primary documentary citation")

    @model_validator(mode="after")
    def validate_tier_consistency(self) -> "DishRecord":
        if self.evidence_tier != self.source_citation.evidence_tier:
            raise ValueError(
                f"Dish '{self.dish_id}' evidence_tier ({self.evidence_tier}) "
                f"does not match citation tier ({self.source_citation.evidence_tier})."
            )
        return self


class SnackRecord(BaseModel):
    """Nutritious Sri Lankan snack entity (e.g. 16 visual snacks and finger foods)."""
    model_config = ConfigDict(extra="forbid")

    snack_id: str = Field(..., description="Stable unique identifier, e.g. SNACK_EGG_HOPPER")
    name: str = Field(..., description="English snack name")
    sinhala_name: Optional[str] = Field(default=None, description="Sinhala snack name")
    ingredients: List[str] = Field(..., min_length=1, description="List of constituent food_ids")
    min_calendar_months: int = Field(..., ge=6, le=60, description="Minimum completed calendar months")
    eligible_stages: List[FeedingStageId] = Field(..., min_length=1, description="Eligible developmental stages")
    texture: FoodTexture = Field(..., description="Texture form")
    household_portion: str = Field(..., description="FHB household portion measure")
    preparation_instructions: List[str] = Field(..., min_length=1, description="Preparation steps")
    safety_precautions: List[str] = Field(default_factory=list, description="Choking hazard / supervision notes")
    restriction_groups: List[RestrictionGroupCode] = Field(
        default_factory=list,
        description="Restriction groups this snack belongs to"
    )
    is_finger_food: bool = Field(default=False, description="Whether suitable as supervised finger food")
    evidence_tier: EvidenceTier = Field(..., description="Evidence tier")
    source_citation: SourceCitation = Field(..., description="Primary documentary citation")

    @model_validator(mode="after")
    def validate_tier_consistency(self) -> "SnackRecord":
        if self.evidence_tier != self.source_citation.evidence_tier:
            raise ValueError(
                f"Snack '{self.snack_id}' evidence_tier ({self.evidence_tier}) "
                f"does not match citation tier ({self.source_citation.evidence_tier})."
            )
        return self


class FeedingRuleRecord(BaseModel):
    """Structured feeding rule entity for a specific stage or inception condition."""
    model_config = ConfigDict(extra="forbid")

    rule_id: str = Field(..., description="Stable unique identifier, e.g. RULE_01_BEFORE_6M")
    stage_id: FeedingStageId = Field(..., description="Target feeding stage")
    stage_name: str = Field(..., description="Human-readable stage title")
    min_calendar_months: int = Field(..., ge=0, le=60, description="Minimum completed calendar months")
    max_calendar_months: int = Field(..., ge=0, le=60, description="Maximum completed calendar months")
    days_since_start_min: Optional[int] = Field(default=None, description="Minimum days since solids started")
    days_since_start_max: Optional[int] = Field(default=None, description="Maximum days since solids started")
    min_days_into_month: Optional[int] = Field(default=None, ge=0, le=31, description="Minimum days elapsed in completed month")
    max_days_into_month: Optional[int] = Field(default=None, ge=0, le=31, description="Maximum days elapsed in completed month")
    precedence: int = Field(default=10, description="Rule resolution precedence (lower number = higher priority)")
    requires_known_start_date: bool = Field(
        default=False,
        description="Whether this rule requires a recorded complementary feeding start date"
    )
    is_late_starter_rule: bool = Field(
        default=False,
        description="Whether this rule applies to late starters (age >= 7m with start_date <= 30d)"
    )
    daily_meal_frequency: str = Field(..., description="Recommended daily meal frequency")
    daily_snack_frequency: Optional[str] = Field(default=None, description="Recommended daily snack frequency")
    household_portion: str = Field(..., description="FHB household portion specification")
    texture: FoodTexture = Field(..., description="Target developmental texture")
    recommended_food_groups: List[FoodGroup] = Field(..., min_length=1, description="Food groups emphasized")
    preparation_instructions: List[str] = Field(..., min_length=1, description="Stage preparation guidance")
    safety_and_hygiene_guidance: List[str] = Field(..., min_length=1, description="Safety, salt/sugar, screens, hygiene")
    evidence_tier: EvidenceTier = Field(..., description="Evidence tier")
    source_citation: SourceCitation = Field(..., description="Primary documentary citation")

    @model_validator(mode="after")
    def validate_tier_consistency(self) -> "FeedingRuleRecord":
        if self.evidence_tier != self.source_citation.evidence_tier:
            raise ValueError(
                f"FeedingRule '{self.rule_id}' evidence_tier ({self.evidence_tier}) "
                f"does not match citation tier ({self.source_citation.evidence_tier})."
            )
        return self


class RestrictionGroupRecord(BaseModel):
    """Normalized restriction group definition."""
    model_config = ConfigDict(extra="forbid")

    group_code: RestrictionGroupCode = Field(..., description="Unique restriction code")
    name: str = Field(..., description="English group name")
    description: str = Field(..., description="Clinical / dietary description of restriction")
    matching_ingredients: List[str] = Field(..., min_length=1, description="List of food_ids mapped to this group")
    rules: List[str] = Field(..., min_length=1, description="Exclusion enforcement rules")


class FoodSubstitutionRecord(BaseModel):
    """Practical category rotation sharing dietary roles (not biochemical equivalence)."""
    model_config = ConfigDict(extra="forbid")

    category: str = Field(..., description="Food category, e.g. Grains & Staples, Pulses, Animal Source")
    primary_food_id: str = Field(..., description="Primary food ID from FHB meal patterns")
    alternative_food_ids: List[str] = Field(..., min_length=1, description="List of alternative food IDs")
    shared_dietary_role: str = Field(..., description="Shared dietary / culinary role in meal pattern")
    evidence_tier: EvidenceTier = Field(..., description="Evidence tier")
    source_citation: SourceCitation = Field(..., description="Primary documentary citation")

    @model_validator(mode="after")
    def validate_tier_consistency(self) -> "FoodSubstitutionRecord":
        if self.evidence_tier != self.source_citation.evidence_tier:
            raise ValueError(
                f"Substitution '{self.category}' evidence_tier ({self.evidence_tier}) "
                f"does not match citation tier ({self.source_citation.evidence_tier})."
            )
        return self


class NutritionCatalog(BaseModel):
    """Complete Sri Lankan Nutrition Knowledge Base container."""
    model_config = ConfigDict(extra="forbid")

    version: str = Field(default="2.1.0", description="Catalogue version")
    title: str = Field(
        default="Sri Lankan Infant and Young Child Nutrition Knowledge Base",
        description="Catalogue title"
    )
    authority: str = Field(
        default="Family Health Bureau, Ministry of Health, Sri Lanka",
        description="Public health authority"
    )
    reference_publication: str = Field(
        default="Right Food at the Right Time, To Make My Baby Healthy and Bright (2025)",
        description="Primary reference publication"
    )
    min_age_months: int = Field(default=MIN_ELIGIBLE_COMPLETED_MONTHS, description="Minimum eligible age (months)")
    max_age_months: int = Field(default=MAX_ELIGIBLE_COMPLETED_MONTHS, description="Maximum eligible age (months)")
    completion_boundary_months: int = Field(
        default=COMPLETION_BOUNDARY_MONTHS,
        description="Age at which child reaches completion boundary"
    )
    ingredients: List[IngredientRecord] = Field(..., min_length=1, description="Verified ingredient catalogue")
    dishes: List[DishRecord] = Field(..., min_length=1, description="Verified dishes catalogue")
    snacks: List[SnackRecord] = Field(..., min_length=1, description="Verified snacks catalogue")
    feeding_rules: List[FeedingRuleRecord] = Field(..., min_length=14, description="Stage feeding rules (1-14)")
    restrictions: List[RestrictionGroupRecord] = Field(..., min_length=9, description="Normalized restriction groups")
    substitutions: List[FoodSubstitutionRecord] = Field(..., min_length=1, description="Food-group substitutions")


# ============================================================================
# Recommendation Engine Domain Models (Phase 4)
# ============================================================================

class ChildNutritionProfile(BaseModel):
    """
    Validated child profile data passed into the nutrition recommendation engine.
    Core engine functions without direct dependency on database sessions or auth.
    """
    model_config = ConfigDict(extra="forbid")

    date_of_birth: date = Field(..., description="Child date of birth (mandatory)")
    biological_sex: Optional[str] = Field(default=None, description="Biological sex ('male', 'female')")
    complementary_feeding_start_date: Optional[date] = Field(
        default=None,
        description="Recorded complementary feeding start date (optional)"
    )
    milk_feeding_method: Optional[str] = Field(
        default=None,
        description="Feeding method: 'exclusive_breastfeeding', 'infant_formula_only', 'cow_milk', etc."
    )
    foods_introduced: List[str] = Field(
        default_factory=list,
        description="List of food_ids previously introduced and tolerated (e.g. ['ING_RICE_WHITE', 'ING_EGG_YOLK'])"
    )
    restricted_foods: List[str] = Field(
        default_factory=list,
        description="Individual food IDs or normalized restriction groups ('RESTRICT_FISH', 'RESTRICT_COCONUT', etc.)"
    )
    available_ingredients: List[str] = Field(
        default_factory=list,
        description="Food IDs currently available in the household kitchen"
    )
    only_available_ingredients: bool = Field(
        default=False,
        description="When True, strictly filter recommendations to dishes where all ingredients are on-hand"
    )
    dietary_preferences: List[str] = Field(
        default_factory=list,
        description="Dietary preferences (e.g. ['VEGETARIAN'])"
    )
    recent_meal_history: List[str] = Field(
        default_factory=list,
        description="Dish IDs consumed recently (e.g. in the past 1-2 days) to avoid immediate repetition"
    )


class MealRecommendationItem(BaseModel):
    """Structured recommendation for a single meal or snack slot."""
    model_config = ConfigDict(extra="forbid")

    recommendation_id: str = Field(..., description="Unique recommendation item ID")
    meal_slot: MealType = Field(..., description="Assigned meal slot category")
    dish_or_food_id: str = Field(..., description="ID of recommended dish or snack")
    name: str = Field(..., description="English common name")
    sinhala_name: Optional[str] = Field(default=None, description="Sinhala cultural name")
    item_type: str = Field(default="DISH", description="'DISH', 'SNACK', 'SINGLE_INGREDIENT', or 'MILK_ONLY'")
    ingredients: List[str] = Field(default_factory=list, description="Constituent food IDs")
    food_groups: List[FoodGroup] = Field(default_factory=list, description="Canonical FHB food groups represented")
    texture: FoodTexture = Field(..., description="Developmentally appropriate food texture")
    household_portion: str = Field(..., description="Verified household portion measure")
    preparation_instructions: List[str] = Field(default_factory=list, description="Preparation steps")
    safety_precautions: List[str] = Field(default_factory=list, description="Safety, salt/sugar, or choking hazard notes")
    recommendation_reason: str = Field(..., description="Parent-friendly explanation of developmental value")
    evidence_tier: EvidenceTier = Field(..., description="Documentary evidence tier")
    source_citation: SourceCitation = Field(..., description="Documentary source citation")
    is_available_in_household: bool = Field(default=False, description="Whether all ingredients are in household")
    ranking_score: float = Field(default=0.0, description="Deterministic priority score")
    ranking_factors: List[str] = Field(default_factory=list, description="Explanatory list of scoring factors")


class NutritionRecommendationResponse(BaseModel):
    """Composite response produced by the Personalized Nutrition Recommendation Engine."""
    model_config = ConfigDict(extra="forbid")

    child_age_completed_months: int = Field(..., description="Exact completed calendar months")
    child_age_remaining_days: int = Field(..., description="Days elapsed since last completed month milestone")
    is_eligible: bool = Field(..., description="Whether child is within the 0-59 completed months scope")
    is_at_completion_boundary: bool = Field(..., description="Whether child has reached 60 completed months")
    feeding_stage: FeedingStageId = Field(..., description="Resolved developmental feeding stage")
    stage_name: str = Field(..., description="Human-readable stage title")
    feeding_rule: Optional[FeedingRuleRecord] = Field(default=None, description="Applicable feeding rule record")
    meal_frequency_guidance: str = Field(..., description="Recommended daily meal frequency")
    daily_snack_frequency_guidance: Optional[str] = Field(default=None, description="Snack frequency guidance")
    milk_feeding_guidance: str = Field(..., description="Breastfeeding and dairy guidance")
    general_preparation_instructions: List[str] = Field(default_factory=list, description="Stage preparation guidance")
    safety_and_hygiene_guidance: List[str] = Field(default_factory=list, description="Stage safety guidance")
    special_notice: Optional[str] = Field(default=None, description="Notice for completion boundary, young infant, etc.")
    generated_main_meals_count: int = Field(default=0, description="Count of generated main meal recommendations")
    generated_snacks_count: int = Field(default=0, description="Count of generated snack recommendations")
    recommendations: List[MealRecommendationItem] = Field(default_factory=list, description="Ordered recommended meals")
    available_substitutions: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Eligible substitutions for primary foods in recommendations (food_id -> list of substitute IDs)"
    )
    evaluation_date: date = Field(..., description="Calendar date on which recommendation was evaluated")
    evidence_summary: Dict[str, int] = Field(
        default_factory=dict,
        description="Count of recommendations by evidence tier"
    )


class BabyNutritionPreferencesResponse(BaseModel):
    """Nutrition preferences and feeding profile for a specific registered baby."""
    model_config = ConfigDict(from_attributes=True)

    baby_id: int = Field(..., description="Unique database identifier of the baby")
    complementary_feeding_start_date: Optional[date] = Field(default=None, description="Recorded date solid/semi-solid foods began")
    milk_feeding_method: Optional[str] = Field(default=None, description="Primary milk-feeding method")
    foods_introduced: List[str] = Field(default_factory=list, description="Ingredient IDs successfully introduced")
    restricted_foods: List[str] = Field(default_factory=list, description="Restriction group codes or ingredient IDs")
    available_ingredients: List[str] = Field(default_factory=list, description="Ingredient IDs on hand in the kitchen")
    dietary_preferences: List[str] = Field(default_factory=list, description="Dietary preferences (e.g. VEGETARIAN)")
    recent_meal_history: List[str] = Field(default_factory=list, description="Recently fed dish or snack IDs")
    only_available_ingredients: bool = Field(default=False, description="Strictly limit recommendations to on-hand ingredients")
    created_at: Optional[datetime] = Field(default=None, description="Record creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Record last update timestamp")


class BabyNutritionPreferencesUpdate(BaseModel):
    """Payload for updating nutrition preferences for a baby."""
    model_config = ConfigDict(extra="forbid")

    complementary_feeding_start_date: Optional[date] = Field(default=None, description="Complementary feeding start date")
    milk_feeding_method: Optional[str] = Field(default=None, description="Primary milk feeding method")
    foods_introduced: Optional[List[str]] = Field(default=None, description="Ingredient IDs introduced")
    restricted_foods: Optional[List[str]] = Field(default=None, description="Restriction codes or ingredient IDs")
    available_ingredients: Optional[List[str]] = Field(default=None, description="Household ingredient IDs")
    dietary_preferences: Optional[List[str]] = Field(default=None, description="Dietary preferences")
    recent_meal_history: Optional[List[str]] = Field(default=None, description="Recent dish IDs")
    only_available_ingredients: Optional[bool] = Field(default=None, description="Strictly limit to available ingredients")


# ============================================================================
# Phase 7: Daily and Weekly Nutrition Meal Planner Schemas
# ============================================================================

class PlannedMealSlot(BaseModel):
    """An age-appropriate scheduled meal slot or feeding session."""
    model_config = ConfigDict(extra="forbid")

    slot_number: int = Field(..., description="1-indexed feeding session number for the day")
    slot_label: str = Field(..., description="Caregiver-friendly session label (e.g. 'Introductory Feeding Session', 'Main Meal 1')")
    slot_type: MealType = Field(..., description="Meal type: MAIN_MEAL or SNACK")
    meal_item: Optional[MealRecommendationItem] = Field(default=None, description="Assigned dish or snack recommendation, if available")
    is_unfilled: bool = Field(default=False, description="True if no suitable food was eligible under hard constraints")
    unfilled_reason: Optional[str] = Field(default=None, description="Explanation when slot cannot be safely filled")
    eligible_substitutes: List[str] = Field(default_factory=list, description="IDs of other eligible dishes or snacks for this slot")


class DailyMealPlanResponse(BaseModel):
    """Structured plan for a single calendar date adhering to FHB feeding rules."""
    model_config = ConfigDict(extra="forbid")

    baby_id: int = Field(..., description="Registered baby database ID")
    plan_date: date = Field(..., description="Calendar date planned (Asia/Colombo)")
    day_of_week: str = Field(..., description="Day name, e.g. 'Monday', 'Tuesday'")
    child_age_completed_months: int = Field(..., description="Completed calendar months on plan_date")
    child_age_remaining_days: int = Field(..., description="Remaining days into the current month milestone")
    is_eligible: bool = Field(..., description="True if child is in 0-59 completed months scope")
    is_at_completion_boundary: bool = Field(..., description="True if child reached 60 completed months")
    is_under_six_months: bool = Field(..., description="True if child is 0-5 completed months (exclusive milk)")
    feeding_stage: FeedingStageId = Field(..., description="Resolved developmental feeding stage")
    stage_name: str = Field(..., description="Human-readable stage title")
    feeding_rule: Optional[FeedingRuleRecord] = Field(default=None, description="Applicable FHB rule")
    meal_frequency_guidance: str = Field(..., description="FHB meal frequency guideline")
    daily_snack_frequency_guidance: Optional[str] = Field(default=None, description="FHB snack frequency guideline")
    milk_feeding_guidance: str = Field(..., description="Age-appropriate milk feeding instructions")
    planned_meals: List[PlannedMealSlot] = Field(default_factory=list, description="Scheduled meal slots")
    planned_snacks: List[PlannedMealSlot] = Field(default_factory=list, description="Scheduled snack slots")
    general_preparation_instructions: List[str] = Field(default_factory=list, description="Preparation guidelines")
    safety_and_hygiene_guidance: List[str] = Field(default_factory=list, description="Safety, salt/sugar prohibitions")
    special_notice: Optional[str] = Field(default=None, description="Important clinical or milestone notice")
    evidence_summary: Dict[str, int] = Field(default_factory=dict, description="Counts by evidence tier")
    source_citation: Optional[SourceCitation] = Field(default=None, description="Primary FHB 2025 booklet reference")


class WeeklyGroceryItem(BaseModel):
    """Consolidated ingredient entry derived from 7-day planned meals."""
    model_config = ConfigDict(extra="forbid")

    ingredient_id: str = Field(..., description="Canonical ingredient ID")
    name: str = Field(..., description="English common name")
    sinhala_name: Optional[str] = Field(default=None, description="Sinhala localized script name")
    food_group: FoodGroup = Field(..., description="Canonical FHB food group")
    is_available_in_household: bool = Field(default=False, description="Whether marked on-hand in kitchen")
    days_used: List[date] = Field(default_factory=list, description="Dates on which ingredient is used")
    meal_names: List[str] = Field(default_factory=list, description="Names of planned dishes/snacks using this ingredient")
    total_meal_appearances: int = Field(default=0, description="Total count of meal appearances across the week")


class WeeklyMealPlanResponse(BaseModel):
    """Deterministic seven-day meal plan resolving age & rules for each date independently."""
    model_config = ConfigDict(extra="forbid")

    baby_id: int = Field(..., description="Registered baby database ID")
    start_date: date = Field(..., description="First calendar date of the 7-day plan (Asia/Colombo)")
    end_date: date = Field(..., description="Last calendar date of the 7-day plan (start_date + 6 days)")
    days: List[DailyMealPlanResponse] = Field(..., description="Ordered list of exactly 7 consecutive daily plans")
    weekly_grocery_checklist: List[WeeklyGroceryItem] = Field(default_factory=list, description="Aggregated pantry checklist")
    stage_transitions: List[str] = Field(default_factory=list, description="Notices for milestones crossed during the week")
    variety_notes: List[str] = Field(default_factory=list, description="Explanations of rotation diversity and tie-breaking")
    special_notices: List[str] = Field(default_factory=list, description="Boundary or safety notices")
    source_attribution: str = Field(
        default="Family Health Bureau, Ministry of Health, Sri Lanka (2025). 'Right Food at the Right Time, To Make My Baby Healthy and Bright'",
        description="Official source publication attribution"
    )


class SubstituteValidationRequest(BaseModel):
    """Request payload to validate a meal or snack replacement."""
    model_config = ConfigDict(extra="forbid")

    plan_date: date = Field(..., description="Date of the meal being substituted")
    original_food_id: str = Field(..., description="Current dish or snack ID")
    replacement_food_id: str = Field(..., description="Proposed replacement dish or snack ID")


class SubstituteValidationResponse(BaseModel):
    """Backend re-validation result for a proposed meal substitution."""
    model_config = ConfigDict(extra="forbid")

    is_valid: bool = Field(..., description="True if proposed replacement satisfies all hard constraints")
    validation_message: str = Field(..., description="Clinical or developmental validation rationale")
    replacement_item: Optional[MealRecommendationItem] = Field(default=None, description="Constructed replacement item if valid")



