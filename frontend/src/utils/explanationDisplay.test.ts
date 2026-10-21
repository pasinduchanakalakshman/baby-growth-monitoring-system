import { describe, it, expect } from 'vitest';
import {
  getParentFriendlyFeatureName, formatRecordedValue, isLongitudinalFeature,
  getMotherFriendlyFactors, getRecordedVisitCount, getMatchedScreeningStatus,
  getFactorInfluence, NEUTRAL_FACTOR_INFLUENCE, getPersonalizedDescription,
  analyzeWeightHistory, getWeightRelatedFactors, analyzeWazComparison,
  analyzeForecastComparison, buildIntegratedGrowthStory
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

describe('Personalized factor description', () => {
  const baseFactor = {
    feature: 'weight_kg',
    display_label: 'Current weight',
    direction: 'increased model-predicted risk',
    importance_rank: 1
  };

  it('formats increasing weight description with child measurement when status is confirmed', () => {
    const desc = getPersonalizedDescription(
      baseFactor,
      '4.25 kg',
      'This information increased the screening score in the explained part of the assessment.',
      'elevated'
    );
    expect(desc).toBe("Your baby's current recorded weight of 4.25 kg was evaluated by the screening model, shifting the screening score higher in this assessment.");
  });

  it('formats decreasing length description with child measurement when status is confirmed', () => {
    const desc = getPersonalizedDescription(
      { ...baseFactor, feature: 'length_height_cm', direction: 'decreased model-predicted risk' },
      '54.3 cm',
      'This information decreased the screening score in the explained part of the assessment.',
      'below'
    );
    expect(desc).toBe("Your baby's current recorded length/height of 54.3 cm was evaluated by the screening model, shifting the screening score lower in this assessment.");
  });

  it('formats neutral description when screening status is unconfirmed or unavailable', () => {
    const desc = getPersonalizedDescription(
      baseFactor,
      '3.30 kg',
      NEUTRAL_FACTOR_INFLUENCE,
      null
    );
    expect(desc).toBe("Your baby's current recorded weight of 3.30 kg was evaluated as part of this growth check.");
  });

  it('formats multi-visit change descriptions accurately', () => {
    const desc = getPersonalizedDescription(
      { feature: 'height_change_cm', display_label: 'Change in length / height', direction: 'decreased model-predicted risk', importance_rank: 2 },
      '+4.0 cm',
      'This information decreased the screening score in the explained part of the assessment.',
      'below'
    );
    expect(desc).toBe("A recorded length/height change of +4.0 cm between checks was evaluated by the model, shifting the screening score lower in this assessment.");
  });
});

describe('Weight history analysis for parent explanations', () => {
  it('correctly reports when no weight checks are available', () => {
    const result = analyzeWeightHistory([], null);
    expect(result.hasEnoughData).toBe(false);
    expect(result.totalVisits).toBe(0);
    expect(result.latest).toBeNull();
    expect(result.previous).toBeNull();
    expect(result.changeKg).toBeNull();
    expect(result.summaryText).toContain('No weight checks recorded yet');
  });

  it('correctly handles a single recorded visit and explains that changes cannot yet be determined', () => {
    const history = [{ visit_date: '2023-01-01', weight_kg: 3.3 }];
    const result = analyzeWeightHistory(history, null);
    expect(result.hasEnoughData).toBe(false);
    expect(result.totalVisits).toBe(1);
    expect(result.latest).toEqual({ date: '2023-01-01', weightKg: 3.3 });
    expect(result.previous).toBeNull();
    expect(result.changeKg).toBeNull();
    expect(result.daysBetween).toBeNull();
    expect(result.rateGramsPerDay).toBeNull();
    expect(result.summaryText).toContain('At least two recorded measurements are needed to determine weight changes over time');
    expect(result.summaryText).toContain('3.30 kg on 2023-01-01');
  });

  it('correctly analyzes increasing weight history across two checks', () => {
    const history = [
      { visit_date: '2023-01-01', weight_kg: 3.3 },
      { visit_date: '2023-01-31', weight_kg: 4.2 }
    ];
    const result = analyzeWeightHistory(history, null);
    expect(result.hasEnoughData).toBe(true);
    expect(result.totalVisits).toBe(2);
    expect(result.previous).toEqual({ date: '2023-01-01', weightKg: 3.3 });
    expect(result.latest).toEqual({ date: '2023-01-31', weightKg: 4.2 });
    expect(result.changeKg).toBe(0.9);
    expect(result.daysBetween).toBe(30);
    expect(result.rateGramsPerDay).toBe(30);
    expect(result.summaryText).toContain('gained 0.90 kg over 30 days');
    expect(result.summaryText).toContain('+30 g/day');
  });

  it('correctly analyzes decreasing weight history across two checks', () => {
    const history = [
      { visit_date: '2023-01-01', weight_kg: 4.5 },
      { visit_date: '2023-01-31', weight_kg: 4.2 }
    ];
    const result = analyzeWeightHistory(history, null);
    expect(result.hasEnoughData).toBe(true);
    expect(result.totalVisits).toBe(2);
    expect(result.changeKg).toBe(-0.3);
    expect(result.daysBetween).toBe(30);
    expect(result.rateGramsPerDay).toBe(-10);
    expect(result.summaryText).toContain('lost 0.30 kg over 30 days');
    expect(result.summaryText).toContain('-10 g/day');
  });

  it('sorts points chronologically and compares the most recent two visits', () => {
    const history = [
      { visit_date: '2023-03-02', weight_kg: 5.1 },
      { visit_date: '2023-01-01', weight_kg: 3.3 },
      { visit_date: '2023-01-31', weight_kg: 4.2 }
    ];
    const result = analyzeWeightHistory(history, null);
    expect(result.hasEnoughData).toBe(true);
    expect(result.totalVisits).toBe(3);
    expect(result.previous?.date).toBe('2023-01-31');
    expect(result.latest?.date).toBe('2023-03-02');
    expect(result.changeKg).toBe(0.9);
    expect(result.points.map(p => p.date)).toEqual(['2023-01-01', '2023-01-31', '2023-03-02']);
  });

  it('ignores invalid, missing, zero or negative weight values', () => {
    const history = [
      { visit_date: '2023-01-01', weight_kg: 3.3 },
      { visit_date: '2023-01-15', weight_kg: null },
      { visit_date: '2023-01-20', weight_kg: -2 },
      { visit_date: '2023-01-25', weight_kg: 0 },
      { visit_date: '', weight_kg: 4.0 },
    ];
    const result = analyzeWeightHistory(history, null);
    expect(result.hasEnoughData).toBe(false);
    expect(result.totalVisits).toBe(1);
    expect(result.points).toHaveLength(1);
  });
});

describe('Weight-related XAI factor extraction', () => {
  it('extracts only weight-related features from explanation', () => {
    const data = explanation();
    data.frontend_safe_explanation = [
      { feature: 'weight_kg', display_label: 'Current weight', direction: 'increased model-predicted risk', importance_rank: 1 },
      { feature: 'length_height_cm', display_label: 'Length', direction: 'decreased model-predicted risk', importance_rank: 2 },
      { feature: 'verified_waz', display_label: 'WAZ', direction: 'decreased model-predicted risk', importance_rank: 3 },
      { feature: 'diarrhea_recent', display_label: 'Diarrhea', direction: 'increased model-predicted risk', importance_rank: 4 },
    ];
    data.technical_explanation.contributions = [
      { feature: 'weight_kg', raw_value: 3.3, transformed_value: 1, shap_contribution: 0.2 },
      { feature: 'length_height_cm', raw_value: 50.0, transformed_value: 1, shap_contribution: -0.3 },
      { feature: 'verified_waz', raw_value: -0.1, transformed_value: 1, shap_contribution: -0.2 },
      { feature: 'diarrhea_recent', raw_value: true, transformed_value: 1, shap_contribution: 0.1 },
    ];
    const factors = getWeightRelatedFactors(data, 'elevated');
    expect(factors.map(f => f.feature)).toEqual(['weight_kg', 'verified_waz']);
  });

  it('returns empty array when no weight-related factors are present', () => {
    const data = explanation();
    data.frontend_safe_explanation = [
      { feature: 'length_height_cm', display_label: 'Length', direction: 'decreased model-predicted risk', importance_rank: 1 },
      { feature: 'diarrhea_recent', display_label: 'Diarrhea', direction: 'increased model-predicted risk', importance_rank: 2 },
    ];
    data.technical_explanation.contributions = [
      { feature: 'length_height_cm', raw_value: 50.0, transformed_value: 1, shap_contribution: -0.3 },
      { feature: 'diarrhea_recent', raw_value: true, transformed_value: 1, shap_contribution: 0.1 },
    ];
    const factors = getWeightRelatedFactors(data, 'elevated');
    expect(factors).toEqual([]);
  });
});

describe('WAZ growth position comparison', () => {
  it('correctly detects a lower shift in WAZ across visits and warns not to confuse with weight gain', () => {
    const history = [
      { id: 1, baby_id: 1, visit_date: '2023-01-01', weight_kg: 3.3, verified_waz: -0.1 },
      { id: 2, baby_id: 1, visit_date: '2023-01-31', weight_kg: 4.2, verified_waz: -0.46 },
    ];
    const result = analyzeWazComparison(history, null);
    expect(result.hasEnoughData).toBe(true);
    expect(result.status).toBe('lower');
    expect(result.previousWaz).toBe(-0.1);
    expect(result.latestWaz).toBe(-0.46);
    expect(result.wazChange).toBe(-0.36);
    expect(result.summaryText).toContain('shifted lower');
    expect(result.summaryText).toContain('-0.10 to -0.46');
    expect(result.cautionText).toContain('Gaining weight does not necessarily mean a baby’s weight-for-age position has improved');
  });

  it('correctly detects an improved WAZ position across visits', () => {
    const history = [
      { id: 1, baby_id: 1, visit_date: '2023-01-01', weight_kg: 3.0, verified_waz: -1.2 },
      { id: 2, baby_id: 1, visit_date: '2023-01-31', weight_kg: 4.3, verified_waz: -0.8 },
    ];
    const result = analyzeWazComparison(history, null);
    expect(result.hasEnoughData).toBe(true);
    expect(result.status).toBe('higher');
    expect(result.wazChange).toBe(0.4);
    expect(result.summaryText).toContain('moved higher');
  });

  it('correctly detects a steady WAZ position across visits', () => {
    const history = [
      { id: 1, baby_id: 1, visit_date: '2023-01-01', weight_kg: 3.3, verified_waz: -0.1 },
      { id: 2, baby_id: 1, visit_date: '2023-01-31', weight_kg: 4.2, verified_waz: -0.12 },
    ];
    const result = analyzeWazComparison(history, null);
    expect(result.hasEnoughData).toBe(true);
    expect(result.status).toBe('steady');
    expect(result.summaryText).toContain('maintained a steady position');
  });

  it('handles a single check and indicates that two checks are needed', () => {
    const history = [
      { id: 1, baby_id: 1, visit_date: '2023-01-01', weight_kg: 3.3, verified_waz: -0.1 },
    ];
    const result = analyzeWazComparison(history, null);
    expect(result.hasEnoughData).toBe(false);
    expect(result.status).toBe('single_check');
    expect(result.latestWaz).toBe(-0.1);
    expect(result.summaryText).toContain('At least two recorded checks are needed');
  });

  it('handles empty history and falls back to explanation data if present', () => {
    const data = explanation();
    data.technical_explanation.contributions = [
      { feature: 'verified_waz', raw_value: -0.095, transformed_value: 0, shap_contribution: -0.65 },
    ];
    const result = analyzeWazComparison([], data);
    expect(result.hasEnoughData).toBe(false);
    expect(result.latestWaz).toBe(-0.09);
  });
});

describe('30-day growth forecast comparison', () => {
  it('formats available 30-day forecast with estimated weight and difference from 180-day screening', () => {
    const forecast = {
      forecast_available: true,
      estimated_future_weight_kg: 4.5,
      estimated_weight_change_kg: 0.3,
      estimated_future_waz: -0.4,
      nominal_horizon_days: 30,
    };
    const result = analyzeForecastComparison(forecast);
    expect(result.available).toBe(true);
    expect(result.estimatedWeightKg).toBe(4.5);
    expect(result.estimatedWeightChangeKg).toBe(0.3);
    expect(result.summaryText).toContain('approximately 4.50 kg');
    expect(result.summaryText).toContain('+0.30 kg');
    expect(result.differenceText).toContain('Distinguishing Forecast from Screening');
    expect(result.differenceText).toContain('predictive estimates and do not represent actual observed measurements');
  });

  it('handles unavailable 30-day forecast safely', () => {
    const result = analyzeForecastComparison(null);
    expect(result.available).toBe(false);
    expect(result.summaryText).toContain('A 30-day growth forecast is not available yet');
    expect(result.differenceText).toContain('Both are predictive estimates');
  });
});

describe('Integrated Growth Story generation (4 key questions)', () => {
  it('answers all 4 questions dynamically for a multi-visit baby with below-threshold screening', () => {
    const history = [
      { visit_date: '2023-01-01', weight_kg: 3.3, verified_waz: -0.1 },
      { visit_date: '2023-01-31', weight_kg: 4.2, verified_waz: -0.46 },
    ];
    const weightAnalysis = analyzeWeightHistory(history, null);
    const wazComparison = analyzeWazComparison(history as any, null);
    const forecast = analyzeForecastComparison(null);
    const story = buildIntegratedGrowthStory(
      weightAnalysis,
      wazComparison,
      'below',
      [{ feature: 'weight_kg', label: 'Current weight', display_label: 'Current weight', direction: 'increased', importance_rank: 1, recordedValue: '4.20 kg', influence: '', description: '' }],
      forecast
    );

    expect(story.isGainingWeight).toContain('gained 0.90 kg over 30 days');
    expect(story.isGainingWeight).toContain('position relative to age-based growth charts shifted lower');
    expect(story.whyAiConcerned).toContain('did not trigger an elevated screening alert');
    expect(story.whatMeansForFuture).toContain('reassuring');
    expect(story.whatToDoNext).toContain('Continue regular growth visits');
  });

  it('answers all 4 questions for an elevated screening single-visit baby', () => {
    const history = [
      { visit_date: '2023-01-01', weight_kg: 3.3, verified_waz: -0.1 },
    ];
    const weightAnalysis = analyzeWeightHistory(history, null);
    const wazComparison = analyzeWazComparison(history as any, null);
    const forecast = analyzeForecastComparison(null);
    const story = buildIntegratedGrowthStory(
      weightAnalysis,
      wazComparison,
      'elevated',
      [{ feature: 'weight_kg', label: 'Current weight', display_label: 'Current weight', direction: 'increased', importance_rank: 1, recordedValue: '3.30 kg', influence: '', description: '' }],
      forecast
    );

    expect(story.isGainingWeight).toContain('3.30 kg on 2023-01-01');
    expect(story.whyAiConcerned).toContain('elevated early screening score');
    expect(story.whyAiConcerned).toContain('statistical patterns for closer monitoring, not medical causes');
    expect(story.whatMeansForFuture).toContain('closer growth monitoring over the next 6 months');
    expect(story.whatToDoNext).toContain('discuss this screening result with your Public Health Midwife or doctor');
  });
});



