/**
 * TypeScript type definitions for the Sri Lankan Nutrition Recommendation System.
 *
 * Traceable to Family Health Bureau (FHB) Sri Lanka (2025):
 * "Right Food at the Right Time, To Make My Baby Healthy and Bright"
 */

export type EvidenceTier = 'TIER_A' | 'TIER_B' | 'TIER_C';

export type FoodGroup =
  | 'GRAINS_AND_STAPLES'
  | 'PULSES_AND_LEGUMES'
  | 'ANIMAL_SOURCE_FOODS'
  | 'VEGETABLES'
  | 'GREEN_LEAVES'
  | 'FRUITS'
  | 'FATS_AND_DAIRY'
  | 'HUMAN_MILK';

export type FoodTexture =
  | 'LIQUID'
  | 'SMOOTH_PUREE'
  | 'SEMI_SOLID_MASH'
  | 'HALF_MASHED'
  | 'COARSELY_MASHED'
  | 'COARSELY_CHOPPED'
  | 'FINGER_FOOD'
  | 'FAMILY_FOOD';

export type MealType =
  | 'MAIN_MEAL'
  | 'SNACK'
  | 'BREAKFAST'
  | 'LUNCH'
  | 'DINNER'
  | 'TASTE_SESSION';

export type RestrictionGroupCode =
  | 'RESTRICT_FISH'
  | 'RESTRICT_SHELLFISH'
  | 'RESTRICT_DAIRY'
  | 'RESTRICT_EGG'
  | 'RESTRICT_SOYA'
  | 'RESTRICT_LEGUMES'
  | 'RESTRICT_PEANUT'
  | 'RESTRICT_TREE_NUT'
  | 'RESTRICT_COCONUT';

export type MilkFeedingMethod =
  | 'exclusive_breastfeeding'
  | 'complementary_breastfeeding'
  | 'infant_formula_only'
  | 'cow_milk'
  | 'other';

export interface SourceCitation {
  publication: string;
  organization: string;
  year: number;
  booklet_page?: number | null;
  pdf_page?: number | null;
  evidence_tier: EvidenceTier;
  evidence_description: string;
}

export interface FeedingRuleRecord {
  rule_id: string;
  stage_id: string;
  stage_name: string;
  min_calendar_months: number;
  max_calendar_months: number;
  days_since_start_min?: number | null;
  days_since_start_max?: number | null;
  min_days_into_month?: number | null;
  max_days_into_month?: number | null;
  precedence: number;
  requires_known_start_date: boolean;
  is_late_starter_rule: boolean;
  daily_meal_frequency: string;
  daily_snack_frequency?: string | null;
  household_portion: string;
  texture: FoodTexture;
  recommended_food_groups: FoodGroup[];
  preparation_instructions: string[];
  safety_and_hygiene_guidance: string[];
  evidence_tier: EvidenceTier;
  source_citation: SourceCitation;
}

export interface MealRecommendationItem {
  recommendation_id: string;
  meal_slot: MealType;
  dish_or_food_id: string;
  name: string;
  sinhala_name?: string | null;
  item_type: 'DISH' | 'SNACK' | 'SINGLE_INGREDIENT' | 'MILK_ONLY';
  ingredients: string[];
  food_groups: FoodGroup[];
  texture: FoodTexture;
  household_portion: string;
  preparation_instructions: string[];
  safety_precautions: string[];
  recommendation_reason: string;
  evidence_tier: EvidenceTier;
  source_citation: SourceCitation;
  is_available_in_household: boolean;
  ranking_score: number;
  ranking_factors: string[];
}

export interface NutritionRecommendationResponse {
  child_age_completed_months: number;
  child_age_remaining_days: number;
  is_eligible: boolean;
  is_at_completion_boundary: boolean;
  feeding_stage: string;
  stage_name: string;
  feeding_rule?: FeedingRuleRecord | null;
  meal_frequency_guidance: string;
  daily_snack_frequency_guidance?: string | null;
  milk_feeding_guidance: string;
  general_preparation_instructions: string[];
  safety_and_hygiene_guidance: string[];
  special_notice?: string | null;
  generated_main_meals_count: number;
  generated_snacks_count: number;
  recommendations: MealRecommendationItem[];
  available_substitutions: Record<string, string[]>;
  evaluation_date: string; // YYYY-MM-DD
  evidence_summary: Record<string, number>;
}

export interface BabyNutritionPreferencesResponse {
  baby_id: number;
  complementary_feeding_start_date?: string | null;
  milk_feeding_method?: MilkFeedingMethod | string | null;
  foods_introduced: string[];
  restricted_foods: string[];
  available_ingredients: string[];
  dietary_preferences: string[];
  recent_meal_history: string[];
  only_available_ingredients: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BabyNutritionPreferencesUpdate {
  complementary_feeding_start_date?: string | null;
  milk_feeding_method?: MilkFeedingMethod | string | null;
  foods_introduced?: string[];
  restricted_foods?: string[];
  available_ingredients?: string[];
  dietary_preferences?: string[];
  recent_meal_history?: string[];
  only_available_ingredients?: boolean;
}

export interface PlannedMealSlot {
  slot_number: number;
  slot_label: string;
  slot_type: MealType;
  meal_item?: MealRecommendationItem | null;
  is_unfilled: boolean;
  unfilled_reason?: string | null;
  eligible_substitutes: string[];
}

export interface DailyMealPlanResponse {
  baby_id: number;
  plan_date: string; // YYYY-MM-DD
  day_of_week: string;
  child_age_completed_months: number;
  child_age_remaining_days: number;
  is_eligible: boolean;
  is_at_completion_boundary: boolean;
  is_under_six_months: boolean;
  feeding_stage: string;
  stage_name: string;
  feeding_rule?: FeedingRuleRecord | null;
  meal_frequency_guidance: string;
  daily_snack_frequency_guidance?: string | null;
  milk_feeding_guidance: string;
  planned_meals: PlannedMealSlot[];
  planned_snacks: PlannedMealSlot[];
  general_preparation_instructions: string[];
  safety_and_hygiene_guidance: string[];
  special_notice?: string | null;
  evidence_summary: Record<string, number>;
  source_citation?: SourceCitation | null;
}

export interface WeeklyGroceryItem {
  ingredient_id: string;
  name: string;
  sinhala_name?: string | null;
  food_group: FoodGroup;
  is_available_in_household: boolean;
  days_used: string[];
  meal_names: string[];
  total_meal_appearances: number;
}

export interface WeeklyMealPlanResponse {
  baby_id: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  days: DailyMealPlanResponse[];
  weekly_grocery_checklist: WeeklyGroceryItem[];
  stage_transitions: string[];
  variety_notes: string[];
  special_notices: string[];
  source_attribution: string;
}

export interface SubstituteValidationRequest {
  plan_date: string; // YYYY-MM-DD
  original_food_id: string;
  replacement_food_id: string;
}

export interface SubstituteValidationResponse {
  is_valid: boolean;
  validation_message: string;
  replacement_item?: MealRecommendationItem | null;
}

