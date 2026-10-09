import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import GrowthCharts from '@/features/growth/components/GrowthCharts';
import { LineChart as LineChartIcon, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';

export default function GrowthChartsPage() {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['growth.history'],
    queryFn: growthApi.getGrowthHistory
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorStateUI message="We couldn't load growth charts right now. Please try again." />;
  }

  if (!history || history.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
        <PageHeader
          title="Detailed Growth Charts"
        />
        <EmptyState
          icon={LineChartIcon}
          title="No measurements yet"
          description="Growth charts require measurement history. Add your first measurement to start tracking."
          action={
            <Link
              to="/growth/add"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-xl font-medium transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Measurement
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <PageHeader
        title="Detailed Growth Charts"
        description="Longitudinal visualization of actual measurement history."
        actions={
          <Link
            to="/growth"
            className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm text-sm"
          >
            Back to Overview
          </Link>
        }
      />

      <div className="mt-8">
        <GrowthCharts history={history} />
      </div>
      
      <ResearchDisclaimer />
    </div>
  );
}
