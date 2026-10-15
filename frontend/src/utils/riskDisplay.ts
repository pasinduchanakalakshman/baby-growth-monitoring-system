/**
 * Utility functions for displaying research risk scores and screening statuses.
 * 
 * IMPORTANT:
 * - The 180-day growth-faltering risk score is an experimental AI screening score, not a clinical probability or medical diagnosis.
 * - The research screening threshold (0.06405469514) is locked from research validation policy.
 * - Scores below threshold must NOT be labeled as "healthy", "guaranteed low risk", or "no risk detected".
 */

export const RESEARCH_SCREENING_THRESHOLD = 0.06405469514;

export const SCREENING_STATUS_ELEVATED = 'Elevated screening risk';
export const SCREENING_STATUS_BELOW = 'Below screening threshold';

export const RISK_DISCLAIMER_TEXT = 'This is an experimental AI screening score, not a medical diagnosis or an exact probability.';

/**
 * Returns formatted risk score string, e.g. "0.120"
 */
export function formatRiskScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'N/A';
  return Number(score).toFixed(3);
}

/**
 * Classifies a hybrid risk score against the research screening threshold.
 * Score >= threshold -> "Elevated screening risk"
 * Score < threshold -> "Below screening threshold"
 */
export function getScreeningStatus(
  score: number | null | undefined,
  threshold: number = RESEARCH_SCREENING_THRESHOLD
): string {
  if (score === null || score === undefined) return 'Not available';
  return score >= threshold ? SCREENING_STATUS_ELEVATED : SCREENING_STATUS_BELOW;
}

/**
 * Returns whether a score is elevated against the threshold.
 */
export function isScreeningElevated(
  score: number | null | undefined,
  threshold: number = RESEARCH_SCREENING_THRESHOLD
): boolean {
  if (score === null || score === undefined) return false;
  return score >= threshold;
}
