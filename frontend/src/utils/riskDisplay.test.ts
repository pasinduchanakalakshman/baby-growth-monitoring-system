import { describe, it, expect } from 'vitest';
import { 
  RESEARCH_SCREENING_THRESHOLD, 
  getScreeningStatus, 
  formatRiskScore, 
  isScreeningElevated,
  SCREENING_STATUS_ELEVATED,
  SCREENING_STATUS_BELOW
} from './riskDisplay';

describe('riskDisplay utility and research threshold classification', () => {
  it('has locked research screening threshold value of 0.06405469514', () => {
    expect(RESEARCH_SCREENING_THRESHOLD).toBeCloseTo(0.06405469514, 10);
  });

  it('classifies score 0.080 as Elevated screening risk', () => {
    expect(getScreeningStatus(0.080)).toBe(SCREENING_STATUS_ELEVATED);
    expect(isScreeningElevated(0.080)).toBe(true);
  });

  it('classifies score 0.030 as Below screening threshold', () => {
    expect(getScreeningStatus(0.030)).toBe(SCREENING_STATUS_BELOW);
    expect(isScreeningElevated(0.030)).toBe(false);
  });

  it('classifies score exactly equal to threshold as Elevated screening risk', () => {
    expect(getScreeningStatus(RESEARCH_SCREENING_THRESHOLD)).toBe(SCREENING_STATUS_ELEVATED);
    expect(isScreeningElevated(RESEARCH_SCREENING_THRESHOLD)).toBe(true);
  });

  it('handles null and undefined scores safely without throwing', () => {
    expect(getScreeningStatus(null)).toBe('Not available');
    expect(getScreeningStatus(undefined)).toBe('Not available');
    expect(isScreeningElevated(null)).toBe(false);
    expect(isScreeningElevated(undefined)).toBe(false);
  });

  it('formats risk score to 3 decimal places without percentage symbol', () => {
    expect(formatRiskScore(0.12)).toBe('0.120');
    expect(formatRiskScore(0.0640547)).toBe('0.064');
    expect(formatRiskScore(0.0)).toBe('0.000');
    expect(formatRiskScore(null)).toBe('N/A');
    expect(formatRiskScore(undefined)).toBe('N/A');
    // Ensure no "%" is present in output
    expect(formatRiskScore(0.12)).not.toContain('%');
  });

  it('does not label below threshold scores as healthy or zero risk', () => {
    const status = getScreeningStatus(0.030);
    expect(status.toLowerCase()).not.toContain('healthy');
    expect(status.toLowerCase()).not.toContain('no risk');
    expect(status.toLowerCase()).not.toContain('guaranteed');
    expect(status).toBe('Below screening threshold');
  });
});
