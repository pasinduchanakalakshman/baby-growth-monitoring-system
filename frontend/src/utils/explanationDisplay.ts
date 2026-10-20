import type { ModelCombination, RiskExplanation, Risk180Day, FrontendSafeExplanation } from '@/types/growth';

/**
 * Utility functions for formatting SHAP risk explanations into parent-friendly language.
 * Adheres strictly to non-causal descriptions, accurate units/rounding, and clear model disclosures.
 */

export const PARENT_FRIENDLY_FEATURE_NAMES: Record<string, string> = {
  weight_kg: 'Current weight',
  length_height_cm: 'Current length or height',
  birth_weight_kg: 'Birth weight',
  birth_length_cm: 'Length at birth',
  gestational_age_weeks: 'Gestational age',
  birth_order: 'Birth order',
  apgar_score_5min: '5-minute APGAR score',
  age_days: 'Age',
  verified_waz: 'Weight-for-age growth information',
  verified_haz: 'Length-for-age growth information',
  observation_count: 'Number of clinic visits',
  days_since_previous_visit: 'Time since previous growth check',
  weight_change_kg: 'Weight change between visits',
  waz_change: 'Change in weight-for-age score',
  weight_velocity: 'Average daily weight change',
  weight_velocity_kg_per_day: 'Average daily weight change',
  weight_velocity_kg_per_30d: 'Monthly weight change rate',
  waz_velocity_per_day: 'Daily change in weight-for-age score',
  waz_velocity_per_30d: 'Monthly change in weight-for-age score',
  height_measurement_available: 'Length / height recorded at visit',
  last_observed_height_cm: 'Previous recorded length / height',
  last_observed_haz: 'Previous length-for-age score',
  days_since_last_height_measurement: 'Time since last length / height check',
  height_change_cm: 'Change in length / height',
  haz_change: 'Change in length-for-age growth score',
  height_velocity_cm_per_day: 'Daily change in length / height',
  height_velocity_cm_per_30d: 'Monthly change in length / height',
  haz_velocity_per_day: 'Change in length-for-age growth score',
  haz_velocity_per_30d: 'Monthly change in length-for-age score',
  waz_rolling_mean_3: 'Recent average weight-for-age score',
  weight_rolling_mean_3: 'Recent average weight',
  breastfeeding_status: 'Breastfeeding status',
  breastfeeding_frequency_per_day: 'Daily breastfeeding frequency',
  formula_feeding: 'Formula feeding',
  formula_feeds_per_day: 'Daily formula feeds',
  complementary_feeding_started: 'Solid foods introduced',
  complementary_feeding_start_age_months: 'Age solid foods started',
  meals_per_day: 'Meals per day',
  food_groups_consumed: 'Dietary food diversity',
  supplement_use: 'Nutritional supplement use',
  supplement_type: 'Type of supplement',
  recent_illness: 'Recent illness recorded',
  diarrhea_recent: 'Recent diarrhea reported',
  fever_recent: 'Recent fever reported',
  fever_last_14_days: 'Recent fever reported',
  respiratory_illness_recent: 'Recent cough or cold reported',
  illness_duration_days: 'Duration of illness',
  sex: 'Biological sex',
  delivery_type: 'Type of delivery',
  date_of_birth: 'Date of birth'
};

const LONGITUDINAL_FEATURES = new Set([
  'days_since_previous_visit',
  'days_since_last_height_measurement',
  'weight_change_kg',
  'waz_change',
  'height_change_cm',
  'haz_change',
  'weight_velocity',
  'weight_velocity_kg_per_day',
  'weight_velocity_kg_per_30d',
  'height_velocity_cm_per_day',
  'height_velocity_cm_per_30d',
  'haz_velocity_per_day',
  'haz_velocity_per_30d',
  'waz_velocity_per_day',
  'waz_velocity_per_30d',
  'waz_rolling_mean_3',
  'weight_rolling_mean_3',
  'observation_count'
]);

/**
 * Returns a parent-friendly label for a feature name.
 */
export function getParentFriendlyFeatureName(feature: string, fallback?: string): string {
  if (PARENT_FRIENDLY_FEATURE_NAMES[feature]) {
    return PARENT_FRIENDLY_FEATURE_NAMES[feature];
  }

  // Handle categorical prefix encoding e.g. delivery_type_Vaginal, sex_Female
  for (const prefix of ['sex_', 'delivery_type_', 'supplement_type_']) {
    if (feature.startsWith(prefix)) {
      const val = feature.slice(prefix.length).replace(/_/g, ' ');
      const catBase = prefix.slice(0, -1);
      const catName = PARENT_FRIENDLY_FEATURE_NAMES[catBase] || catBase.replace(/_/g, ' ');
      return `${catName}: ${val.charAt(0).toUpperCase() + val.slice(1)}`;
    }
  }

  if (fallback) {
    return fallback;
  }

  return feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Checks whether a feature is a longitudinal change between visits.
 */
export function isLongitudinalFeature(feature: string): boolean {
  return LONGITUDINAL_FEATURES.has(feature);
}

/**
 * Formats a recorded feature value according to parent-friendly clinical conventions:
 * - Weight: kg, rounded to 2 decimals.
 * - Length/height: cm, rounded to 1 decimal.
 * - Time between visits / days: whole days.
 * - Daily weight change: grams/day, rounded sensibly.
 * - HAZ/WAZ change or score: growth-score change (not cm or kg).
 * - Missing values: "Not recorded".
 */
export function formatRecordedValue(feature: string, rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined || rawValue === '' || (typeof rawValue === 'number' && !Number.isFinite(rawValue))) {
    return 'Not recorded';
  }

  // Boolean features
  if (typeof rawValue === 'boolean') {
    return rawValue ? 'Yes' : 'No';
  }

  const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
  const isNumeric = !Number.isNaN(num);

  // Weight measurements
  if (feature === 'weight_kg' || feature === 'birth_weight_kg' || feature === 'weight_rolling_mean_3') {
    return isNumeric ? `${num.toFixed(2)} kg` : String(rawValue);
  }

  if (feature === 'weight_change_kg') {
    if (!isNumeric) return String(rawValue);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${num.toFixed(2)} kg`;
  }

  // Length / height measurements
  if (feature === 'length_height_cm' || feature === 'birth_length_cm' || feature === 'last_observed_height_cm') {
    return isNumeric ? `${num.toFixed(1)} cm` : String(rawValue);
  }

  if (feature === 'height_change_cm') {
    if (!isNumeric) return String(rawValue);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${num.toFixed(1)} cm`;
  }

  // Time / age in days
  if (
    feature === 'days_since_previous_visit' ||
    feature === 'days_since_last_height_measurement' ||
    feature === 'illness_duration_days' ||
    feature === 'age_days'
  ) {
    if (!isNumeric) return String(rawValue);
    const days = Math.round(num);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }

  // Daily weight change (kg/day -> grams/day)
  if (feature === 'weight_velocity_kg_per_day' || feature === 'weight_velocity') {
    if (!isNumeric) return String(rawValue);
    // kg/day converted to g/day
    const grams = Math.round(num * 1000);
    const prefix = grams > 0 ? '+' : '';
    return `${prefix}${grams} g/day`;
  }

  if (feature === 'weight_velocity_kg_per_30d') {
    if (!isNumeric) return String(rawValue);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${num.toFixed(2)} kg/month`;
  }

  // Growth scores and score velocities (HAZ / WAZ)
  if (
    feature === 'haz_change' ||
    feature === 'haz_velocity_per_day' ||
    feature === 'haz_velocity_per_30d' ||
    feature === 'waz_change' ||
    feature === 'waz_velocity_per_day' ||
    feature === 'waz_velocity_per_30d'
  ) {
    if (!isNumeric) return String(rawValue);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${num.toFixed(2)} growth score change`;
  }

  if (
    feature === 'verified_waz' ||
    feature === 'verified_haz' ||
    feature === 'last_observed_haz' ||
    feature === 'waz_rolling_mean_3'
  ) {
    if (!isNumeric) return String(rawValue);
    const prefix = num > 0 ? '+' : '';
    return `${prefix}${num.toFixed(2)} (growth score)`;
  }

  // Integer observation counts / feeds / meals
  if (
    feature === 'observation_count' ||
    feature === 'breastfeeding_frequency_per_day' ||
    feature === 'formula_feeds_per_day' ||
    feature === 'meals_per_day' ||
    feature === 'food_groups_consumed' ||
    feature === 'birth_order'
  ) {
    return isNumeric ? `${Math.round(num)}` : String(rawValue);
  }

  // Fallback for general numeric values
  if (isNumeric) {
    // If it has decimals, format to 2 decimals, otherwise integer string
    return Number.isInteger(num) ? `${num}` : `${num.toFixed(2)}`;
  }

  return String(rawValue);
}

// Older servers may omit the breakdown. Never fill missing scores with zero or guesses.
export function isValidModelCombination(value: ModelCombination | null | undefined): value is ModelCombination {
  if (!value) return false;
  const numbers = [value.xgboost_weight, value.transformer_weight, value.xgboost_score,
    value.transformer_score, value.xgboost_weighted_contribution,
    value.transformer_weighted_contribution, value.hybrid_score];
  return numbers.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
    && value.xgboost_weight === 0.9 && value.transformer_weight === 0.1
    && Math.abs(value.xgboost_weighted_contribution - value.xgboost_weight * value.xgboost_score) < 1e-12
    && Math.abs(value.transformer_weighted_contribution - value.transformer_weight * value.transformer_score) < 1e-12
    && Math.abs(value.xgboost_weighted_contribution + value.transformer_weighted_contribution - value.hybrid_score) < 1e-12;
}

export const EXPLANATION_LIMITATION =
  "These highlighted details explain part of the screening assessment. They do not tell us for certain what will happen to your baby's growth.";

export const NEUTRAL_FACTOR_INFLUENCE = 'This recorded measurement was considered in the explanation.';

/** Interpret only the documented direction when its signed attribution and scope agree. */
export function getFactorInfluence(explanation: RiskExplanation, factor: FrontendSafeExplanation, contribution: number | undefined): string {
  const scope = explanation.explanation_scope;
  if (scope?.shap_branch !== 'xgboost_only' || scope.shap_value_space !== 'log_odds'
    || scope.transformer_feature_attribution_available !== false
    || typeof contribution !== 'number' || !Number.isFinite(contribution)) return NEUTRAL_FACTOR_INFLUENCE;
  if (factor.direction === 'increased model-predicted risk' && contribution > 0) {
    return 'This information increased the screening score in the explained part of the assessment.';
  }
  if (factor.direction === 'decreased model-predicted risk' && contribution < 0) {
    return 'This information decreased the screening score in the explained part of the assessment.';
  }
  return NEUTRAL_FACTOR_INFLUENCE;
}

export function getRecordedVisitCount(explanation: RiskExplanation): number | null {
  const count = explanation.assessment?.recorded_visit_count;
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null;
}

/** Use the existing backend decision only when all outputs match. Never classify a score here. */
export function getMatchedScreeningStatus(explanation: RiskExplanation, risk: Risk180Day | null | undefined): 'elevated' | 'below' | null {
  const original = explanation.model_combination;
  const latest = risk?.model_combination;
  if (!risk?.risk_available || risk.model_applicable === false || risk.prediction_horizon_days !== 180
    || !isValidModelCombination(original) || !isValidModelCombination(latest)) return null;
  const keys: (keyof ModelCombination)[] = ['xgboost_weight', 'transformer_weight', 'xgboost_score',
    'transformer_score', 'xgboost_weighted_contribution', 'transformer_weighted_contribution', 'hybrid_score'];
  if (!keys.every(key => original[key] === latest[key])
    || (risk.risk_score ?? risk.risk_probability) !== original.hybrid_score) return null;
  if (risk.screening_status === 'Elevated screening risk' && risk.risk_flag === 1) return 'elevated';
  if (risk.screening_status === 'Below screening threshold' && risk.risk_flag === 0) return 'below';
  return null;
}

// A short, explicit list prevents internal or unknown feature identifiers from leaking into the page.
const MEASUREMENT_FEATURES = new Set([
  'weight_kg', 'length_height_cm', 'birth_weight_kg', 'birth_length_cm', 'age_days',
  'verified_waz', 'verified_haz', 'gestational_age_weeks',
  'breastfeeding_status', 'breastfeeding_frequency_per_day', 'formula_feeding', 'formula_feeds_per_day',
  'complementary_feeding_started', 'meals_per_day', 'food_groups_consumed',
  'recent_illness', 'diarrhea_recent', 'fever_recent', 'respiratory_illness_recent', 'illness_duration_days',
]);
const BOOLEAN_FEATURES = new Set([
  'breastfeeding_status', 'formula_feeding', 'complementary_feeding_started',
  'recent_illness', 'diarrhea_recent', 'fever_recent', 'respiratory_illness_recent',
]);
const MEASURED_CHANGES = new Set(['weight_change_kg', 'height_change_cm']);

interface RecordedFactor extends FrontendSafeExplanation {
  label: string;
  recordedValue: string;
  influence: string;
}

/** Preserve API order, rank, and direction, but display only known factors with real raw values. */
export function getMotherFriendlyFactors(explanation: RiskExplanation): { measurements: RecordedFactor[]; changes: RecordedFactor[] } {
  const measurements: RecordedFactor[] = [];
  const changes: RecordedFactor[] = [];
  const seen = new Set<string>();
  const hasHistory = (getRecordedVisitCount(explanation) ?? 0) >= 2;
  for (const factor of explanation.frontend_safe_explanation ?? []) {
    const isChange = MEASURED_CHANGES.has(factor.feature);
    if ((!MEASUREMENT_FEATURES.has(factor.feature) && !isChange) || (isChange && !hasHistory) || seen.has(factor.feature)) continue;
    const contribution = explanation.technical_explanation?.contributions?.find(c => c.feature === factor.feature);
    const raw = contribution?.raw_value;
    let value: number | boolean;
    if (BOOLEAN_FEATURES.has(factor.feature)) {
      if (typeof raw === 'boolean') value = raw;
      else if (raw === 0 || raw === 1) value = raw === 1;
      else continue;
    } else {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      value = raw;
    }
    seen.add(factor.feature);
    const recordedValue = factor.feature === 'verified_waz' || factor.feature === 'verified_haz'
      ? 'Recorded for this growth check'
      : formatRecordedValue(factor.feature, value);
    const item = { ...factor, label: getParentFriendlyFeatureName(factor.feature), recordedValue,
      influence: getFactorInfluence(explanation, factor, contribution?.shap_contribution) };
    if (isChange) changes.push(item);
    else measurements.push(item);
  }
  return { measurements: measurements.slice(0, 4), changes: changes.slice(0, 2) };
}
