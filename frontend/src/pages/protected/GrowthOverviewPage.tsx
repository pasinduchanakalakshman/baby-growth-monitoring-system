import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { formatCalendarDate, getWhoStatusFromZScore } from '@/utils/growthDisplay';
import GrowthCharts from '@/features/growth/components/GrowthCharts';
import { Activity, Plus, Scale, Ruler, AlertCircle } from 'lucide-react';

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
          <p>Failed to load growth data. Please try again.</p>
        </div>
      </div>
    );
  }

  const hasData = overview?.current_growth && history && history.length > 0;
  const current = overview?.current_growth;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Growth Monitoring</h1>
          <p className="text-slate-500 mt-2">
            {overview?.baby?.name ? `${overview.baby.name}'s Growth Dashboard` : "Your baby's growth overview"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/growth/history')}
            className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-md font-medium transition-colors shadow-sm text-sm"
          >
            History List
          </button>
          <button
            onClick={() => navigate('/growth/charts')}
            className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-md font-medium transition-colors shadow-sm text-sm"
          >
            Detailed Charts
          </button>
          <button
            onClick={() => navigate('/growth/add')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Measurement
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <Activity className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">No growth measurements recorded yet.</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            You haven't recorded any growth measurements for your baby yet. Add your first measurement to start tracking their growth.
          </p>
          <button
            onClick={() => navigate('/growth/add')}
            className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-md font-medium transition-colors shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add First Measurement
          </button>
        </div>
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
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Weight-for-Age (WAZ)</p>
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
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Length/Height-for-Age (HAZ)</p>
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
                WAZ compares your child's weight with WHO growth standards for children of the same age and sex.
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
          
          <div className="text-xs text-slate-400 text-center max-w-xl mx-auto pt-4 border-t">
            <p>Growth indicators are research-based monitoring information and do not replace assessment by a qualified healthcare professional.</p>
          </div>
        </>
      )}
    </div>
  );
}
