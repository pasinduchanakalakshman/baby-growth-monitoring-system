export const journeyPhases = [
  { label: 'Birth', title: 'At Birth', description: "Your baby's birth weight is the starting point of this chart." },
  { label: 'Initial weight loss', title: 'First Few Days', description: 'Newborn babies often lose a little weight during the first few days after birth.' },
  { label: 'Recovery', title: 'Weight Recovery', description: 'Many babies regain their birth weight within approximately 1–2 weeks.' },
  { label: 'Continued growth', title: 'Continued Growth', description: 'After the early recovery period, babies generally continue gaining weight.' },
] as const;

export interface JourneyPoint {
  day: number;
  illustrativeWeightKg: number;
  phase: string;
}

/** Teaching assumptions only: 5% dip on day 3, recovery on day 12,
 * then 25 g/day. Never use as clinical measurements, limits or predictions.
 * Linear daily interpolation; the chart uses monotone rendering without overshoot.
 */
export function createNewbornWeightJourney(birthWeightKg: unknown): JourneyPoint[] {
  if (typeof birthWeightKg !== 'number' || !Number.isFinite(birthWeightKg) || birthWeightKg <= 0) return [];
  const low = birthWeightKg * 0.95;
  if (low <= 0 || low >= birthWeightKg || birthWeightKg + 0.45 <= birthWeightKg) return [];
  const points = Array.from({ length: 31 }, (_, day): JourneyPoint => ({
    day,
    illustrativeWeightKg: day === 0 ? birthWeightKg
      : day <= 3 ? birthWeightKg - (birthWeightKg - low) * day / 3
      : day <= 12 ? low + (birthWeightKg - low) * (day - 3) / 9
      : birthWeightKg + (day - 12) * 0.025,
    phase: journeyPhases[day === 0 ? 0 : day <= 3 ? 1 : day <= 12 ? 2 : 3].label,
  }));
  return points.every(p => Number.isFinite(p.illustrativeWeightKg) && p.illustrativeWeightKg > 0) ? points : [];
}
