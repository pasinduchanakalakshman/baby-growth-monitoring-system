import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import NewbornWeightJourneyChart from '@/features/growth/components/NewbornWeightJourneyChart';
import { useNewbornWeightJourney } from '@/features/growth/useNewbornWeightJourney';
import { babyApi } from '@/api/baby';
import { Activity, Plus, FileText, LineChart } from 'lucide-react';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';

export default function GrowthOverviewPage() {
  const navigate = useNavigate();
  const { data: baby, isLoading: profileLoading, error: profileError, refetch: profileQueryRetry } = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile,
    retry: false,
  });
  const journeyQuery = useNewbornWeightJourney(baby, !profileError);
  const journey = <NewbornWeightJourneyChart
    showSupportingDetails={false}
    journey={journeyQuery.data}
    isLoading={profileLoading || journeyQuery.isLoading}
    error={!!profileError || journeyQuery.isError}
    onRetry={() => { if (profileError) void profileQueryRetry(); else void journeyQuery.refetch(); }}
  />;
  const birthDate = baby?.date_of_birth ? new Date(`${baby.date_of_birth}T00:00:00`) : null;
  const today = new Date();
  const ageDays = birthDate ? Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())) / 86400000) : null;
  const isNewborn = ageDays !== null && ageDays >= 0 && ageDays <= 30;

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['growth.overview'],
    queryFn: growthApi.getGrowthOverview
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['growth.history'],
    queryFn: growthApi.getGrowthHistory
  });

  if (isLoading || historyLoading) {
    return <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">{journey}<LoadingState /></div>;
  }

  if (error) {
    return <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">{journey}<ErrorStateUI message="We couldn't load growth data right now. Please try again." /></div>;
  }

  const hasData = overview?.current_growth && history && history.length > 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <PageHeader
        title="Growth Monitoring"
        description={overview?.baby?.name ? `${overview.baby.name}'s Growth Dashboard` : "Your baby's growth overview"}
        actions={
          <>
            <button
              onClick={() => navigate('/growth/history')}
              className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm text-sm text-slate-700 inline-flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-slate-500" />
              History List
            </button>
            <button
              onClick={() => navigate('/growth/charts')}
              className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm text-sm text-slate-700 inline-flex items-center gap-2"
            >
              <LineChart className="h-4 w-4 text-slate-500" />
              Detailed Charts
            </button>
            {!isNewborn && <button
              onClick={() => navigate('/growth/add')}
              className="bg-btn-primary text-btn-primary-foreground hover:bg-btn-primary-hover active:bg-btn-primary-active px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btn-primary"
            >
              <Plus className="h-4 w-4" />
              Add Measurement
            </button>}
          </>
        }
      />

      {journey}

      {!hasData ? (
        <EmptyState
          icon={Activity}
          title="No growth measurements recorded yet."
          description={isNewborn ? "The newborn weight journey above uses the birth weight from registration. No extra weight entries are needed to view it." : "You haven't recorded any growth measurements for your baby yet. Add your first measurement to start tracking their growth."}
          action={!isNewborn && (
            <button
              onClick={() => navigate('/growth/add')}
              className="bg-btn-primary text-btn-primary-foreground hover:bg-btn-primary-hover active:bg-btn-primary-active px-6 py-2 rounded-xl font-medium transition-colors shadow-sm inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btn-primary"
            >
              <Plus className="h-4 w-4" />
              Add First Measurement
            </button>
          )}
        />
      ) : (
        <ResearchDisclaimer />
      )}
    </div>
  );
}
