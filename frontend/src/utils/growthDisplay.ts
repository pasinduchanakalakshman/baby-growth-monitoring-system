/**
 * Safely displays a date string (YYYY-MM-DD) without shifting it based on the user's local timezone.
 * When you pass 'YYYY-MM-DD' to new Date(), JS treats it as UTC midnight, which can shift to the previous day
 * in timezones behind UTC (like EST/PST). 
 */
export function formatCalendarDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not recorded';
  
  // Create date using local parts to prevent timezone shifting
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  
  // Note: month is 0-indexed in JS Date
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Returns a readable WHO status string given a Z-score.
 */
export function getWhoStatusFromZScore(zScore: number | null | undefined): string {
  if (zScore === null || zScore === undefined) return 'Not available';
  
  if (zScore < -3) {
    return 'Markedly below WHO threshold';
  } else if (zScore < -2) {
    return 'Below WHO threshold';
  } else if (zScore > 3) {
    return 'Markedly above WHO threshold';
  } else if (zScore > 2) {
    return 'Above WHO threshold';
  } else {
    return 'Within expected WHO threshold';
  }
}
