import type { GrowthHistoryPoint } from '@/types/growth';
import type { BabyProfile } from '@/types/baby';
import { ageInDays, calendarDate } from '@/features/dashboard/dashboardDisplay';
import reference from './data/who-percentiles.json';

export type DetailedMetric = 'weight' | 'height' | 'waz' | 'haz';
export type RecordedMetricKey = 'weight_kg' | 'length_height_cm' | 'verified_waz' | 'verified_haz';
export type GrowthChartProfile = Pick<BabyProfile, 'id' | 'sex' | 'date_of_birth'> & Partial<Pick<BabyProfile, 'birth_weight_kg' | 'birth_length_cm'>>;
export type BirthMeasurement = { date: string; value: number; label: 'Birth weight' | 'Birth length' };
export type ReferencePoint = { ageMonths: number; p3: number; p15: number; p50: number; p85: number; p97: number };

export const whoPercentiles = [
  { key: 'p3', label: '3rd', color: '#c77c80' },
  { key: 'p15', label: '15th', color: '#bd9558' },
  { key: 'p50', label: '50th', color: '#648e75' },
  { key: 'p85', label: '85th', color: '#bd9558' },
  { key: 'p97', label: '97th', color: '#c77c80' },
] as const;

// This is the WHO chart-axis conversion, also used by the existing backend's
// monthly reference lookup. It does not round the API's exact age in days.
export const whoDaysPerMonth = reference.days_per_month;

export function birthMeasurement(metric: DetailedMetric, baby: GrowthChartProfile | undefined, history: GrowthHistoryPoint[]): BirthMeasurement | null {
  if (!baby || !calendarDate(baby.date_of_birth) || history.some(visit => visit.baby_id !== baby.id)) return null;
  if (metric !== 'weight' && metric !== 'height') return null;
  const value = metric === 'weight' ? baby.birth_weight_kg : baby.birth_length_cm;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return { date: baby.date_of_birth, value, label: metric === 'weight' ? 'Birth weight' : 'Birth length' };
}

export function recordedAgeDays(visit: GrowthHistoryPoint, birthDate?: string): number | null {
  const date = calendarDate(visit.visit_date);
  if (!date) return null;
  if (typeof visit.age_days === 'number' && Number.isFinite(visit.age_days) && visit.age_days >= 0) return visit.age_days;
  return ageInDays(birthDate, date);
}

export function agePlotData(history: GrowthHistoryPoint[], birthDate?: string) {
  return history.map(visit => {
    const days = recordedAgeDays(visit, birthDate);
    return { ...visit, chartAgeDays: days, ageMonths: days === null ? null : days / whoDaysPerMonth };
  });
}

export function validWhoRows(rows: unknown): rows is number[][] {
  return Array.isArray(rows) && rows.length === 1857 && rows.every((row, day) => (
    Array.isArray(row) && row.length === 6 && row[0] === day
    && row.slice(1).every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)
    && row.slice(1, -1).every((value, index) => value < row[index + 2])
  ));
}

const verifiedDatasets = reference.datasets.filter(dataset => validWhoRows(dataset.rows));

export function whoReference(metric: DetailedMetric, sex: unknown) {
  if (sex !== 'Male' && sex !== 'Female') return null;
  const dataset = verifiedDatasets.find(candidate => candidate.metric === metric && candidate.sex === sex);
  if (!dataset) return null;
  const point = ([day, p3, p15, p50, p85, p97]: number[]): ReferencePoint => ({
    ageMonths: day / whoDaysPerMonth, p3, p15, p50, p85, p97,
  });
  // WHO's published discontinuity is not smoothed across the two measurement methods.
  const segments = metric === 'height'
    ? [dataset.rows.filter(row => row[0] <= reference.length_last_day).map(point), dataset.rows.filter(row => row[0] >= reference.height_first_day).map(point)]
    : [dataset.rows.map(point)];
  return { segments, sourceUrl: dataset.source_url, sexLabel: sex === 'Male' ? 'boys' : 'girls' };
}
