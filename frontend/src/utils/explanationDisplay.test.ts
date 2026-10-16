import { describe, it, expect } from 'vitest';
import {
  getParentFriendlyFeatureName,
  formatRecordedValue,
  getParentFriendlyDescription,
  isLongitudinalFeature,
  HYBRID_MODEL_COVERAGE_DISCLOSURE
} from './explanationDisplay';

describe('explanationDisplay utility', () => {
  describe('getParentFriendlyFeatureName (STEP 2)', () => {
    it('maps key growth monitoring features to parent-friendly labels', () => {
      expect(getParentFriendlyFeatureName('weight_kg')).toBe('Current weight');
      expect(getParentFriendlyFeatureName('length_height_cm')).toBe('Current length / height');
      expect(getParentFriendlyFeatureName('birth_length_cm')).toBe('Length at birth');
      expect(getParentFriendlyFeatureName('birth_weight_kg')).toBe('Birth weight');
      expect(getParentFriendlyFeatureName('days_since_previous_visit')).toBe('Time since previous growth check');
      expect(getParentFriendlyFeatureName('weight_velocity_kg_per_day')).toBe('Average daily weight change');
      expect(getParentFriendlyFeatureName('haz_velocity_per_day')).toBe('Change in length-for-age growth score');
      expect(getParentFriendlyFeatureName('verified_waz')).toBe('Weight-for-age growth score');
      expect(getParentFriendlyFeatureName('verified_haz')).toBe('Length-for-age growth score');
    });

    it('formats categorical prefixed features cleanly', () => {
      expect(getParentFriendlyFeatureName('sex_Female')).toBe('Biological sex: Female');
      expect(getParentFriendlyFeatureName('delivery_type_Vaginal')).toBe('Type of delivery: Vaginal');
    });

    it('falls back gracefully for unknown features', () => {
      expect(getParentFriendlyFeatureName('custom_feature_name')).toBe('Custom Feature Name');
      expect(getParentFriendlyFeatureName('custom_feature', 'Custom Label')).toBe('Custom Label');
    });
  });

  describe('formatRecordedValue (STEP 3)', () => {
    it('formats weight in kilograms rounded to 2 decimals', () => {
      expect(formatRecordedValue('weight_kg', 7.456)).toBe('7.46 kg');
      expect(formatRecordedValue('weight_kg', 8)).toBe('8.00 kg');
      expect(formatRecordedValue('birth_weight_kg', 3.1)).toBe('3.10 kg');
      expect(formatRecordedValue('weight_change_kg', 0.25)).toBe('+0.25 kg');
      expect(formatRecordedValue('weight_change_kg', -0.1)).toBe('-0.10 kg');
    });

    it('formats length and height in centimeters rounded to 1 decimal', () => {
      expect(formatRecordedValue('length_height_cm', 68.34)).toBe('68.3 cm');
      expect(formatRecordedValue('length_height_cm', 70)).toBe('70.0 cm');
      expect(formatRecordedValue('birth_length_cm', 49.52)).toBe('49.5 cm');
      expect(formatRecordedValue('height_change_cm', 1.8)).toBe('+1.8 cm');
    });

    it('formats time between visits and age in whole days', () => {
      expect(formatRecordedValue('days_since_previous_visit', 30.2)).toBe('30 days');
      expect(formatRecordedValue('days_since_previous_visit', 1)).toBe('1 day');
      expect(formatRecordedValue('age_days', 182.4)).toBe('182 days');
    });

    it('formats daily weight change in grams/day rounded sensibly', () => {
      // 0.015 kg/day = 15 g/day
      expect(formatRecordedValue('weight_velocity_kg_per_day', 0.015)).toBe('+15 g/day');
      expect(formatRecordedValue('weight_velocity_kg_per_day', -0.008)).toBe('-8 g/day');
      expect(formatRecordedValue('weight_velocity', 0.1)).toBe('+100 g/day');
    });

    it('formats HAZ/WAZ changes as growth-score change, not centimeters or kilograms', () => {
      const formattedHaz = formatRecordedValue('haz_change', -0.25);
      expect(formattedHaz).toBe('-0.25 growth score change');
      expect(formattedHaz).not.toContain('cm');
      expect(formattedHaz).not.toContain('kg');

      const formattedHazVel = formatRecordedValue('haz_velocity_per_day', 0.02);
      expect(formattedHazVel).toBe('+0.02 growth score change');
      expect(formattedHazVel).not.toContain('cm');

      const formattedWaz = formatRecordedValue('verified_waz', -1.45);
      expect(formattedWaz).toBe('-1.45 (growth score)');
      expect(formattedWaz).not.toContain('kg');
    });

    it('returns "Not recorded" for null, undefined, empty, or NaN without fabricating data', () => {
      expect(formatRecordedValue('weight_kg', null)).toBe('Not recorded');
      expect(formatRecordedValue('weight_kg', undefined)).toBe('Not recorded');
      expect(formatRecordedValue('length_height_cm', '')).toBe('Not recorded');
      expect(formatRecordedValue('verified_waz', NaN)).toBe('Not recorded');
    });

    it('formats boolean indicators properly', () => {
      expect(formatRecordedValue('fever_recent', true)).toBe('Yes');
      expect(formatRecordedValue('diarrhea_recent', false)).toBe('No');
    });
  });

  describe('getParentFriendlyDescription (STEP 4)', () => {
    it('generates non-causal descriptions distinguishing increased vs decreased risk', () => {
      const weightDescInc = getParentFriendlyDescription('weight_kg', 'increased model-predicted risk');
      expect(weightDescInc).toContain("Your child's recorded weight was one of the measurements the AI considered important.");
      expect(weightDescInc).toContain('shifted the predicted risk score higher');
      expect(weightDescInc).not.toMatch(/caused|diagnosis|because your child/i);

      const velocityDescDec = getParentFriendlyDescription('weight_velocity_kg_per_day', 'decreased model-predicted risk');
      expect(velocityDescDec).toContain("The AI considered how your child's weight changed between clinic visits.");
      expect(velocityDescDec).toContain('shifted the predicted risk score lower');
      expect(velocityDescDec).not.toMatch(/caused|diagnosis|because your child/i);

      const ageDesc = getParentFriendlyDescription('age_days', 'increased model-predicted risk');
      expect(ageDesc).toContain("Your child's age influenced the model's assessment.");
      expect(ageDesc).toContain('shifted the predicted risk score higher');
    });

    it('never produces medical diagnostic claims or causal statements', () => {
      const hazDesc = getParentFriendlyDescription('haz_velocity_per_day', 'increased model-predicted risk');
      expect(hazDesc).not.toContain('malnourished');
      expect(hazDesc).not.toContain('stunted');
      expect(hazDesc).not.toContain('disease');
      expect(hazDesc).toContain('length-for-age growth score');
    });
  });

  describe('Longitudinal categorization and model disclosure (STEP 5 & 6)', () => {
    it('correctly identifies longitudinal vs point-in-time features', () => {
      expect(isLongitudinalFeature('weight_velocity_kg_per_day')).toBe(true);
      expect(isLongitudinalFeature('days_since_previous_visit')).toBe(true);
      expect(isLongitudinalFeature('haz_change')).toBe(true);
      expect(isLongitudinalFeature('weight_kg')).toBe(false);
      expect(isLongitudinalFeature('age_days')).toBe(false);
    });

    it('clearly discloses 90% XGBoost + 10% Clean Transformer coverage', () => {
      expect(HYBRID_MODEL_COVERAGE_DISCLOSURE.summary).toContain('90% XGBoost');
      expect(HYBRID_MODEL_COVERAGE_DISCLOSURE.summary).toContain('10% Clean Transformer');
      expect(HYBRID_MODEL_COVERAGE_DISCLOSURE.details).toContain('explain only');
      expect(HYBRID_MODEL_COVERAGE_DISCLOSURE.details).toContain('not calculated');
    });
  });
});
