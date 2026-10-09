import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { growthApi } from '@/api/growth';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { GrowthMeasurementRequest } from '@/types/growth';
import { PageHeader } from '@/components/ui/shared/PageHeader';

export default function AddMeasurementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // We need baby DOB for validation
  const { data: baby } = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile
  });

  const [formData, setFormData] = useState<GrowthMeasurementRequest>({
    visit_date: new Date().toISOString().split('T')[0],
    weight_kg: 0,
    length_height_cm: undefined,
    currently_breastfeeding: undefined,
    formula_feeding: undefined,
    solid_foods_started: undefined,
    diarrhea_last_14_days: undefined,
    fever_last_14_days: undefined,
    cough_last_14_days: undefined
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
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Frontend Validations
    if (!formData.visit_date) {
      return setError("Visit date is required.");
    }
    const visitDate = new Date(formData.visit_date);
    const today = new Date();
    if (visitDate > today) {
      return setError("Visit date cannot be in the future.");
    }
    if (baby?.date_of_birth) {
      const dob = new Date(baby.date_of_birth);
      if (visitDate < dob) {
        return setError("Visit date cannot be before the baby's date of birth.");
      }
    }
    if (formData.weight_kg <= 0) {
      return setError("Weight must be greater than 0 kg.");
    }
    if (formData.length_height_cm !== undefined && formData.length_height_cm !== null && formData.length_height_cm <= 0) {
      return setError("Length / Height must be greater than 0 cm.");
    }

    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : Number(value) }));
    } else if (type === 'radio') {
      // Convert string "true"/"false" to boolean
      let boolVal = undefined;
      if (value === 'true') boolVal = true;
      if (value === 'false') boolVal = false;
      setFormData(prev => ({ ...prev, [name]: boolVal }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

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
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors"
            >
              View History
            </button>
            <button 
              onClick={() => {
                setFormData(prev => ({ ...prev, weight_kg: 0, length_height_cm: undefined }));
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

      <form onSubmit={handleSubmit} className="space-y-8">
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
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
                  step="0.01"
                  required
                  value={formData.weight_kg || ''}
                  onChange={handleChange}
                  placeholder="e.g. 4.5"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm">
                  kg
                </div>
              </div>
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
                  step="0.1"
                  min="1"
                  value={formData.length_height_cm || ''}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm">
                  cm
                </div>
              </div>
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
                  <input type="radio" name="currently_breastfeeding" value="true" checked={formData.currently_breastfeeding === true} onChange={handleChange} className="accent-primary" /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="currently_breastfeeding" value="false" checked={formData.currently_breastfeeding === false} onChange={handleChange} className="accent-primary" /> No
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Formula Feeding?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="formula_feeding" value="true" checked={formData.formula_feeding === true} onChange={handleChange} className="accent-primary" /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="formula_feeding" value="false" checked={formData.formula_feeding === false} onChange={handleChange} className="accent-primary" /> No
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Solid Foods Started?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="solid_foods_started" value="true" checked={formData.solid_foods_started === true} onChange={handleChange} className="accent-primary" /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="solid_foods_started" value="false" checked={formData.solid_foods_started === false} onChange={handleChange} className="accent-primary" /> No
                </label>
              </div>
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
                  <input type="radio" name="diarrhea_last_14_days" value="true" checked={formData.diarrhea_last_14_days === true} onChange={handleChange} className="accent-primary" /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="diarrhea_last_14_days" value="false" checked={formData.diarrhea_last_14_days === false} onChange={handleChange} className="accent-primary" /> No
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Fever</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="fever_last_14_days" value="true" checked={formData.fever_last_14_days === true} onChange={handleChange} className="accent-primary" /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="fever_last_14_days" value="false" checked={formData.fever_last_14_days === false} onChange={handleChange} className="accent-primary" /> No
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium leading-none">Cough / Respiratory</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="cough_last_14_days" value="true" checked={formData.cough_last_14_days === true} onChange={handleChange} className="accent-primary" /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="cough_last_14_days" value="false" checked={formData.cough_last_14_days === false} onChange={handleChange} className="accent-primary" /> No
                </label>
              </div>
            </div>
          </div>
        </section>

        <div className="pt-4 pb-12 flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2 rounded-md font-medium transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending ? 'Saving...' : 'Save Measurement'}
          </button>
        </div>
      </form>
    </div>
  );
}
