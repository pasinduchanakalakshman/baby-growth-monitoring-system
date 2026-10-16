/**
 * Utility functions for formatting SHAP risk explanations into parent-friendly language.
 * Adheres strictly to non-causal descriptions, accurate units/rounding, and clear model disclosures.
 */

export const PARENT_FRIENDLY_FEATURE_NAMES: Record<string, string> = {
  weight_kg: 'Current weight',
  length_height_cm: 'Current length / height',
  birth_weight_kg: 'Birth weight',
  birth_length_cm: 'Length at birth',
  gestational_age_weeks: 'Gestational age',
  birth_order: 'Birth order',
  apgar_score_5min: '5-minute APGAR score',
  age_days: 'Child age',
  verified_waz: 'Weight-for-age growth score',
  verified_haz: 'Length-for-age growth score',
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
  if (rawValue === null || rawValue === undefined || rawValue === '' || Number.isNaN(rawValue)) {
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

/**
 * Deterministically generates parent-friendly explanation text based on:
 * - Feature identifier
 * - Actual SHAP attribution direction (increased vs decreased model output)
 * - Actual recorded value
 *
 * Strict safety rules:
 * - No causal claims ("because child is too short")
 * - No medical diagnoses
 * - Explains clearly whether factor shifted the screening score higher or lower
 */
export function getParentFriendlyDescription(feature: string, direction: string): string {
  const isIncreasing = direction.toLowerCase().includes('increase');
  const effectText = isIncreasing
    ? 'In the AI model’s calculation, this factor shifted the predicted risk score higher.'
    : 'In the AI model’s calculation, this factor shifted the predicted risk score lower.';

  let observationText = '';

  switch (feature) {
    case 'weight_kg':
      observationText = "Your child's recorded weight was one of the measurements the AI considered important.";
      break;
    case 'length_height_cm':
      observationText = "Your child's recorded length or height was evaluated by the AI model during this visit.";
      break;
    case 'birth_weight_kg':
      observationText = "Your child's recorded birth weight was included in the model's assessment.";
      break;
    case 'birth_length_cm':
      observationText = "Your child's length recorded at birth was taken into account by the model.";
      break;
    case 'age_days':
      observationText = "Your child's age influenced the model's assessment.";
      break;
    case 'days_since_previous_visit':
      observationText = "The time elapsed since your child's previous clinic visit was evaluated.";
      break;
    case 'weight_velocity':
    case 'weight_velocity_kg_per_day':
    case 'weight_velocity_kg_per_30d':
    case 'weight_change_kg':
      observationText = "The AI considered how your child's weight changed between clinic visits.";
      break;
    case 'haz_change':
    case 'haz_velocity_per_day':
    case 'haz_velocity_per_30d':
      observationText = "The AI examined how your child's length-for-age growth score changed over time.";
      break;
    case 'verified_waz':
    case 'waz_change':
    case 'waz_velocity_per_day':
    case 'waz_velocity_per_30d':
    case 'waz_rolling_mean_3':
      observationText = "Your child's weight-for-age growth score was evaluated by the AI model.";
      break;
    case 'verified_haz':
    case 'last_observed_haz':
      observationText = "Your child's length-for-age growth score was evaluated by the AI model.";
      break;
    case 'height_change_cm':
    case 'height_velocity_cm_per_day':
    case 'height_velocity_cm_per_30d':
    case 'last_observed_height_cm':
      observationText = "The AI evaluated how your child's height or length progressed between check-ups.";
      break;
    case 'recent_illness':
    case 'diarrhea_recent':
    case 'fever_recent':
    case 'fever_last_14_days':
    case 'respiratory_illness_recent':
    case 'illness_duration_days':
      observationText = 'Information about recent childhood illnesses was considered in the model’s assessment.';
      break;
    case 'breastfeeding_status':
    case 'breastfeeding_frequency_per_day':
    case 'formula_feeding':
    case 'formula_feeds_per_day':
    case 'complementary_feeding_started':
    case 'complementary_feeding_start_age_months':
    case 'meals_per_day':
    case 'food_groups_consumed':
      observationText = 'Recorded feeding practices were considered in the model’s assessment.';
      break;
    case 'observation_count':
      observationText = 'The number of clinic visits recorded for your child was considered by the model.';
      break;
    default: {
      const friendlyName = getParentFriendlyFeatureName(feature);
      observationText = `The recorded ${friendlyName.toLowerCase()} was evaluated by the AI model.`;
      break;
    }
  }

  return `${observationText} ${effectText}`;
}

export const HYBRID_MODEL_COVERAGE_DISCLOSURE = {
  title: 'Understanding What This Explanation Covers',
  summary:
    'The 180-day growth assessment score is produced by a hybrid AI system: 90% XGBoost (tabular measurements) and 10% Clean Transformer (longitudinal timeline).',
  details:
    'These feature explanations explain only the 90% XGBoost branch of the hybrid screening score. The 10% Transformer sequence branch evaluates complex trajectory patterns across past visits, and individual feature breakdowns are not calculated for it. These factors explain model behavior, not medical causes.'
};
