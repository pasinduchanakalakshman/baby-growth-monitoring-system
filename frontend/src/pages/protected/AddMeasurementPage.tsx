import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { growthApi } from '@/api/growth';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { GrowthHistoryPoint, GrowthMeasurementRequest } from '@/types/growth';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { cn } from '@/lib/utils';
import {
  localCalendarDate, validateMeasurement, validateMeasurementField,
  type MeasurementErrors, type MeasurementField, type MeasurementFormData,
} from '@/utils/measurementValidation';

export default function AddMeasurementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<MeasurementErrors>({});
  const badInput = useRef<Partial<Record<MeasurementField, boolean>>>({});
  const submitting = useRef(false);

  // We need baby DOB for validation
  const { data: baby } = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile
  });

  const [formData, setFormData] = useState<MeasurementFormData>({
    visit_date: localCalendarDate(),
    weight_kg: '',
    length_height_cm: '',
    currently_breastfeeding: undefined,
    formula_feeding: undefined,
    solid_foods_started: undefined,
    diarrhea_last_14_days: undefined,
    fever_last_14_days: undefined,
    cough_last_14_days: undefined
  });

  const validationContext = () => ({
    dateOfBirth: baby?.date_of_birth,
    babyId: baby?.id,
    history: queryClient.getQueryData<GrowthHistoryPoint[]>(['growth.history']),
    badInput: badInput.current,
  });

  const mutation = useMutation({
    mutationFn: growthApi.addGrowthMeasurement,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['growth.history'] });
      queryClient.invalidateQueries({ queryKey: ['growth.overview'] });
      queryClient.invalidateQueries({ queryKey: ['growth.forecast'] });
      queryClient.invalidateQueries({ queryKey: ['risk.latest'] });
      queryClient.invalidateQueries({ queryKey: ['risk.trajectory'] });
      queryClient.invalidateQueries({ queryKey: ['risk.explanation'] });
      setIsSuccess(true);
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        if (err.data?.detail) {
          setError(typeof err.data.detail === 'string' ? err.data.detail : 'Invalid input provided');
        } else {
          setError(err.message || 'Failed to save measurement');
        }
      } else {
        setError('Network error or server unavailable');
      }
    },
    onSettled: () => { submitting.current = false; },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current || mutation.isPending) return;
    setError(null);
    for (const field of ['visit_date', 'weight_kg', 'length_height_cm'] as const) {
      const input = e.currentTarget.elements.namedItem(field) as HTMLInputElement;
      badInput.current[field] = input.validity.badInput;
    }
    const errors = validateMeasurement(formData, validationContext());
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const payload: GrowthMeasurementRequest = {
      ...formData,
      weight_kg: Number(formData.weight_kg),
      length_height_cm: formData.length_height_cm.trim() === '' ? undefined : Number(formData.length_height_cm),
    };
    submitting.current = true;
    mutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, validity } = e.target;
    const field = name as MeasurementField;
    badInput.current[field] = validity.badInput;
    if (type === 'radio' && value !== 'true' && value !== 'false') {
      badInput.current[field] = true;
      setFieldErrors(prev => ({ ...prev, [field]: 'Please select Yes or No.' }));
      return;
    }
    const updated = { ...formData, [field]: type === 'radio' ? value === 'true' : value };
    setFormData(updated);
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: validateMeasurementField(field, updated, validationContext()) }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const field = e.target.name as MeasurementField;
    badInput.current[field] = e.target.type === 'radio'
      ? e.target.value !== 'true' && e.target.value !== 'false'
      : e.target.validity.badInput;
    setFieldErrors(prev => ({ ...prev, [field]: validateMeasurementField(field, formData, validationContext()) }));
  };

  const fieldProps = (field: MeasurementField) => ({
    onBlur: handleBlur,
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  });

  const inlineError = (field: MeasurementField) => fieldErrors[field] && (
    <p id={`${field}-error`} role="alert" className="text-xs font-medium text-destructive mt-1">
      {fieldErrors[field]}
    </p>
  );

  const invalidClass = (field: MeasurementField) => fieldErrors[field]
    ? 'border-destructive focus:border-destructive focus-visible:ring-destructive'
    : '';

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto p-4">
        <div className="bg-card border rounded-xl shadow-sm p-8 text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Measurement saved.</h2>
          <p className="text-muted-foreground">
            The growth measurement has been successfully recorded.
          </p>
          <div className="flex flex-col space-y-3 pt-4">
            <button 
              onClick={() => navigate('/growth/history')}
              className="bg-btn-primary text-btn-primary-foreground hover:bg-btn-primary-hover active:bg-btn-primary-active px-4 py-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btn-primary"
            >
              View History
            </button>
            <button 
              onClick={() => {
                setFormData(prev => ({ ...prev, weight_kg: '', length_height_cm: '' }));
                setFieldErrors({});
                badInput.current = {};
                setIsSuccess(false);
              }}
              className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-md font-medium transition-colors"
            >
              Add Another Measurement
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24 space-y-8">
      <PageHeader
        title="Add Growth Measurement"
        description="Record measurements from your child's latest growth visit."
      />

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border-l-4 border-destructive text-destructive rounded-r-md flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-busy={mutation.isPending} className="space-y-8">
        {/* Anthropometry Section */}
        <section className="bg-card border rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-800 border-b pb-2">Measurement Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="visit_date" className="text-sm font-medium leading-none">
                Visit Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                id="visit_date"
                name="visit_date"
                required
                value={formData.visit_date}
                onChange={handleChange}
                {...fieldProps('visit_date')}
                className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", invalidClass('visit_date'))}
              />
              {inlineError('visit_date')}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="weight_kg" className="text-sm font-medium leading-none">
                Weight <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="weight_kg"
                  name="weight_kg"
                  step="any"
                  required
                  value={formData.weight_kg}
                  onChange={handleChange}
                  {...fieldProps('weight_kg')}
                  placeholder="e.g. 4.5"
                  className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", invalidClass('weight_kg'))}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm">
                  kg
                </div>
              </div>
              {inlineError('weight_kg')}
            </div>

            <div className="space-y-2">
              <label htmlFor="length_height_cm" className="text-sm font-medium leading-none">
                Length / Height
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="length_height_cm"
                  name="length_height_cm"
                  step="any"
                  value={formData.length_height_cm}
                  onChange={handleChange}
                  {...fieldProps('length_height_cm')}
                  placeholder="Optional"
                  className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", invalidClass('length_height_cm'))}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm">
                  cm
                </div>
              </div>
              {inlineError('length_height_cm')}
            </div>
          </div>
        </section>

        {/* Feeding Section */}
        <section className="bg-card border rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-800 border-b pb-2">Feeding (Optional)</h2>
          <p className="text-sm text-muted-foreground mb-6">Historical data used for monitoring.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Currently Breastfeeding?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="currently_breastfeeding" value="true" checked={formData.currently_breastfeeding === true} onChange={handleChange} {...fieldProps('currently_breastfeeding')} className={cn("accent-primary", invalidClass('currently_breastfeeding'))} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="currently_breastfeeding" value="false" checked={formData.currently_breastfeeding === false} onChange={handleChange} {...fieldProps('currently_breastfeeding')} className={cn("accent-primary", invalidClass('currently_breastfeeding'))} /> No
                </label>
              </div>
              {inlineError('currently_breastfeeding')}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Formula Feeding?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="formula_feeding" value="true" checked={formData.formula_feeding === true} onChange={handleChange} {...fieldProps('formula_feeding')} className={cn("accent-primary", invalidClass('formula_feeding'))} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="formula_feeding" value="false" checked={formData.formula_feeding === false} onChange={handleChange} {...fieldProps('formula_feeding')} className={cn("accent-primary", invalidClass('formula_feeding'))} /> No
                </label>
              </div>
              {inlineError('formula_feeding')}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Solid Foods Started?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="solid_foods_started" value="true" checked={formData.solid_foods_started === true} onChange={handleChange} {...fieldProps('solid_foods_started')} className={cn("accent-primary", invalidClass('solid_foods_started'))} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="solid_foods_started" value="false" checked={formData.solid_foods_started === false} onChange={handleChange} {...fieldProps('solid_foods_started')} className={cn("accent-primary", invalidClass('solid_foods_started'))} /> No
                </label>
              </div>
              {inlineError('solid_foods_started')}
            </div>
          </div>
        </section>

        {/* Recent Illness Section */}
        <section className="bg-card border rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-800 border-b pb-2">Recent Illness (Last 14 Days)</h2>
          <p className="text-sm text-muted-foreground mb-6">Did your baby experience any of the following in the past 2 weeks?</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Diarrhea</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="diarrhea_last_14_days" value="true" checked={formData.diarrhea_last_14_days === true} onChange={handleChange} {...fieldProps('diarrhea_last_14_days')} className={cn("accent-primary", invalidClass('diarrhea_last_14_days'))} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="diarrhea_last_14_days" value="false" checked={formData.diarrhea_last_14_days === false} onChange={handleChange} {...fieldProps('diarrhea_last_14_days')} className={cn("accent-primary", invalidClass('diarrhea_last_14_days'))} /> No
                </label>
              </div>
              {inlineError('diarrhea_last_14_days')}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Fever</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="fever_last_14_days" value="true" checked={formData.fever_last_14_days === true} onChange={handleChange} {...fieldProps('fever_last_14_days')} className={cn("accent-primary", invalidClass('fever_last_14_days'))} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="fever_last_14_days" value="false" checked={formData.fever_last_14_days === false} onChange={handleChange} {...fieldProps('fever_last_14_days')} className={cn("accent-primary", invalidClass('fever_last_14_days'))} /> No
                </label>
              </div>
              {inlineError('fever_last_14_days')}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Cough / Respiratory</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="cough_last_14_days" value="true" checked={formData.cough_last_14_days === true} onChange={handleChange} {...fieldProps('cough_last_14_days')} className={cn("accent-primary", invalidClass('cough_last_14_days'))} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="cough_last_14_days" value="false" checked={formData.cough_last_14_days === false} onChange={handleChange} {...fieldProps('cough_last_14_days')} className={cn("accent-primary", invalidClass('cough_last_14_days'))} /> No
                </label>
              </div>
              {inlineError('cough_last_14_days')}
            </div>
          </div>
        </section>

        <div className="pt-4 pb-12 flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-btn-primary text-btn-primary-foreground hover:bg-btn-primary-hover active:bg-btn-primary-active h-10 px-8 py-2 rounded-md font-medium transition-colors shadow-md disabled:opacity-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btn-primary"
          >
            {mutation.isPending ? 'Saving...' : 'Save Measurement'}
          </button>
        </div>
      </form>
    </div>
  );
}
