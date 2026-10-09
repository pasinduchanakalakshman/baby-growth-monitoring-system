import React from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Info, Baby, LineChart, PlusCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {user?.name || 'Mother'}</h1>
        <p className="text-slate-500">Monitor your baby's growth and health.</p>
      </div>

      {/* Baby Status Placeholder */}
      <Card className="border-dashed border-2 bg-slate-50">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Baby className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Baby profile setup will continue in the next step.</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            (Stage 16A foundation completed. Baby registration and data fetching will be implemented in Stage 16B.)
          </p>
          <Button disabled>
            <PlusCircle className="h-4 w-4 mr-2" />
            Register Baby
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Baby className="h-5 w-5 text-primary" />
              Baby Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              View and manage your baby's details, birth parameters, and history.
            </CardDescription>
            <Button variant="outline" className="w-full" asChild>
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
            <Button variant="outline" className="w-full" asChild>
              <Link to="/growth">View Dashboard</Link>
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
