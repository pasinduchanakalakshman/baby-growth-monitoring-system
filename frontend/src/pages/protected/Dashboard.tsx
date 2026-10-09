import { useAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Info, Baby, LineChart, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { babyApi } from '@/api/baby';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: baby } = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile,
    staleTime: Infinity // Rarely changes
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {user?.name || 'Mother'}</h1>
        <p className="text-slate-500">Monitor {baby?.name || "your baby"}'s growth and health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <Card className="border-primary/20 shadow-sm bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Baby className="h-5 w-5 text-primary" />
              {baby?.name || 'Baby Profile'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Registered on {baby?.date_of_birth}. View full birth parameters.
            </CardDescription>
            <Button variant="default" className="w-full" asChild>
              <Link to="/baby">View Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Growth Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Track growth, view 30-day forecasts, and assess 180-day growth-faltering risk.
            </CardDescription>
            <Button variant="outline" className="w-full" disabled>
              Available in Stage 16C
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Add Measurement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Enter new weight and length to update WHO scores and ML predictions.
            </CardDescription>
            <Button variant="outline" className="w-full" disabled>
              Available in Stage 16C
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-sm text-amber-900 mt-8">
        <Info className="h-5 w-5 flex-shrink-0 text-amber-600" />
        <p>
          <strong>Research System Disclaimer:</strong> This system provides research-based growth estimates and risk assessments and is not a medical diagnosis. Always consult with a healthcare professional for medical advice.
        </p>
      </div>
    </div>
  );
}
