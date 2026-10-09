import { describe, it, expect } from 'vitest';
import { formatCalendarDate, getWhoStatusFromZScore } from './growthDisplay';

describe('formatCalendarDate', () => {
  it('formats correctly without shifting timezones', () => {
    // 2023-12-31 should always be December 31, 2023
    expect(formatCalendarDate('2023-12-31')).toBe('December 31, 2023');
    expect(formatCalendarDate('2024-01-01')).toBe('January 1, 2024');
  });

  it('handles empty states', () => {
    expect(formatCalendarDate(null)).toBe('Not recorded');
    expect(formatCalendarDate(undefined)).toBe('Not recorded');
    expect(formatCalendarDate('')).toBe('Not recorded');
  });

  it('returns original string if format is weird', () => {
    expect(formatCalendarDate('not-a-date')).toBe('not-a-date');
  });
});

describe('getWhoStatusFromZScore', () => {
  it('returns correct statuses', () => {
    expect(getWhoStatusFromZScore(-3.5)).toBe('Markedly below WHO threshold');
    expect(getWhoStatusFromZScore(-2.5)).toBe('Below WHO threshold');
    expect(getWhoStatusFromZScore(-1.5)).toBe('Within expected WHO threshold');
    expect(getWhoStatusFromZScore(0)).toBe('Within expected WHO threshold');
    expect(getWhoStatusFromZScore(2.5)).toBe('Above WHO threshold');
    expect(getWhoStatusFromZScore(3.5)).toBe('Markedly above WHO threshold');
  });

  it('handles null or undefined safely', () => {
    expect(getWhoStatusFromZScore(null)).toBe('Not available');
    expect(getWhoStatusFromZScore(undefined)).toBe('Not available');
  });
});
