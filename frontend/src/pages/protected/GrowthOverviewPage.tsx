import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { formatCalendarDate, getWhoStatusFromZScore } from '@/utils/growthDisplay';
import GrowthCharts from '@/features/growth/components/GrowthCharts';
import { Activity, Plus, Scale, Ruler, FileText, LineChart } from 'lucide-react';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';

export default function GrowthOverviewPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['growth.overview'],
    queryFn: growthApi.getGrowthOverview
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['growth.history'],
    queryFn: growthApi.getGrowthHistory
  });

  if (isLoading || historyLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorStateUI message="We couldn't load growth data right now. Please try again." />;
  }

  const hasData = overview?.current_growth && history && history.length > 0;
  const current = overview?.current_growth;

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
            <button
              onClick={() => navigate('/growth/add')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Measurement
            </button>
          </>
        }
      />

      {!hasData ? (
        <EmptyState
          icon={Activity}
          title="No growth measurements recorded yet."
          description="You haven't recorded any growth measurements for your baby yet. Add your first measurement to start tracking their growth."
          action={
            <button
              onClick={() => navigate('/growth/add')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-xl font-medium transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add First Measurement
            </button>
          }
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Latest Measurement Card */}
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Latest Measurement</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b pb-2">
                  <span className="text-sm text-slate-600">Date</span>
                  <span className="font-semibold text-slate-900">{formatCalendarDate(current?.visit_date)}</span>
                </div>
                <div className="flex justify-between items-end border-b pb-2">
                  <span className="text-sm text-slate-600 flex items-center gap-1"><Scale className="h-4 w-4" /> Weight</span>
                  <span className="font-bold text-lg text-slate-900">{current?.weight_kg} kg</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-sm text-slate-600 flex items-center gap-1"><Ruler className="h-4 w-4" /> Height</span>
                  <span className="font-bold text-slate-900">
                    {current?.length_height_cm ? `${current.length_height_cm} cm` : <span className="text-slate-400 font-normal text-sm italic">Not recorded</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-card border rounded-xl p-5 shadow-sm md:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Current WHO Growth Status</h3>
                
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 border">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Weight-for-age score <span className="font-normal text-slate-400 normal-case">(WAZ)</span></p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900">
                        {current?.waz !== undefined && current?.waz !== null ? current.waz.toFixed(2) : 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 font-medium">
                      {getWhoStatusFromZScore(current?.waz)}
                    </p>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-3 border">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Height-for-age score <span className="font-normal text-slate-400 normal-case">(HAZ)</span></p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900">
                        {current?.haz !== undefined && current?.haz !== null ? current.haz.toFixed(2) : <span className="text-base text-slate-400 italic">Not available</span>}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 font-medium">
                      {current?.length_height_cm 
                        ? getWhoStatusFromZScore(current?.haz) 
                        : "Length/height was not recorded for this visit."}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                Weight-for-age compares your child's weight with WHO growth standards for children of the same age and sex.
              </p>
            </div>
          </div>

          {/* Charts Section */}
          {history.length > 1 ? (
             <GrowthCharts history={history} />
          ) : (
            <div className="bg-slate-50 border border-dashed rounded-xl p-8 text-center">
              <h4 className="font-medium text-slate-800">More visits are needed to show a growth trend</h4>
              <p className="text-sm text-slate-500 mt-1">Add another measurement in the future to see longitudinal growth charts.</p>
              <div className="mt-6 max-w-sm mx-auto opacity-50 pointer-events-none grayscale">
                <GrowthCharts history={history} />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <button
              onClick={() => navigate('/growth/forecast')}
              className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 px-6 py-6 rounded-2xl font-medium transition-colors shadow-sm flex flex-col justify-center items-center text-center gap-2"
            >
              <span className="text-lg">30-Day Forecast</span>
              <span className="text-sm text-indigo-600/70 font-normal">Short-term weight estimate</span>
            </button>
            <button
              onClick={() => navigate('/growth/risk')}
              className="bg-amber-50 border border-amber-100 hover:bg-amber-100 text-amber-700 px-6 py-6 rounded-2xl font-medium transition-colors shadow-sm flex flex-col justify-center items-center text-center gap-2"
            >
              <span className="text-lg">Early Growth Risk</span>
              <span className="text-sm text-amber-600/70 font-normal">180-day faltering likelihood</span>
            </button>
          </div>

          <ResearchDisclaimer />
        </>
      )}
    </div>
  );
}
