import { describe, expect, it } from 'vitest';
import { createNewbornWeightJourney } from './newbornWeightJourney';

describe('newborn educational weight journey', () => {
  it.each([2.8, 3.2, 3.8, 1.5, 4.5])('preserves milestones and direction for %s kg', birth => {
    const points = createNewbornWeightJourney(birth);
    expect(points).toHaveLength(31);
    expect(points[0].illustrativeWeightKg).toBe(birth);
    expect(points[3].illustrativeWeightKg).toBeCloseTo(birth * 0.95);
    expect(points[12].illustrativeWeightKg).toBe(birth);
    expect(points[30].illustrativeWeightKg).toBeCloseTo(birth + 0.45);
    points.forEach((p, day) => {
      expect(p.day).toBe(day);
      expect(Number.isFinite(p.illustrativeWeightKg)).toBe(true);
      expect(p.illustrativeWeightKg).toBeGreaterThan(0);
      if (day > 0 && day <= 3) expect(p.illustrativeWeightKg).toBeLessThan(points[day - 1].illustrativeWeightKg);
      if (day > 3) expect(p.illustrativeWeightKg).toBeGreaterThan(points[day - 1].illustrativeWeightKg);
    });
    expect(createNewbornWeightJourney(birth)).toEqual(points);
    expect(points.map(p => p.phase)).toEqual(expect.arrayContaining(['Birth', 'Initial weight loss', 'Recovery', 'Continued growth']));
  });
  it.each([undefined, null, 0, -1, NaN, Infinity, -Infinity, '3.2', Number.MIN_VALUE])('safely rejects invalid input %s', value => {
    expect(createNewbornWeightJourney(value)).toEqual([]);
  });
});
