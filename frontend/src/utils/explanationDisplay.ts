import type {
  ModelCombination,
  RiskExplanation,
  Risk180Day,
  FrontendSafeExplanation,
  GrowthHistoryPoint,
  Forecast30Day
} from '@/types/growth';

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

export interface RecordedFactor extends FrontendSafeExplanation {
  label: string;
  recordedValue: string;
  influence: string;
  description: string;
}

/**
 * Generates an honest, non-causal, personalized explanation sentence tailored to
 * each child's actual recorded measurement and observed XAI contribution.
 */
export function getPersonalizedDescription(
  factor: FrontendSafeExplanation,
  recordedValue: string,
  influence: string,
  status?: 'elevated' | 'below' | null
): string {
  const isConfirmed = status === 'elevated' || status === 'below';
  const isIncreasing = factor.direction === 'increased model-predicted risk' && influence.includes('increased');
  const isDecreasing = factor.direction === 'decreased model-predicted risk' && influence.includes('decreased');
  const directionText = isIncreasing
    ? 'higher in this assessment'
    : isDecreasing
      ? 'lower in this assessment'
      : 'in the model calculation';

  switch (factor.feature) {
    case 'weight_kg':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's current recorded weight of ${recordedValue} was evaluated by the screening model, shifting the screening score ${directionText}.`
        : `Your baby's current recorded weight of ${recordedValue} was evaluated as part of this growth check.`;
    case 'length_height_cm':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's current recorded length/height of ${recordedValue} was evaluated by the screening model, shifting the screening score ${directionText}.`
        : `Your baby's current recorded length/height of ${recordedValue} was evaluated as part of this growth check.`;
    case 'birth_weight_kg':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's recorded birth weight of ${recordedValue} was included in the model's assessment, shifting the screening score ${directionText}.`
        : `Your baby's recorded birth weight of ${recordedValue} was included in the model's assessment.`;
    case 'birth_length_cm':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's recorded length at birth of ${recordedValue} was taken into account by the model, shifting the screening score ${directionText}.`
        : `Your baby's recorded length at birth of ${recordedValue} was taken into account by the model.`;
    case 'age_days':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's age of ${recordedValue} at this check was evaluated by the model, shifting the screening score ${directionText}.`
        : `Your baby's age of ${recordedValue} at this check was evaluated by the model.`;
    case 'gestational_age_weeks':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's gestational age of ${recordedValue} was evaluated by the model, shifting the screening score ${directionText}.`
        : `Your baby's gestational age of ${recordedValue} was evaluated by the model.`;
    case 'verified_waz':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's weight-for-age growth information for this check was evaluated by the model, shifting the screening score ${directionText}.`
        : `Your baby's weight-for-age growth information for this check was evaluated by the model.`;
    case 'verified_haz':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's length-for-age growth information for this check was evaluated by the model, shifting the screening score ${directionText}.`
        : `Your baby's length-for-age growth information for this check was evaluated by the model.`;
    case 'days_since_previous_visit':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `The interval of ${recordedValue} since your baby's previous growth check was evaluated, shifting the screening score ${directionText}.`
        : `The time since your baby's previous growth check (${recordedValue}) was evaluated by the model.`;
    case 'weight_change_kg':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `A recorded weight change of ${recordedValue} between checks was evaluated by the model, shifting the screening score ${directionText}.`
        : `The recorded weight change of ${recordedValue} between checks was evaluated by the model.`;
    case 'height_change_cm':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `A recorded length/height change of ${recordedValue} between checks was evaluated by the model, shifting the screening score ${directionText}.`
        : `The recorded length/height change of ${recordedValue} between checks was evaluated by the model.`;
    case 'waz_change':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `The change in your baby's weight-for-age position between checks (${recordedValue}) was evaluated by the model, shifting the screening score ${directionText}.`
        : `The change in your baby's weight-for-age position between checks (${recordedValue}) was evaluated by the model.`;
    case 'haz_change':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `The change in your baby's length-for-age position between checks (${recordedValue}) was evaluated by the model, shifting the screening score ${directionText}.`
        : `The change in your baby's length-for-age position between checks (${recordedValue}) was evaluated by the model.`;
    case 'weight_velocity_kg_per_day':
    case 'weight_velocity':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's daily weight gain rate of ${recordedValue} was evaluated by the model, shifting the screening score ${directionText}.`
        : `Your baby's daily weight gain rate of ${recordedValue} was evaluated by the model.`;
    case 'waz_velocity_per_day':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Your baby's daily change in weight-for-age score (${recordedValue}) was evaluated by the model, shifting the screening score ${directionText}.`
        : `Your baby's daily change in weight-for-age score (${recordedValue}) was evaluated by the model.`;
    case 'breastfeeding_status':
    case 'breastfeeding_frequency_per_day':
    case 'formula_feeding':
    case 'formula_feeds_per_day':
    case 'complementary_feeding_started':
    case 'meals_per_day':
    case 'food_groups_consumed':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Recorded feeding information (${recordedValue}) was evaluated by the model, shifting the screening score ${directionText}.`
        : `Recorded feeding information (${recordedValue}) was evaluated by the model.`;
    case 'recent_illness':
    case 'diarrhea_recent':
    case 'fever_recent':
    case 'respiratory_illness_recent':
    case 'illness_duration_days':
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `Recorded illness information (${recordedValue}) was evaluated by the model, shifting the screening score ${directionText}.`
        : `Recorded illness information (${recordedValue}) was evaluated by the model.`;
    default:
      return isConfirmed && (isIncreasing || isDecreasing)
        ? `This recorded measurement (${recordedValue}) was evaluated by the model, shifting the screening score ${directionText}.`
        : `This recorded measurement (${recordedValue}) was considered by the model.`;
  }
}

/** Preserve API order, rank, and direction, but display only known factors with real raw values. */
export function getMotherFriendlyFactors(
  explanation: RiskExplanation,
  status?: 'elevated' | 'below' | null
): { measurements: RecordedFactor[]; changes: RecordedFactor[] } {
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
    const influence = getFactorInfluence(explanation, factor, contribution?.shap_contribution);
    const description = getPersonalizedDescription(factor, recordedValue, influence, status ?? null);
    const item: RecordedFactor = {
      ...factor,
      label: getParentFriendlyFeatureName(factor.feature),
      recordedValue,
      influence,
      description
    };
    if (isChange) changes.push(item);
    else measurements.push(item);
  }
  return { measurements: measurements.slice(0, 4), changes: changes.slice(0, 2) };
}

export interface WeightHistoryPointSimple {
  date: string;
  weightKg: number;
}

export interface WeightHistoryAnalysis {
  hasEnoughData: boolean;
  totalVisits: number;
  latest: WeightHistoryPointSimple | null;
  previous: WeightHistoryPointSimple | null;
  changeKg: number | null;
  daysBetween: number | null;
  rateGramsPerDay: number | null;
  summaryText: string;
  points: WeightHistoryPointSimple[];
}

export function analyzeWeightHistory(
  history?: { visit_date: string; weight_kg?: number | null }[] | null,
  fallbackExplanation?: RiskExplanation | null
): WeightHistoryAnalysis {
  const validPoints: WeightHistoryPointSimple[] = [];

  if (Array.isArray(history)) {
    for (const p of history) {
      if (
        p &&
        typeof p.weight_kg === 'number' &&
        Number.isFinite(p.weight_kg) &&
        p.weight_kg > 0 &&
        typeof p.visit_date === 'string' &&
        p.visit_date.trim() !== ''
      ) {
        validPoints.push({ date: p.visit_date.trim(), weightKg: p.weight_kg });
      }
    }
  }

  // If no history array was provided, inspect explanation metadata for visit & weight
  if (validPoints.length === 0 && fallbackExplanation) {
    const date = fallbackExplanation.assessment?.visit_date;
    const weightContrib = fallbackExplanation.technical_explanation?.contributions?.find(
      c => c.feature === 'weight_kg'
    );
    const rawWeight = weightContrib?.raw_value;
    if (typeof date === 'string' && typeof rawWeight === 'number' && Number.isFinite(rawWeight) && rawWeight > 0) {
      validPoints.push({ date: date.trim(), weightKg: rawWeight });
    }
  }

  // Sort points chronologically
  validPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validPoints.length === 0) {
    return {
      hasEnoughData: false,
      totalVisits: 0,
      latest: null,
      previous: null,
      changeKg: null,
      daysBetween: null,
      rateGramsPerDay: null,
      summaryText: 'No weight checks recorded yet.',
      points: []
    };
  }

  if (validPoints.length === 1) {
    const single = validPoints[0];
    return {
      hasEnoughData: false,
      totalVisits: 1,
      latest: single,
      previous: null,
      changeKg: null,
      daysBetween: null,
      rateGramsPerDay: null,
      summaryText: `We have one recorded weight check for your baby (${single.weightKg.toFixed(2)} kg on ${single.date}). At least two recorded measurements are needed to determine weight changes over time.`,
      points: validPoints
    };
  }

  const previous = validPoints[validPoints.length - 2];
  const latest = validPoints[validPoints.length - 1];
  const changeKg = Math.round((latest.weightKg - previous.weightKg) * 100) / 100;

  const prevTime = new Date(previous.date).getTime();
  const latestTime = new Date(latest.date).getTime();
  const diffDays = Math.round((latestTime - prevTime) / (1000 * 60 * 60 * 24));
  const daysBetween = Number.isFinite(diffDays) && diffDays > 0 ? diffDays : 1;
  const rateGramsPerDay = Math.round((changeKg * 1000) / daysBetween);

  let directionText = 'maintained weight';
  if (changeKg > 0) {
    directionText = `gained ${changeKg.toFixed(2)} kg`;
  } else if (changeKg < 0) {
    directionText = `lost ${Math.abs(changeKg).toFixed(2)} kg`;
  }

  const rateStr = rateGramsPerDay > 0
    ? `+${rateGramsPerDay} g/day`
    : `${rateGramsPerDay} g/day`;

  const summaryText = `Between ${previous.date} and ${latest.date}, your baby ${directionText} over ${daysBetween} days (about ${rateStr}).`;

  return {
    hasEnoughData: true,
    totalVisits: validPoints.length,
    latest,
    previous,
    changeKg,
    daysBetween,
    rateGramsPerDay,
    summaryText,
    points: validPoints
  };
}

export const WEIGHT_RELATED_FEATURES = new Set([
  'weight_kg',
  'birth_weight_kg',
  'verified_waz',
  'weight_change_kg',
  'waz_change',
  'weight_velocity_kg_per_day',
  'weight_velocity_kg_per_30d',
  'waz_velocity_per_day',
  'waz_velocity_per_30d',
  'weight_rolling_mean_3',
  'waz_rolling_mean_3',
]);

export function getWeightRelatedFactors(
  explanation: RiskExplanation,
  status?: 'elevated' | 'below' | null
): RecordedFactor[] {
  const { measurements, changes } = getMotherFriendlyFactors(explanation, status);
  const combined = [...measurements, ...changes];
  const weightFactors = combined.filter(f => WEIGHT_RELATED_FEATURES.has(f.feature));
  return weightFactors;
}

export interface WazComparison {
  hasEnoughData: boolean;
  previousWaz: number | null;
  latestWaz: number | null;
  wazChange: number | null;
  status: 'lower' | 'steady' | 'higher' | 'single_check' | 'unavailable';
  summaryText: string;
  cautionText: string;
}

export function analyzeWazComparison(
  history?: GrowthHistoryPoint[] | null,
  fallbackExplanation?: RiskExplanation | null
): WazComparison {
  const cautionText =
    'Important: Gaining weight does not necessarily mean a baby’s weight-for-age position has improved. If weight gain is slower than expected for their age, their weight increases while their relative position on age-based growth charts shifts lower.';

  if (!Array.isArray(history) || history.length === 0) {
    // Check fallback explanation
    const wazContrib = fallbackExplanation?.technical_explanation?.contributions?.find(
      c => c.feature === 'verified_waz'
    );
    const rawWaz = typeof wazContrib?.raw_value === 'number' && Number.isFinite(wazContrib.raw_value)
      ? Math.round(wazContrib.raw_value * 100) / 100
      : null;

    if (rawWaz !== null) {
      return {
        hasEnoughData: false,
        previousWaz: null,
        latestWaz: rawWaz,
        wazChange: null,
        status: 'single_check',
        summaryText: `Your baby's current recorded weight-for-age score is ${rawWaz > 0 ? '+' : ''}${rawWaz.toFixed(2)}. At least two recorded checks are needed to track how their growth position compares over time.`,
        cautionText: 'Growth scores compare your baby’s measurements against age-based population growth references.'
      };
    }

    return {
      hasEnoughData: false,
      previousWaz: null,
      latestWaz: null,
      wazChange: null,
      status: 'unavailable',
      summaryText: 'Weight-for-age growth score records are not available for comparison.',
      cautionText: 'Growth scores compare your baby’s measurements against standard population growth references.'
    };
  }

  // Filter valid points with visit_date
  const sorted = [...history]
    .filter(p => p && typeof p.visit_date === 'string' && p.visit_date.trim() !== '')
    .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime());

  if (sorted.length < 2) {
    const single = sorted[0];
    const singleWaz = typeof single?.verified_waz === 'number' && Number.isFinite(single.verified_waz)
      ? Math.round(single.verified_waz * 100) / 100
      : null;

    return {
      hasEnoughData: false,
      previousWaz: null,
      latestWaz: singleWaz,
      wazChange: null,
      status: 'single_check',
      summaryText: singleWaz !== null
        ? `Your baby's current recorded weight-for-age score is ${singleWaz > 0 ? '+' : ''}${singleWaz.toFixed(2)}. At least two recorded checks are needed to track how their growth position compares over time.`
        : 'At least two recorded growth checks are needed to compare growth positions over time.',
      cautionText: 'Growth scores compare your baby’s measurements against age-based growth charts.'
    };
  }

  const prev = sorted[sorted.length - 2];
  const latest = sorted[sorted.length - 1];

  const prevWaz = typeof prev.verified_waz === 'number' && Number.isFinite(prev.verified_waz)
    ? Math.round(prev.verified_waz * 100) / 100
    : null;
  const latestWaz = typeof latest.verified_waz === 'number' && Number.isFinite(latest.verified_waz)
    ? Math.round(latest.verified_waz * 100) / 100
    : null;

  if (prevWaz === null || latestWaz === null) {
    return {
      hasEnoughData: false,
      previousWaz: prevWaz,
      latestWaz: latestWaz,
      wazChange: null,
      status: 'unavailable',
      summaryText: 'A complete weight-for-age comparison between these checks is not available.',
      cautionText
    };
  }

  const wazChange = Math.round((latestWaz - prevWaz) * 100) / 100;

  if (wazChange <= -0.1) {
    return {
      hasEnoughData: true,
      previousWaz: prevWaz,
      latestWaz: latestWaz,
      wazChange,
      status: 'lower',
      summaryText: `Between ${prev.visit_date} and ${latest.visit_date}, your baby's weight-for-age position shifted lower (from ${prevWaz > 0 ? '+' : ''}${prevWaz.toFixed(2)} to ${latestWaz > 0 ? '+' : ''}${latestWaz.toFixed(2)}) relative to standard age-based growth curves. Even when a baby gains weight, tracking below the expected growth pace for their age group shifts their relative curve position lower.`,
      cautionText
    };
  }

  if (wazChange >= 0.1) {
    return {
      hasEnoughData: true,
      previousWaz: prevWaz,
      latestWaz: latestWaz,
      wazChange,
      status: 'higher',
      summaryText: `Between ${prev.visit_date} and ${latest.visit_date}, your baby's weight-for-age position moved higher (from ${prevWaz > 0 ? '+' : ''}${prevWaz.toFixed(2)} to ${latestWaz > 0 ? '+' : ''}${latestWaz.toFixed(2)}) relative to standard age-based growth curves, showing good progress relative to age-based references.`,
      cautionText
    };
  }

  return {
    hasEnoughData: true,
    previousWaz: prevWaz,
    latestWaz: latestWaz,
    wazChange,
    status: 'steady',
    summaryText: `Between ${prev.visit_date} and ${latest.visit_date}, your baby's weight maintained a steady position relative to age-based growth curves (from ${prevWaz > 0 ? '+' : ''}${prevWaz.toFixed(2)} to ${latestWaz > 0 ? '+' : ''}${latestWaz.toFixed(2)}).`,
    cautionText: 'A steady weight-for-age score indicates that your baby’s weight gain is keeping pace with standard growth curves.'
  };
}

export interface ForecastComparison {
  available: boolean;
  estimatedWeightKg: number | null;
  estimatedWeightChangeKg: number | null;
  estimatedWaz: number | null;
  horizonDays: number;
  summaryText: string;
  differenceText: string;
}

export function analyzeForecastComparison(forecast?: Forecast30Day | null): ForecastComparison {
  const differenceText =
    'Distinguishing Forecast from Screening: The 30-day forecast is a short-term projection of expected weight based on recent growth. In contrast, the 180-day screening looks 6 months ahead to determine whether closer growth monitoring may be helpful. Both are predictive estimates and do not represent actual observed measurements.';

  if (!forecast || !forecast.forecast_available) {
    return {
      available: false,
      estimatedWeightKg: null,
      estimatedWeightChangeKg: null,
      estimatedWaz: null,
      horizonDays: forecast?.nominal_horizon_days ?? 30,
      summaryText: forecast?.reason
        ? `A 30-day growth forecast is not available yet: ${forecast.reason}`
        : 'A 30-day growth forecast is not available yet. Additional recorded growth checks are needed before a short-term projection can be generated.',
      differenceText
    };
  }

  const estWeight = typeof forecast.estimated_future_weight_kg === 'number' && Number.isFinite(forecast.estimated_future_weight_kg)
    ? Math.round(forecast.estimated_future_weight_kg * 100) / 100
    : null;
  const estChange = typeof forecast.estimated_weight_change_kg === 'number' && Number.isFinite(forecast.estimated_weight_change_kg)
    ? Math.round(forecast.estimated_weight_change_kg * 100) / 100
    : null;
  const estWaz = typeof forecast.estimated_future_waz === 'number' && Number.isFinite(forecast.estimated_future_waz)
    ? Math.round(forecast.estimated_future_waz * 100) / 100
    : null;
  const days = forecast.nominal_horizon_days ?? 30;

  const parts: string[] = [];
  if (estWeight !== null) {
    parts.push(`estimated weight of approximately ${estWeight.toFixed(2)} kg`);
  }
  if (estChange !== null) {
    const sign = estChange > 0 ? '+' : '';
    parts.push(`an estimated change of ${sign}${estChange.toFixed(2)} kg`);
  }
  if (estWaz !== null) {
    const sign = estWaz > 0 ? '+' : '';
    parts.push(`an estimated growth score of ${sign}${estWaz.toFixed(2)}`);
  }

  const summaryText = parts.length > 0
    ? `The 30-day growth forecast suggests an ${parts.join(' with ')} over approximately the next ${days} days based on your baby's recorded trend.`
    : `The 30-day growth forecast is available for approximately the next ${days} days.`;

  return {
    available: true,
    estimatedWeightKg: estWeight,
    estimatedWeightChangeKg: estChange,
    estimatedWaz: estWaz,
    horizonDays: days,
    summaryText,
    differenceText
  };
}

export interface IntegratedGrowthStory {
  isGainingWeight: string;
  whyAiConcerned: string;
  whatMeansForFuture: string;
  whatToDoNext: string;
}

export function buildIntegratedGrowthStory(
  weightAnalysis: WeightHistoryAnalysis,
  wazComparison: WazComparison,
  status: 'elevated' | 'below' | null,
  weightFactors: RecordedFactor[],
  _forecastComparison: ForecastComparison
): IntegratedGrowthStory {
  // Question 1: Is my baby gaining weight?
  let isGainingWeight = '';
  if (!weightAnalysis.hasEnoughData) {
    if (weightAnalysis.latest) {
      isGainingWeight = `Your baby's latest recorded weight was ${weightAnalysis.latest.weightKg.toFixed(2)} kg on ${weightAnalysis.latest.date}. At least two checks are needed to determine weight changes over time.`;
    } else {
      isGainingWeight = 'No recorded weight checks are available yet.';
    }
  } else if (weightAnalysis.changeKg !== null) {
    const prevDate = weightAnalysis.previous?.date;
    const latestDate = weightAnalysis.latest?.date;
    const gainStr = weightAnalysis.changeKg > 0
      ? `gained ${weightAnalysis.changeKg.toFixed(2)} kg`
      : weightAnalysis.changeKg < 0
        ? `lost ${Math.abs(weightAnalysis.changeKg).toFixed(2)} kg`
        : 'maintained their weight';
    const rateStr = weightAnalysis.rateGramsPerDay !== null
      ? ` (${weightAnalysis.rateGramsPerDay > 0 ? '+' : ''}${weightAnalysis.rateGramsPerDay} g/day)`
      : '';

    let wazNote = '';
    if (wazComparison.status === 'lower') {
      wazNote = ` While your baby gained weight, their position relative to age-based growth charts shifted lower.`;
    } else if (wazComparison.status === 'higher') {
      wazNote = ` Their weight gain has also kept pace well with age-based growth charts.`;
    } else if (wazComparison.status === 'steady') {
      wazNote = ` Their weight maintained a steady position on age-based growth charts.`;
    }

    isGainingWeight = `Between ${prevDate} and ${latestDate}, your baby ${gainStr} over ${weightAnalysis.daysBetween} days${rateStr}.${wazNote}`;
  }

  // Question 2: Why is the AI concerned about my baby?
  let whyAiConcerned = '';
  if (status === 'elevated') {
    const factorLabels = weightFactors.map(f => f.label.toLowerCase()).slice(0, 2).join(' and ');
    const factorMention = factorLabels ? ` (including ${factorLabels})` : '';
    whyAiConcerned = `The model identified an elevated early screening score based on recorded growth patterns${factorMention}. These findings highlight statistical patterns for closer monitoring, not medical causes.`;
  } else if (status === 'below') {
    whyAiConcerned = `The model did not trigger an elevated screening alert for your baby. Recorded growth patterns remained below the monitoring threshold.`;
  } else {
    whyAiConcerned = `A confirmed screening result is currently unavailable. Recorded measurements were considered without a confirmed risk flag.`;
  }

  // Question 3: What might this mean for my baby's future growth?
  let whatMeansForFuture = '';
  if (status === 'elevated') {
    whatMeansForFuture = `This is an early monitoring flag suggesting closer growth monitoring over the next 6 months may be helpful. It is not a clinical diagnosis and does not predict future weight decline or medical conditions.`;
  } else if (status === 'below') {
    whatMeansForFuture = `This assessment is reassuring, though ongoing regular growth checks remain important as normal growth varies over time.`;
  } else {
    whatMeansForFuture = `Continue regular growth visits to track your baby's growth journey as more information is recorded.`;
  }

  // Question 4: What should I do next?
  let whatToDoNext = '';
  if (status === 'elevated') {
    whatToDoNext = `Continue regular clinic visits, bring your baby's CHDR booklet, and discuss this screening result with your Public Health Midwife or doctor.`;
  } else {
    whatToDoNext = `Continue regular growth visits with your healthcare provider and bring your baby's CHDR booklet to each visit.`;
  }

  return {
    isGainingWeight,
    whyAiConcerned,
    whatMeansForFuture,
    whatToDoNext
  };
}


