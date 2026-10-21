import type { GrowthHistoryPoint, GrowthMeasurementRequest } from '@/types/growth';

// Keep numeric input text until validation succeeds; conversion happens only for the API payload.
export type MeasurementFormData = Omit<GrowthMeasurementRequest, 'weight_kg' | 'length_height_cm'> & {
  weight_kg: string;
  length_height_cm: string;
};

export type MeasurementField = keyof MeasurementFormData;
export type MeasurementErrors = Partial<Record<MeasurementField, string>>;

interface ValidationContext {
  dateOfBirth?: string;
  babyId?: number;
  history?: GrowthHistoryPoint[];
  today?: string;
  badInput?: Partial<Record<MeasurementField, boolean>>;
}

export function localCalendarDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isNumberInRange(value: string, min: number, max: number): boolean {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export function validateMeasurementField(
  field: MeasurementField,
  data: MeasurementFormData,
  context: ValidationContext = {},
): string {
  switch (field) {
    case 'visit_date': {
      const value = data.visit_date;
      if (context.badInput?.visit_date) return 'Please select a valid visit date.';
      if (!value) return 'Please select a visit date.';
      if (!isCalendarDate(value)) return 'Please select a valid visit date.';
      if (value > (context.today ?? localCalendarDate())) return 'Visit date cannot be in the future.';
      if (context.dateOfBirth && isCalendarDate(context.dateOfBirth) && value < context.dateOfBirth) {
        return "Visit date cannot be before your baby's date of birth.";
      }
      // Only confirmed records for this child count; an uncached history is not evidence of a duplicate.
      if (context.babyId !== undefined && context.history?.some(
        point => point.baby_id === context.babyId && point.visit_date === value,
      )) return 'A measurement already exists for this date.';
      return '';
    }
    case 'weight_kg':
      if (context.badInput?.weight_kg) return 'Please enter a valid weight.';
      if (!data.weight_kg.trim()) return "Please enter your baby's weight.";
      return isNumberInRange(data.weight_kg, 0.5, 40) ? '' : 'Please enter a valid weight.';
    case 'length_height_cm':
      if (context.badInput?.length_height_cm) return 'Please enter a valid length or height.';
      if (!data.length_height_cm.trim()) return '';
      return isNumberInRange(data.length_height_cm, 30, 130) ? '' : 'Please enter a valid length or height.';
    default:
      if (context.badInput?.[field]) return 'Please select Yes or No.';
      return data[field] === undefined || typeof data[field] === 'boolean' ? '' : 'Please select Yes or No.';
  }
}

export function validateMeasurement(
  data: MeasurementFormData,
  context: ValidationContext = {},
): MeasurementErrors {
  const errors: MeasurementErrors = {};
  for (const field of Object.keys(data) as MeasurementField[]) {
    const error = validateMeasurementField(field, data, context);
    if (error) errors[field] = error;
  }
  return errors;
}
