import { describe, expect, it } from 'vitest';
import type { GrowthHistoryPoint } from '@/types/growth';
import {
  localCalendarDate, validateMeasurement, validateMeasurementField,
  type MeasurementField, type MeasurementFormData,
} from './measurementValidation';

const valid: MeasurementFormData = {
  visit_date: '2024-06-01', weight_kg: '4.5', length_height_cm: '',
  currently_breastfeeding: undefined, formula_feeding: undefined, solid_foods_started: undefined,
  diarrhea_last_14_days: undefined, fever_last_14_days: undefined, cough_last_14_days: undefined,
};
const context = { today: '2026-10-21', dateOfBirth: '2023-01-01', babyId: 1 };
const record: GrowthHistoryPoint = { id: 10, baby_id: 1, visit_date: valid.visit_date, weight_kg: 4.5 };

describe('measurement date validation', () => {
  it.each([
    ['', 'Please select a visit date.'],
    ['2024-02-30', 'Please select a valid visit date.'],
    ['2023-02-29', 'Please select a valid visit date.'],
    ['2024-04-31', 'Please select a valid visit date.'],
    ['2024-13-01', 'Please select a valid visit date.'],
    ['2024-01-00', 'Please select a valid visit date.'],
    ['0000-01-01', 'Please select a valid visit date.'],
    ['2024-6-1', 'Please select a valid visit date.'],
    ['not-a-date', 'Please select a valid visit date.'],
    ['2026-10-22', 'Visit date cannot be in the future.'],
    ['2022-12-31', "Visit date cannot be before your baby's date of birth."],
  ])('rejects %j with the appropriate message', (visit_date, message) => {
    expect(validateMeasurementField('visit_date', { ...valid, visit_date }, context)).toBe(message);
  });

  it.each(['2023-01-01', '2024-02-29', '2026-10-21'])('allows DOB, leap day and today: %s', visit_date => {
    expect(validateMeasurementField('visit_date', { ...valid, visit_date }, context)).toBe('');
  });

  it('rejects a confirmed duplicate for this child', () => {
    expect(validateMeasurementField('visit_date', valid, { ...context, history: [record] }))
      .toBe('A measurement already exists for this date.');
  });

  it('allows nonduplicate historical dates, absent history and records belonging to another child', () => {
    for (const history of [undefined, [], [{ ...record, visit_date: '2025-01-01' }], [{ ...record, baby_id: 2 }]]) {
      expect(validateMeasurementField('visit_date', valid, { ...context, history })).toBe('');
    }
    expect(validateMeasurementField('visit_date', valid, { ...context, babyId: undefined, history: [record] })).toBe('');
  });

  it('uses the local calendar day rather than the UTC day', () => {
    expect(localCalendarDate(new Date(2026, 9, 21, 0, 15))).toBe('2026-10-21');
    expect(localCalendarDate(new Date(2026, 0, 2, 23, 45))).toBe('2026-01-02');
  });
});

describe('measurement numeric validation', () => {
  it.each(['', '   '])('requires weight: %j', weight_kg => {
    expect(validateMeasurementField('weight_kg', { ...valid, weight_kg })).toBe("Please enter your baby's weight.");
  });

  it.each(['0', '-2', '0.4999', '40.0001', '40.5', 'NaN', 'Infinity', '-Infinity', '1e309', 'abc', '4.5kg', '0x10'])
    ('rejects invalid weight %s without exposing limits', weight_kg => {
      expect(validateMeasurementField('weight_kg', { ...valid, weight_kg })).toBe('Please enter a valid weight.');
    });

  it.each(['0.5', '40', '4.5', '4.56789', '4.50', '4.5e0'])('allows weight %s without changing the text', weight_kg => {
    const data = { ...valid, weight_kg };
    expect(validateMeasurementField('weight_kg', data)).toBe('');
    expect(data.weight_kg).toBe(weight_kg);
  });

  it.each(['0', '-10', '29.9999', '130.0001', '150', 'NaN', 'Infinity', '-Infinity', '1e309', 'abc', '65cm', '0x40'])
    ('rejects invalid length/height %s', length_height_cm => {
      expect(validateMeasurementField('length_height_cm', { ...valid, length_height_cm }))
        .toBe('Please enter a valid length or height.');
    });

  it.each(['', '30', '130', '65.5', '65.56789'])('allows optional length/height %j', length_height_cm => {
    expect(validateMeasurementField('length_height_cm', { ...valid, length_height_cm })).toBe('');
  });

  it.each([
    ['visit_date', 'Please select a valid visit date.'],
    ['weight_kg', 'Please enter a valid weight.'],
    ['length_height_cm', 'Please enter a valid length or height.'],
  ] as const)('rejects browser badInput even when %s is sanitized to empty', (field, message) => {
    expect(validateMeasurementField(field, { ...valid, [field]: '' }, { badInput: { [field]: true } })).toBe(message);
  });
});

describe('optional questions and whole-form validation', () => {
  const fields: MeasurementField[] = [
    'currently_breastfeeding', 'formula_feeding', 'solid_foods_started',
    'diarrhea_last_14_days', 'fever_last_14_days', 'cough_last_14_days',
  ];

  it.each(fields)('allows only unanswered, Yes or No for %s', field => {
    for (const value of [undefined, true, false]) {
      expect(validateMeasurementField(field, { ...valid, [field]: value })).toBe('');
    }
    for (const value of ['yes', 'false', 'unknown', 0, 1]) {
      const data = { ...valid, [field]: value } as MeasurementFormData;
      expect(validateMeasurementField(field, data)).toBe('Please select Yes or No.');
    }
  });

  it('validates required fields together and accepts an otherwise valid form with unanswered options', () => {
    expect(validateMeasurement({ ...valid, visit_date: '', weight_kg: '' }, context)).toEqual({
      visit_date: 'Please select a visit date.', weight_kg: "Please enter your baby's weight.",
    });
    expect(validateMeasurement(valid, context)).toEqual({});
  });
});
