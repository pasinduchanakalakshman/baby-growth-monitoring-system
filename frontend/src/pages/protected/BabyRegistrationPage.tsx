import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Baby, Loader2, Info } from 'lucide-react';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';
import { BabyRegistrationRequest } from '@/types/baby';

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
    <div className="min-h-dvh flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#F8F9FB]">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center items-center gap-2">
          <Baby className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Baby Growth</span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Welcome! Let's set up your baby's profile
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 max-w">
          Enter your baby's birth details to enable personalized growth monitoring and WHO-standard assessments.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <Card className="shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Baby's Name *</Label>
                    <Input 
                      id="name" 
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
                      <SelectTrigger id="sex">
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input 
                      id="dob" 
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={formData.date_of_birth}
                      onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Birth Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Birth Weight (kg) *</Label>
                    <Input 
                      id="weight" 
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
                      <SelectTrigger id="delivery_type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vaginal">Vaginal</SelectItem>
                        <SelectItem value="Caesarean">Caesarean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apgar">APGAR Score (5 min) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      id="apgar" 
                      type="number" 
                      min="0"
                      max="10"
                      placeholder="e.g. 9" 
                      value={formData.apgar_score_5min || ''}
                      onChange={e => setFormData({ ...formData, apgar_score_5min: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col border-t p-6 bg-slate-50 gap-4">
              <Button className="w-full md:w-auto md:min-w-[200px] self-end" size="lg" type="submit" disabled={registerBabyMutation.isPending}>
                {registerBabyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving profile...
                  </>
                ) : (
                  'Complete Registration'
                )}
              </Button>
              <div className="flex gap-2 text-sm text-slate-500 items-start w-full">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>Ensure these details are accurate, as they form the baseline for WHO growth standard calculations and risk assessments.</p>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
