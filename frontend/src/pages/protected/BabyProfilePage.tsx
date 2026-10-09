import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Baby, Info, Calendar, Weight, Ruler, Activity, Loader2 } from 'lucide-react';
import { babyApi } from '@/api/baby';

export default function BabyProfilePage() {
  const { data: baby, isLoading, error } = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile,
    retry: false
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !baby) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-slate-500">
        <Baby className="h-12 w-12 mb-4 text-slate-300" />
        <p>No baby profile found or unable to load.</p>
      </div>
    );
  }

  const calculateAge = (dob: string) => {
    const diff = new Date().getTime() - new Date(dob).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 30) return `${days} days old`;
    const months = Math.floor(days / 30.436875);
    if (months < 12) return `${months} months old`;
    return `${Math.floor(months / 12)} years, ${months % 12} months`;
  };

  const displayValue = (val: any) => {
    if (val === null || val === undefined) return 'Not recorded';
    return val;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Baby Profile</h1>
        <p className="text-slate-500">View your baby's identity and birth parameters.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-sm h-fit">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Baby className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">{baby.name}</CardTitle>
            <CardDescription className="text-base font-medium text-slate-700">
              {baby.sex}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 border">
              <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">Current Age</p>
              <p className="text-lg font-semibold text-primary">{calculateAge(baby.date_of_birth)}</p>
              <p className="text-xs text-slate-400 mt-1">UX display only</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Birth Parameters</CardTitle>
            <CardDescription>
              Baseline information used for WHO assessments and ML inference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
              
              <div className="flex gap-3">
                <div className="bg-blue-50 p-2 rounded-md h-fit">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Date of Birth</p>
                  <p className="font-semibold text-slate-900">{baby.date_of_birth}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-indigo-50 p-2 rounded-md h-fit">
                  <Weight className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Birth Weight</p>
                  <p className="font-semibold text-slate-900">{baby.birth_weight_kg} kg</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-emerald-50 p-2 rounded-md h-fit">
                  <Ruler className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Birth Length</p>
                  <p className="font-semibold text-slate-900">
                    {baby.birth_length_cm ? `${baby.birth_length_cm} cm` : 'Not recorded'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-amber-50 p-2 rounded-md h-fit">
                  <Activity className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Gestational Age</p>
                  <p className="font-semibold text-slate-900">
                    {baby.gestational_age_weeks ? `${baby.gestational_age_weeks} weeks` : 'Not recorded'}
                  </p>
                </div>
              </div>

            </div>

            <div className="border-t pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 font-medium">Birth Order</p>
                <p className="text-sm font-medium text-slate-900">{displayValue(baby.birth_order)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Delivery Type</p>
                <p className="text-sm font-medium text-slate-900">{displayValue(baby.delivery_type)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">APGAR Score (5m)</p>
                <p className="text-sm font-medium text-slate-900">{displayValue(baby.apgar_score_5min)}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 border-t flex justify-between p-4 rounded-b-xl">
            <Button variant="outline" disabled>
              Edit Profile (Stage 16C)
            </Button>
            <div className="flex items-center gap-2 text-xs text-amber-700 font-medium bg-amber-100/50 px-3 py-1.5 rounded-full border border-amber-200">
              <Info className="h-3.5 w-3.5" />
              Profile is read-only
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
