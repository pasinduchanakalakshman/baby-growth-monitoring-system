/**
 * Lightweight, zero-dependency date utilities for the Nutrition Meal Planner.
 * Avoids external date-fns dependency while maintaining deterministic Asia/Colombo calendar calculations.
 */

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatHeaderDate(dateStr: string): string {
  try {
    const d = parseDateString(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatMonthDayYear(dateStr: string): string {
  try {
    const d = parseDateString(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDayPill(dateStr: string): { dayName: string; dayDate: string } {
  try {
    const d = parseDateString(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return { dayName, dayDate };
  } catch {
    return { dayName: 'Day', dayDate: dateStr };
  }
}

export function formatShortDate(dateStr: string): string {
  try {
    const d = parseDateString(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatWeekRange(startDateStr: string, endDateStr: string): string {
  try {
    const start = parseDateString(startDateStr);
    const end = parseDateString(endDateStr);
    const startPart = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endPart = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startPart} – ${endPart}`;
  } catch {
    return `${startDateStr} – ${endDateStr}`;
  }
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = parseDateString(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function subDaysFromDate(dateStr: string, days: number): string {
  return addDaysToDate(dateStr, -days);
}

export function getTodayDateString(): string {
  return toDateString(new Date());
}
