import type { GrowthHistoryPoint } from '@/types/growth';

export function isRecordedWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function calendarDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  const [year, month, day] = value.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function ageInDays(birthDate: unknown, today = new Date()): number | null {
  const birth = calendarDate(birthDate);
  if (!birth) return null;
  // Calendar days avoid daylight-saving and UTC date-only parsing shifts.
  const days = (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate())) / 86400000;
  return days >= 0 ? days : null;
}

export function babyAgeLabel(birthDate: unknown, today = new Date()): string {
  const days = ageInDays(birthDate, today);
  const birth = calendarDate(birthDate);
  if (days === null || !birth) return 'Age unavailable';
  if (days < 31) return `${days} ${days === 1 ? 'day' : 'days'} old`;
  const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth() - (today.getDate() < birth.getDate() ? 1 : 0);
  if (months < 1) return `${days} days old`;
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'} old`;
  return `${Math.floor(months / 12)} years old`;
}

export function shortDate(value: unknown): string | null {
  return calendarDate(value)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? null;
}

export type RecordedWeightPoint = { day: number; weightKg: number; visitDate: string };

export function recordedWeightPoints(history: GrowthHistoryPoint[], birthDate: unknown): RecordedWeightPoint[] {
  return history.flatMap(visit => {
    const date = calendarDate(visit.visit_date);
    const day = typeof visit.age_days === 'number' && Number.isFinite(visit.age_days) && visit.age_days >= 0
      ? visit.age_days : date ? ageInDays(birthDate, date) : null;
    return date && day !== null && isRecordedWeight(visit.weight_kg)
      ? [{ day, weightKg: visit.weight_kg, visitDate: visit.visit_date }] : [];
  }).sort((a, b) => a.day - b.day);
}
