import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import GrowthCharts from '@/features/growth/components/GrowthCharts';
import { AlertCircle, LineChart as LineChartIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GrowthChartsPage() {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['growth.history'],
    queryFn: growthApi.getGrowthHistory
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load growth charts. Please try again.</p>
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">Detailed Growth Charts</h1>
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <LineChartIcon className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">No measurements yet</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            Growth charts require measurement history. Add your first measurement to start tracking.
          </p>
          <Link
            to="/growth/add"
            className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-md font-medium transition-colors shadow-sm inline-flex items-center gap-2"
          >
            Add Measurement
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Detailed Growth Charts</h1>
          <p className="text-slate-500 mt-2">
            Longitudinal visualization of actual measurement history.
          </p>
        </div>
        <Link
          to="/growth"
          className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          Back to Overview
        </Link>
      </div>

      <GrowthCharts history={history} />
      
      <div className="text-xs text-slate-400 text-center max-w-xl mx-auto pt-4 border-t">
        <p>Growth indicators are research-based monitoring information and do not replace assessment by a qualified healthcare professional.</p>
      </div>
    </div>
  );
}
