import { describe, it, expect } from 'vitest';
import {
  getParentFriendlyFeatureName, formatRecordedValue, isLongitudinalFeature,
  getMotherFriendlyFactors, getRecordedVisitCount, getMatchedScreeningStatus,
  getFactorInfluence, NEUTRAL_FACTOR_INFLUENCE,
} from './explanationDisplay';
import fixtures from '@/test/fixtures/motherExplanationAssessments.json';
import type { RiskExplanation, Risk180Day } from '@/types/growth';

const explanation = () => structuredClone(fixtures.oneVisit.explanation) as RiskExplanation;
const risk = () => structuredClone(fixtures.oneVisit.risk) as Risk180Day;

describe('Recorded measurement presentation', () => {
  it.each([
    ['weight_kg', 'Current weight'], ['length_height_cm', 'Current length or height'],
    ['age_days', 'Age'], ['verified_waz', 'Weight-for-age growth information'],
    ['birth_weight_kg', 'Birth weight'],
  ])('translates %s into ordinary language', (feature, label) => {
    expect(getParentFriendlyFeatureName(feature)).toBe(label);
  });

  it.each([
    ['weight_kg', 7.456, '7.46 kg'], ['birth_weight_kg', 3.1, '3.10 kg'],
    ['weight_change_kg', 0.25, '+0.25 kg'], ['weight_change_kg', -0.1, '-0.10 kg'],
    ['length_height_cm', 68.34, '68.3 cm'], ['height_change_cm', 1.8, '+1.8 cm'],
    ['age_days', 182, '182 days'], ['days_since_previous_visit', 1, '1 day'],
    ['weight_velocity_kg_per_day', 0.015, '+15 g/day'], ['weight_velocity_kg_per_day', -0.008, '-8 g/day'],
    ['fever_recent', true, 'Yes'], ['diarrhea_recent', false, 'No'],
    ['haz_change', -0.25, '-0.25 growth score change'],
  ])('preserves measurement units: %s %s', (feature, value, expected) => {
    expect(formatRecordedValue(feature as string, value)).toBe(expected);
  });

  it.each([null, undefined, '', NaN, Infinity, -Infinity])('never formats missing or nonfinite values as measurements: %s', value => {
    expect(formatRecordedValue('weight_kg', value)).toBe('Not recorded');
  });

  it('retains rank, direction, and API order while choosing at most four recorded factors', () => {
    const data = explanation();
    const before = structuredClone(data);
    const { measurements } = getMotherFriendlyFactors(data);
    expect(measurements.length).toBeLessThanOrEqual(4);
    for (const factor of measurements) {
      const original = data.frontend_safe_explanation.find(f => f.feature === factor.feature)!;
      expect(factor.importance_rank).toBe(original.importance_rank);
      expect(factor.direction).toBe(original.direction);
    }
    expect(measurements.map(f => data.frontend_safe_explanation.findIndex(original => original.feature === f.feature)))
      .toEqual(measurements.map(f => data.frontend_safe_explanation.findIndex(original => original.feature === f.feature)).sort((a, b) => a-b));
    expect(data).toEqual(before);
  });

  it.each([null, undefined, NaN, Infinity, '4.2', 'not recorded', true])('omits invalid physical raw values without using transformed imputations: %s', raw => {
    const data = explanation();
    data.frontend_safe_explanation = [{ feature: 'weight_kg', display_label: 'Weight', direction: 'increased', importance_rank: 1 }];
    data.technical_explanation.contributions = [{ feature: 'weight_kg', raw_value: raw as number, transformed_value: 1.5, shap_contribution: 0.9 }];
    expect(getMotherFriendlyFactors(data).measurements).toEqual([]);
  });

  it('does not expose unknown feature labels or numeric growth scores', () => {
    const data = explanation();
    data.frontend_safe_explanation = [
      { feature: 'verified_waz', display_label: 'WAZ SHAP', direction: 'increased', importance_rank: 1 },
      { feature: 'internal_transformer_score', display_label: 'Transformer', direction: 'increased', importance_rank: 1 },
    ];
    const factors = getMotherFriendlyFactors(data).measurements;
    expect(factors).toHaveLength(1);
    expect(factors[0].label).toBe('Weight-for-age growth information');
    expect(factors[0].recordedValue).toBe('Recorded for this growth check');
  });

  it('recognizes longitudinal inputs without using them to invent historical measurements', () => {
    expect(isLongitudinalFeature('weight_velocity_kg_per_day')).toBe(true);
    expect(isLongitudinalFeature('days_since_previous_visit')).toBe(true);
    expect(isLongitudinalFeature('weight_kg')).toBe(false);
    expect(getMotherFriendlyFactors(explanation()).changes).toEqual([]);
  });

  it.each([-1, 1.5, NaN, undefined, '2'])('does not infer a visit count from invalid metadata: %s', count => {
    const data = explanation();
    data.assessment!.recorded_visit_count = count as number;
    expect(getRecordedVisitCount(data)).toBeNull();
  });
});

describe('Existing screening decision matching', () => {
  it('accepts real backend elevated and below-threshold pairs without reclassifying scores', () => {
    expect(getMatchedScreeningStatus(explanation(), risk())).toBe('elevated');
    expect(getMatchedScreeningStatus(fixtures.twoVisits.explanation as RiskExplanation, fixtures.twoVisits.risk)).toBe('below');
  });

  it('rejects a different assessment or unavailable response', () => {
    expect(getMatchedScreeningStatus(explanation(), fixtures.twoVisits.risk)).toBeNull();
    expect(getMatchedScreeningStatus(explanation(), null)).toBeNull();
  });

  it('rejects mismatched branch scores even when the combined score is identical', () => {
    const value = risk();
    const combo = value.model_combination!;
    combo.xgboost_score += 0.001;
    combo.transformer_score -= 0.009;
    combo.xgboost_weighted_contribution = 0.9 * combo.xgboost_score;
    combo.transformer_weighted_contribution = 0.1 * combo.transformer_score;
    expect(getMatchedScreeningStatus(explanation(), value)).toBeNull();
  });

  it('does not guess from a numeric score if backend status or flag is missing', () => {
    const value = risk();
    delete value.screening_status;
    expect(getMatchedScreeningStatus(explanation(), value)).toBeNull();
    value.screening_status = 'Elevated screening risk';
    delete value.risk_flag;
    expect(getMatchedScreeningStatus(explanation(), value)).toBeNull();
  });

  it.each([undefined, 30, 365])('does not attach the 180-day summary to a missing or different horizon: %s', horizon => {
    const value = risk();
    value.prediction_horizon_days = horizon;
    expect(getMatchedScreeningStatus(explanation(), value)).toBeNull();
  });
});

describe('Cautious factor influence', () => {
  const factor = { feature: 'weight_kg', display_label: 'Current weight', direction: 'increased model-predicted risk', importance_rank: 1 };
  it('uses documented directions and signed attributions, independently of the recorded value', () => {
    const data = explanation();
    expect(getFactorInfluence(data, factor, 0.1)).toContain('increased the screening score in the explained part');
    expect(getFactorInfluence(data, { ...factor, direction: 'decreased model-predicted risk' }, -0.1)).toContain('decreased the screening score in the explained part');
    data.technical_explanation.contributions.find(c => c.feature === 'weight_kg')!.raw_value = 999;
    expect(getFactorInfluence(data, { ...factor, direction: 'decreased model-predicted risk' }, -0.1)).toContain('decreased');
  });
  it.each([undefined, NaN, Infinity, 0, -0.1])('falls back safely for an absent, invalid, zero, or contradicting attribution: %s', contribution => {
    expect(getFactorInfluence(explanation(), factor, contribution)).toBe(NEUTRAL_FACTOR_INFLUENCE);
  });
  it.each(['unknown', 'increase', 'neutral', 'decreased model-predicted risk'])('does not guess from an ambiguous or contradictory direction: %s', direction => {
    expect(getFactorInfluence(explanation(), { ...factor, direction }, 0.1)).toBe(NEUTRAL_FACTOR_INFLUENCE);
  });
  it('requires documented attribution scope and never invents its own explanation', () => {
    const data = explanation();
    delete data.explanation_scope;
    expect(getFactorInfluence(data, factor, 0.1)).toBe(NEUTRAL_FACTOR_INFLUENCE);
  });
});
