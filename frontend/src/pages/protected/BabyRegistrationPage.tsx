import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Baby, Heart, Loader2, Ruler } from 'lucide-react';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';
import { BabyRegistrationRequest } from '@/types/baby';

const registrationControl = 'h-12 min-w-0 rounded-lg border-input/70 bg-background/50 px-3.5 shadow-none focus:border-btn-primary focus:outline-none focus:ring-2 focus:ring-btn-primary focus:ring-offset-2 focus-visible:border-btn-primary focus-visible:ring-btn-primary';

export default function BabyRegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<Partial<BabyRegistrationRequest>>({
    name: '',
    sex: undefined,
    date_of_birth: '',
    birth_weight_kg: undefined,
    birth_length_cm: undefined,
    gestational_age_weeks: undefined,
    birth_order: undefined,
    delivery_type: '',
    apgar_score_5min: undefined
  });

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

    // Basic Validation
    if (!formData.name?.trim()) return setError('Name is required');
    if (!formData.sex) return setError('Sex is required');
    if (!formData.date_of_birth) return setError('Date of birth is required');
    if (!formData.birth_weight_kg || formData.birth_weight_kg <= 0) return setError('Valid birth weight is required');
    
    if (new Date(formData.date_of_birth) > new Date()) {
      return setError('Date of birth cannot be in the future');
    }

    // Clean up optional fields before sending (removing empty strings, NaN, etc)
    const payload: BabyRegistrationRequest = {
      name: formData.name.trim(),
      sex: formData.sex as 'Male' | 'Female',
      date_of_birth: formData.date_of_birth,
      birth_weight_kg: Number(formData.birth_weight_kg),
    };

    if (formData.birth_length_cm) payload.birth_length_cm = Number(formData.birth_length_cm);
    if (formData.gestational_age_weeks) payload.gestational_age_weeks = Number(formData.gestational_age_weeks);
    if (formData.birth_order) payload.birth_order = Number(formData.birth_order);
    if (formData.delivery_type?.trim()) payload.delivery_type = formData.delivery_type.trim();
    if (formData.apgar_score_5min) payload.apgar_score_5min = Number(formData.apgar_score_5min);

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
          <form onSubmit={handleSubmit} aria-labelledby="baby-registration-heading" aria-describedby={error ? 'baby-registration-error' : 'baby-registration-description'} aria-busy={registerBabyMutation.isPending}>
            <CardContent className="space-y-8 p-5 sm:p-8">
              {error && (
                <div role="alert" id="baby-registration-error" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm leading-relaxed font-medium text-destructive">
                  {error}
                </div>
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
                      className={registrationControl}
                      aria-invalid={error === 'Name is required' || undefined}
                      aria-describedby={error === 'Name is required' ? 'baby-registration-error' : undefined}
                      placeholder="e.g. Emma" 
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sex">Biological Sex *</Label>
                    <Select 
                      value={formData.sex} 
                      onValueChange={v => setFormData({ ...formData, sex: v as any })}
                      required
                    >
                      <SelectTrigger id="sex" className={registrationControl} aria-invalid={error === 'Sex is required' || undefined} aria-describedby={error === 'Sex is required' ? 'baby-registration-error' : undefined}>
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Male" className="min-h-11 rounded-md">Male</SelectItem>
                        <SelectItem value="Female" className="min-h-11 rounded-md">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input 
                      id="dob" 
                      className={registrationControl}
                      aria-invalid={error.startsWith('Date of birth') || undefined}
                      aria-describedby={error.startsWith('Date of birth') ? 'baby-registration-error' : undefined}
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={formData.date_of_birth}
                      onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                      required
                    />
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
                      className={registrationControl}
                      aria-invalid={error === 'Valid birth weight is required' || undefined}
                      aria-describedby={error === 'Valid birth weight is required' ? 'baby-registration-error' : undefined}
                      type="number" 
                      step="0.01" 
                      min="0.5" 
                      max="10"
                      placeholder="e.g. 3.2" 
                      value={formData.birth_weight_kg || ''}
                      onChange={e => setFormData({ ...formData, birth_weight_kg: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="length">Birth Length (cm) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="length" 
                      className={registrationControl}
                      type="number" 
                      step="0.1" 
                      min="20"
                      max="80"
                      placeholder="e.g. 50" 
                      value={formData.birth_length_cm || ''}
                      onChange={e => setFormData({ ...formData, birth_length_cm: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gestational_age">Gestational Age (weeks) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="gestational_age" 
                      className={registrationControl}
                      type="number" 
                      min="20"
                      max="45"
                      placeholder="e.g. 39" 
                      value={formData.gestational_age_weeks || ''}
                      onChange={e => setFormData({ ...formData, gestational_age_weeks: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth_order">Birth Order <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="birth_order" 
                      className={registrationControl}
                      type="number" 
                      min="1"
                      placeholder="e.g. 1 (first child)" 
                      value={formData.birth_order || ''}
                      onChange={e => setFormData({ ...formData, birth_order: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_type">Delivery Type <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Select 
                      value={formData.delivery_type} 
                      onValueChange={v => setFormData({ ...formData, delivery_type: v })}
                    >
                      <SelectTrigger id="delivery_type" className={registrationControl}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Vaginal" className="min-h-11 rounded-md">Vaginal</SelectItem>
                        <SelectItem value="Caesarean" className="min-h-11 rounded-md">Caesarean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apgar">APGAR Score (5 min) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="apgar" 
                      className={registrationControl}
                      type="number" 
                      min="0"
                      max="10"
                      placeholder="e.g. 9" 
                      value={formData.apgar_score_5min || ''}
                      onChange={e => setFormData({ ...formData, apgar_score_5min: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </section>
            </CardContent>
            <CardFooter className="justify-end rounded-b-2xl border-t border-border/70 bg-secondary/30 px-5 py-5 sm:px-8 sm:py-6">
              <Button className="h-12 w-full rounded-lg px-7 md:w-auto md:min-w-[224px]" size="lg" type="submit" disabled={registerBabyMutation.isPending}>
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
