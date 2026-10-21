import { describe, it, expect } from 'vitest';
import type { GrowthHistoryPoint } from '@/types/growth';
import reference from './data/who-percentiles.json';
import { agePlotData, birthMeasurement, recordedAgeDays, validWhoRows, whoReference } from './detailedGrowthData';

const visit: GrowthHistoryPoint = {
  id: 1, baby_id: 1, visit_date: '2024-03-01', age_days: 61, weight_kg: 4.56789,
  length_height_cm: null, verified_waz: 0, verified_haz: null,
};

describe('saved birth measurements', () => {
  const profile = { id: 1, sex: 'Female' as const, date_of_birth: '2024-01-01', birth_weight_kg: 3.21, birth_length_cm: 49.5 };

  it('reads exact weight and length from the matching profile without creating visits', () => {
    const history = Object.freeze([Object.freeze({ ...visit })]);
    expect(birthMeasurement('weight', profile, history as unknown as GrowthHistoryPoint[])).toEqual({ date: '2024-01-01', value: 3.21, label: 'Birth weight' });
    expect(birthMeasurement('height', profile, history as unknown as GrowthHistoryPoint[])).toEqual({ date: '2024-01-01', value: 49.5, label: 'Birth length' });
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(visit);
  });

  it.each([undefined, null, 0, -1, NaN, Infinity])('does not invent missing or invalid birth values: %s', value => {
    if (value !== null) expect(birthMeasurement('weight', { ...profile, birth_weight_kg: value }, [visit])).toBeNull();
    expect(birthMeasurement('height', { ...profile, birth_length_cm: value }, [visit])).toBeNull();
  });

  it('requires a valid birth date and matching child, and never derives birth z-scores', () => {
    expect(birthMeasurement('weight', undefined, [visit])).toBeNull();
    expect(birthMeasurement('weight', { ...profile, date_of_birth: '2024-02-30' }, [visit])).toBeNull();
    expect(birthMeasurement('weight', { ...profile, id: 2 }, [visit])).toBeNull();
    expect(birthMeasurement('waz', profile, [visit])).toBeNull();
    expect(birthMeasurement('haz', profile, [visit])).toBeNull();
  });
});

describe('WHO chart reference data', () => {
  it.each(reference.datasets)('has complete ordered published daily values for $metric $sex', dataset => {
    expect(validWhoRows(dataset.rows)).toBe(true);
    expect(dataset.source_url).toMatch(/^https:\/\/cdn\.who\.int\//);
    expect(dataset.source_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(dataset.rows[0][0]).toBe(0);
    expect(dataset.rows.at(-1)?.[0]).toBe(1856);
  });

  it('selects the correct sex and indicator without computing new percentiles', () => {
    expect(whoReference('weight', 'Male')?.segments[0][0]).toMatchObject({ p3: 2.507, p50: 3.346, p97: 4.35 });
    expect(whoReference('weight', 'Female')?.segments[0][0]).toMatchObject({ p3: 2.44, p50: 3.232, p97: 4.166 });
    expect(whoReference('height', 'Male')?.segments[0][0].p50).toBe(49.884);
    expect(whoReference('height', 'Female')?.segments[0][0].p50).toBe(49.148);
    for (const sex of [undefined, null, '', 'unknown', 'male']) expect(whoReference('weight', sex)).toBeNull();
    expect(whoReference('waz', 'Male')).toBeNull();
    expect(whoReference('haz', 'Female')).toBeNull();
  });

  it.each(['Male', 'Female'])('keeps the two-year length/height discontinuity for %s', sex => {
    const curves = whoReference('height', sex)!;
    expect(curves.segments.map(segment => segment.length)).toEqual([731, 1126]);
    expect(curves.segments[0].at(-1)?.ageMonths).toBe(730 / 30.4375);
    expect(curves.segments[1][0].ageMonths).toBe(731 / 30.4375);
    expect(curves.segments[0].at(-1)!.p50).toBeGreaterThan(curves.segments[1][0].p50);
  });

  it('rejects incomplete, corrupt or unordered reference rows', () => {
    const rows = reference.datasets[0].rows;
    expect(validWhoRows(rows.slice(1))).toBe(false);
    for (const first of [[1, ...rows[0].slice(1)], [0, 5, 4, 3, 2, 1], [0, 1, 2, 3, 4, NaN], [0, 1, 2, 3, 4, Infinity]]) {
      expect(validWhoRows([first, ...rows.slice(1)])).toBe(false);
    }
  });
});

describe('exact recorded chart ages and measurement preservation', () => {
  it('uses API age_days even when a date-derived age differs', () => {
    expect(recordedAgeDays(visit, '2020-01-01')).toBe(61);
    const data = agePlotData([Object.freeze(visit)], '2020-01-01');
    expect(data).toHaveLength(1);
    expect(data[0].ageMonths).toBe(61 / 30.4375);
    expect(data[0]).toMatchObject({ ...visit, verified_waz: 0, length_height_cm: null, verified_haz: null });
    expect(visit).not.toHaveProperty('ageMonths');
  });

  it('uses the existing calendar-day pipeline when API age is missing, including leap days', () => {
    expect(recordedAgeDays({ ...visit, age_days: null }, '2024-01-01')).toBe(60);
    expect(recordedAgeDays({ ...visit, age_days: undefined }, '2024-02-28')).toBe(2);
    expect(recordedAgeDays({ ...visit, age_days: 0 }, '2024-01-01')).toBe(0);
  });

  it('does not invent ages or interpolate measurements', () => {
    expect(recordedAgeDays({ ...visit, age_days: null })).toBeNull();
    expect(recordedAgeDays({ ...visit, age_days: -1 }, '2025-01-01')).toBeNull();
    expect(recordedAgeDays({ ...visit, visit_date: '2024-02-30' }, '2024-01-01')).toBeNull();
    const history = [visit, { ...visit, id: 2, visit_date: '2024-05-01', age_days: 122 }];
    expect(agePlotData(history)).toHaveLength(2);
    expect(agePlotData(history).map(point => point.visit_date)).toEqual(history.map(point => point.visit_date));
  });
});
