import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Baby, Heart, Loader2, Ruler } from 'lucide-react';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';
import { BabyRegistrationRequest } from '@/types/baby';
import { cn } from '@/lib/utils';

const registrationControl = 'h-12 min-w-0 rounded-lg border-input/70 bg-background/50 px-3.5 shadow-none focus:border-btn-primary focus:outline-none focus:ring-2 focus:ring-btn-primary focus:ring-offset-2 focus-visible:border-btn-primary focus-visible:ring-btn-primary';

interface FormState {
  name: string;
  sex?: 'Male' | 'Female';
  date_of_birth: string;
  birth_weight_kg: string;
  birth_length_cm: string;
  gestational_age_weeks: string;
  birth_order: string;
  delivery_type: string;
  apgar_score_5min: string;
}

const ALLOWED_DELIVERY_TYPES = [
  'Vaginal Delivery (natural birth)',
  'Cesarean Section (C-Section)',
  'Assisted Vaginal Delivery (forceps or vacuum)'
];

export default function BabyRegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [todayIso] = useState(() => new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState<FormState>({
    name: '',
    sex: undefined,
    date_of_birth: '',
    birth_weight_kg: '',
    birth_length_cm: '',
    gestational_age_weeks: '',
    birth_order: '',
    delivery_type: '',
    apgar_score_5min: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'name': {
        const trimmed = (value ?? '').trim();
        if (!trimmed) return "Baby's name is required";
        if (trimmed.length > 100) return 'Name cannot exceed 100 characters';
        return '';
      }
      case 'sex': {
        if (!value || (value !== 'Male' && value !== 'Female')) {
          return 'Biological sex is required';
        }
        return '';
      }
      case 'date_of_birth': {
        if (!value) return 'Date of birth is required';
        const parts = value.split('-');
        if (parts.length !== 3) return 'Please enter a valid date';
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
          return 'Please enter a valid date';
        }
        const parsedDate = new Date(year, month - 1, day);
        if (
          parsedDate.getFullYear() !== year ||
          parsedDate.getMonth() !== month - 1 ||
          parsedDate.getDate() !== day
        ) {
          return 'Please enter a valid date';
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        parsedDate.setHours(0, 0, 0, 0);
        if (parsedDate > today) {
          return 'Date of birth cannot be in the future';
        }
        return '';
      }
      case 'birth_weight_kg': {
        if (value === '' || value === undefined || value === null) {
          return 'Birth weight is required';
        }
        const num = Number(value);
        if (isNaN(num) || !isFinite(num) || num <= 0) {
          return 'Birth weight must be a valid positive number';
        }
        if (num > 5) {
          return 'Birth weight must not exceed 5 kg';
        }
        return '';
      }
      case 'birth_length_cm': {
        if (value === '' || value === undefined || value === null) {
          return '';
        }
        const num = Number(value);
        if (isNaN(num) || !isFinite(num) || num < 42 || num > 58) {
          return 'Please enter a valid birth length.';
        }
        return '';
      }
      case 'gestational_age_weeks': {
        if (value === '' || value === undefined || value === null) {
          return 'Gestational age is required';
        }
        const num = Number(value);
        if (isNaN(num) || !isFinite(num) || num <= 0 || !Number.isInteger(num)) {
          return 'Gestational age must be a valid whole number';
        }
        if (num > 44) {
          return 'Gestational age must not exceed 44 weeks';
        }
        return '';
      }
      case 'birth_order': {
        if (value === '' || value === undefined || value === null) {
          return '';
        }
        const num = Number(value);
        if (isNaN(num) || !isFinite(num) || !Number.isInteger(num) || num < 1) {
          return 'Birth order must be a positive whole number';
        }
        return '';
      }
      case 'delivery_type': {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return '';
        }
        if (!ALLOWED_DELIVERY_TYPES.includes(value)) {
          return 'Please select a valid delivery type';
        }
        return '';
      }
      case 'apgar_score_5min': {
        if (value === '' || value === undefined || value === null) {
          return '';
        }
        const num = Number(value);
        if (isNaN(num) || !isFinite(num) || !Number.isInteger(num) || num < 0 || num > 10) {
          return 'APGAR score must be a whole number between 0 and 10';
        }
        return '';
      }
      default:
        return '';
    }
  };

  const validateAll = (data: FormState): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    const fields = [
      'name',
      'sex',
      'date_of_birth',
      'birth_weight_kg',
      'birth_length_cm',
      'gestational_age_weeks',
      'birth_order',
      'delivery_type',
      'apgar_score_5min'
    ];
    for (const f of fields) {
      const err = validateField(f, (data as any)[f]);
      if (err) {
        newErrors[f] = err;
      }
    }
    return newErrors;
  };

  const handleChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: err }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = validateField(field, (formData as any)[field]);
    setErrors(prev => ({ ...prev, [field]: err }));
  };

  const weightNum = formData.birth_weight_kg !== '' && formData.birth_weight_kg !== undefined ? Number(formData.birth_weight_kg) : undefined;
  const gaNum = formData.gestational_age_weeks !== '' && formData.gestational_age_weeks !== undefined ? Number(formData.gestational_age_weeks) : undefined;

  // Priority 1 — Registration Restriction
  // Birth weight below 2 kg OR Gestational age below 28 weeks
  const isRestricted = (weightNum !== undefined && !isNaN(weightNum) && isFinite(weightNum) && weightNum > 0 && weightNum < 2) ||
                       (gaNum !== undefined && !isNaN(gaNum) && isFinite(gaNum) && gaNum > 0 && gaNum < 28);

  // Priority 3 — Medical Warning
  // Birth weight below 2.5 kg OR Gestational age below 37 weeks (when restriction not triggered)
  const hasWeightWarning = weightNum !== undefined && !isNaN(weightNum) && isFinite(weightNum) && weightNum >= 2 && weightNum < 2.5;
  const hasGaWarning = gaNum !== undefined && !isNaN(gaNum) && isFinite(gaNum) && gaNum >= 28 && gaNum < 37;
  const isWarning = !isRestricted && (hasWeightWarning || hasGaWarning);

  const registerBabyMutation = useMutation({
    mutationFn: babyApi.registerBaby,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['baby.profile'] });
      navigate('/app', { replace: true });
    },
    onError: (err: any) => {
      if (err instanceof ApiClientError && err.status === 400) {
        // Handle duplicate baby error specifically
        if (typeof err.data?.detail === 'string' && err.data.detail.includes('already has a registered baby')) {
          setError('A baby profile already exists for this account.');
          queryClient.invalidateQueries({ queryKey: ['baby.profile'] });
          setTimeout(() => navigate('/app'), 2000);
          return;
        }
      }
      
      if (err instanceof ApiClientError && err.data?.detail) {
        setError(typeof err.data.detail === 'string' ? err.data.detail : 'Validation error occurred');
      } else {
        setError('Network error or server unavailable');
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerBabyMutation.isPending) return;

    // Mark all fields as touched to display inline messages
    setTouched({
      name: true,
      sex: true,
      date_of_birth: true,
      birth_weight_kg: true,
      birth_length_cm: true,
      gestational_age_weeks: true,
      birth_order: true,
      delivery_type: true,
      apgar_score_5min: true,
    });

    // Priority 1 — Registration Restriction
    if (isRestricted) {
      return;
    }

    // Priority 2 — Invalid Input
    const validationErrors = validateAll(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // Priority 3 — Medical Warning (Already displayed via notification banner, does not block submission)

    // Priority 4 — Successful Registration
    const payload: BabyRegistrationRequest = {
      name: formData.name.trim(),
      sex: formData.sex as 'Male' | 'Female',
      date_of_birth: formData.date_of_birth,
      birth_weight_kg: Number(formData.birth_weight_kg),
      gestational_age_weeks: Number(formData.gestational_age_weeks),
    };

    if (formData.birth_length_cm !== '' && formData.birth_length_cm !== undefined) {
      payload.birth_length_cm = Number(formData.birth_length_cm);
    }
    if (formData.birth_order !== '' && formData.birth_order !== undefined) {
      payload.birth_order = Number(formData.birth_order);
    }
    if (formData.delivery_type && formData.delivery_type.trim() !== '') {
      payload.delivery_type = formData.delivery_type.trim();
    }
    if (formData.apgar_score_5min !== '' && formData.apgar_score_5min !== undefined) {
      payload.apgar_score_5min = Number(formData.apgar_score_5min);
    }

    registerBabyMutation.mutate(payload);
  };

  return (
    <div className="relative isolate min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10 lg:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden sm:inset-4 sm:rounded-2xl xl:inset-6">
        <div className="absolute inset-0 auth-decoration opacity-50" />
        <div className="absolute -top-48 right-0 h-80 w-[90%] rotate-12 rounded-[50%] bg-secondary" />
        <div className="absolute right-0 bottom-0 h-2/3 w-1/2 rounded-tl-[70%] bg-accent/50" />
      </div>
      <header className="mx-auto w-full max-w-3xl text-center">
        <div className="flex items-center justify-center gap-2 font-heading text-lg font-bold tracking-tight">
          <Heart aria-hidden="true" className="size-8 fill-accent text-brand" strokeWidth={2.5} />
          <span>BabyGrowth</span>
        </div>
        <h1 id="baby-registration-heading" className="mx-auto mt-6 max-w-xl font-heading text-2xl leading-tight font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome! Let's set up your baby's profile
        </h1>
        <p id="baby-registration-description" className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Enter your baby's birth details to enable personalized growth monitoring and WHO-standard assessments.
        </p>
      </header>

      <main className="mx-auto mt-7 w-full max-w-3xl sm:mt-8">
        <Card className="rounded-2xl border-border/70 bg-card shadow-auth">
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-labelledby="baby-registration-heading"
            aria-describedby={error ? 'baby-registration-error' : isRestricted ? 'medical-restriction-alert' : isWarning ? 'medical-warning-alert' : 'baby-registration-description'}
            aria-busy={registerBabyMutation.isPending}
          >
            <CardContent className="space-y-8 p-5 sm:p-8">
              {/* API Error Notification */}
              {error && (
                <div role="alert" id="baby-registration-error" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm leading-relaxed font-medium text-destructive">
                  {error}
                </div>
              )}

              {/* Priority 1: Registration Restriction Notification */}
              {isRestricted && (
                <Alert
                  variant="destructive"
                  id="medical-restriction-alert"
                  className="rounded-xl border-destructive/50 bg-destructive-soft text-destructive"
                >
                  <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
                  <div className="space-y-1">
                    <AlertTitle className="font-semibold text-base leading-tight">
                      Specialized Medical Assessment Required
                    </AlertTitle>
                    <AlertDescription className="text-sm leading-relaxed">
                      Your baby's birth details indicate that specialized growth monitoring may be needed. For your child's safety, please consult a qualified pediatrician for an appropriate growth assessment. Registration cannot be completed at this stage.
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Priority 3: Medical Warning Notification */}
              {isWarning && (
                <Alert
                  id="medical-warning-alert"
                  className="rounded-xl border-amber-300 bg-amber-50/80 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <div className="space-y-1">
                    <AlertTitle className="font-semibold text-base leading-tight text-amber-900 dark:text-amber-300">
                      Medical Attention Required
                    </AlertTitle>
                    <AlertDescription className="text-sm leading-relaxed text-amber-950 dark:text-amber-200">
                      Your baby's birth information indicates low birth weight or premature birth. Your child must be examined by a doctor immediately. Please consult a qualified pediatrician or healthcare professional before relying on this application's growth assessments.
                    </AlertDescription>
                  </div>
                </Alert>
              )}
              
              <section aria-labelledby="basic-information-heading" className="space-y-5">
                <h2 id="basic-information-heading" className="flex items-center gap-3 border-b border-border/70 pb-4 text-base font-semibold">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-btn-primary"><Baby aria-hidden="true" className="size-4" /></span>
                  Basic Information
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Baby's Name *</Label>
                    <Input 
                      id="name" 
                      className={cn(
                        registrationControl,
                        touched.name && errors.name && 'border-destructive focus:border-destructive focus:ring-destructive'
                      )}
                      aria-invalid={Boolean(touched.name && errors.name)}
                      aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
                      placeholder="e.g. Emma" 
                      value={formData.name}
                      onChange={e => handleChange('name', e.target.value)}
                      onBlur={() => handleBlur('name')}
                    />
                    {touched.name && errors.name && (
                      <p id="name-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sex">Biological Sex *</Label>
                    <Select 
                      value={formData.sex} 
                      onValueChange={v => {
                        handleChange('sex', v);
                        handleBlur('sex');
                      }}
                    >
                      <SelectTrigger
                        id="sex"
                        className={cn(
                          registrationControl,
                          touched.sex && errors.sex && 'border-destructive focus:border-destructive focus:ring-destructive'
                        )}
                        aria-invalid={Boolean(touched.sex && errors.sex)}
                        aria-describedby={touched.sex && errors.sex ? 'sex-error' : undefined}
                        onBlur={() => handleBlur('sex')}
                      >
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Male" className="min-h-11 rounded-md">Male</SelectItem>
                        <SelectItem value="Female" className="min-h-11 rounded-md">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    {touched.sex && errors.sex && (
                      <p id="sex-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.sex}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input 
                      id="dob" 
                      className={cn(
                        registrationControl,
                        touched.date_of_birth && errors.date_of_birth && 'border-destructive focus:border-destructive focus:ring-destructive'
                      )}
                      aria-invalid={Boolean(touched.date_of_birth && errors.date_of_birth)}
                      aria-describedby={touched.date_of_birth && errors.date_of_birth ? 'dob-error' : undefined}
                      type="date"
                      max={todayIso}
                      value={formData.date_of_birth}
                      onChange={e => handleChange('date_of_birth', e.target.value)}
                      onBlur={() => handleBlur('date_of_birth')}
                    />
                    {touched.date_of_birth && errors.date_of_birth && (
                      <p id="dob-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.date_of_birth}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section aria-labelledby="birth-details-heading" className="space-y-5">
                <h2 id="birth-details-heading" className="flex items-center gap-3 border-b border-border/70 pb-4 text-base font-semibold">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><Ruler aria-hidden="true" className="size-4" /></span>
                  Birth Details
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Birth Weight (kg) *</Label>
                    <Input 
                      id="weight" 
                      className={cn(
                        registrationControl,
                        touched.birth_weight_kg && errors.birth_weight_kg && 'border-destructive focus:border-destructive focus:ring-destructive'
                      )}
                      aria-invalid={Boolean(touched.birth_weight_kg && errors.birth_weight_kg)}
                      aria-describedby={touched.birth_weight_kg && errors.birth_weight_kg ? 'weight-error' : undefined}
                      type="number" 
                      step="any"
                      placeholder="e.g. 3.2" 
                      value={formData.birth_weight_kg}
                      onChange={e => handleChange('birth_weight_kg', e.target.value)}
                      onBlur={() => handleBlur('birth_weight_kg')}
                    />
                    {touched.birth_weight_kg && errors.birth_weight_kg && (
                      <p id="weight-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.birth_weight_kg}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="length">Birth Length (cm) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="length" 
                      className={cn(
                        registrationControl,
                        touched.birth_length_cm && errors.birth_length_cm && 'border-destructive focus:border-destructive focus:ring-destructive'
                      )}
                      aria-invalid={Boolean(touched.birth_length_cm && errors.birth_length_cm)}
                      aria-describedby={touched.birth_length_cm && errors.birth_length_cm ? 'length-error' : undefined}
                      type="number" 
                      step="any"
                      placeholder="e.g. 50" 
                      value={formData.birth_length_cm}
                      onChange={e => handleChange('birth_length_cm', e.target.value)}
                      onBlur={() => handleBlur('birth_length_cm')}
                    />
                    {touched.birth_length_cm && errors.birth_length_cm && (
                      <p id="length-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.birth_length_cm}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gestational_age">Gestational Age (weeks) *</Label>
                    <Input 
                      id="gestational_age" 
                      className={cn(
                        registrationControl,
                        touched.gestational_age_weeks && errors.gestational_age_weeks && 'border-destructive focus:border-destructive focus:ring-destructive'
                      )}
                      aria-invalid={Boolean(touched.gestational_age_weeks && errors.gestational_age_weeks)}
                      aria-describedby={touched.gestational_age_weeks && errors.gestational_age_weeks ? 'gestational-age-error' : undefined}
                      type="number" 
                      step="1"
                      placeholder="e.g. 39" 
                      value={formData.gestational_age_weeks}
                      onChange={e => handleChange('gestational_age_weeks', e.target.value)}
                      onBlur={() => handleBlur('gestational_age_weeks')}
                    />
                    {touched.gestational_age_weeks && errors.gestational_age_weeks && (
                      <p id="gestational-age-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.gestational_age_weeks}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth_order">Birth Order <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="birth_order" 
                      className={cn(
                        registrationControl,
                        touched.birth_order && errors.birth_order && 'border-destructive focus:border-destructive focus:ring-destructive'
                      )}
                      aria-invalid={Boolean(touched.birth_order && errors.birth_order)}
                      aria-describedby={touched.birth_order && errors.birth_order ? 'birth-order-error' : undefined}
                      type="number" 
                      step="1"
                      placeholder="e.g. 1 (first child)" 
                      value={formData.birth_order}
                      onChange={e => handleChange('birth_order', e.target.value)}
                      onBlur={() => handleBlur('birth_order')}
                    />
                    {touched.birth_order && errors.birth_order && (
                      <p id="birth-order-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.birth_order}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_type">Delivery Type <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Select 
                      value={formData.delivery_type} 
                      onValueChange={v => {
                        handleChange('delivery_type', v);
                        handleBlur('delivery_type');
                      }}
                    >
                      <SelectTrigger
                        id="delivery_type"
                        className={cn(
                          registrationControl,
                          touched.delivery_type && errors.delivery_type && 'border-destructive focus:border-destructive focus:ring-destructive'
                        )}
                        aria-invalid={Boolean(touched.delivery_type && errors.delivery_type)}
                        aria-describedby={touched.delivery_type && errors.delivery_type ? 'delivery-type-error' : undefined}
                        onBlur={() => handleBlur('delivery_type')}
                      >
                        <SelectValue placeholder="Select delivery type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Vaginal Delivery (natural birth)" className="min-h-11 rounded-md">Vaginal Delivery (natural birth)</SelectItem>
                        <SelectItem value="Cesarean Section (C-Section)" className="min-h-11 rounded-md">Cesarean Section (C-Section)</SelectItem>
                        <SelectItem value="Assisted Vaginal Delivery (forceps or vacuum)" className="min-h-11 rounded-md">Assisted Vaginal Delivery (forceps or vacuum)</SelectItem>
                      </SelectContent>
                    </Select>
                    {touched.delivery_type && errors.delivery_type && (
                      <p id="delivery-type-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.delivery_type}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apgar">APGAR Score (5 min) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="apgar" 
                      className={cn(
                        registrationControl,
                        touched.apgar_score_5min && errors.apgar_score_5min && 'border-destructive focus:border-destructive focus:ring-destructive'
                      )}
                      aria-invalid={Boolean(touched.apgar_score_5min && errors.apgar_score_5min)}
                      aria-describedby={touched.apgar_score_5min && errors.apgar_score_5min ? 'apgar-error' : undefined}
                      type="number" 
                      step="1"
                      placeholder="e.g. 9" 
                      value={formData.apgar_score_5min}
                      onChange={e => handleChange('apgar_score_5min', e.target.value)}
                      onBlur={() => handleBlur('apgar_score_5min')}
                    />
                    {touched.apgar_score_5min && errors.apgar_score_5min && (
                      <p id="apgar-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.apgar_score_5min}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </CardContent>
            <CardFooter className="justify-end rounded-b-2xl border-t border-border/70 bg-secondary/30 px-5 py-5 sm:px-8 sm:py-6">
              <Button
                className="h-12 w-full rounded-lg px-7 md:w-auto md:min-w-[224px]"
                size="lg"
                type="submit"
                disabled={registerBabyMutation.isPending}
              >
                {registerBabyMutation.isPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                    Saving profile...
                  </>
                ) : (
                  'Complete Registration'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
