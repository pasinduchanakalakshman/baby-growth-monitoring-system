import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { ArrowRight, TrendingUp, Info } from 'lucide-react';
import { formatCalendarDate } from '@/utils/growthDisplay';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';

export default function GrowthForecastPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ['growth.overview'],
    queryFn: growthApi.getGrowthOverview
  });

  const { data: forecast, isLoading: forecastLoading, error: forecastError } = useQuery({
    queryKey: ['growth.forecast'],
    queryFn: growthApi.getGrowthForecast,
    enabled: !!overview?.current_growth
  });

  if (overviewLoading || (forecastLoading && overview?.current_growth)) {
    return <LoadingState />;
  }

  if (overviewError || forecastError) {
    return <ErrorStateUI message="We couldn't load the forecast right now. Please try again." />;
  }

  const hasNoData = !overview?.current_growth;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <PageHeader
        title="30-Day Forecast"
        description="See an estimated view of your child's growth around 30 days ahead based on their recorded growth history."
      />

      {hasNoData ? (
        <EmptyState
          icon={TrendingUp}
          title="No measurements available."
          description="Add a growth measurement before viewing a forecast."
        />
      ) : forecast && !forecast.forecast_available ? (
        <EmptyState
          icon={TrendingUp}
          title="Forecast not available yet."
          description={forecast.reason || "More recorded growth visits are needed before a forecast can be generated."}
          testId="unavailable-forecast-state"
        />
      ) : forecast && forecast.forecast_available ? (
        <div className="space-y-6" data-testid="forecast-available-state">
          
          <div className="bg-white border rounded-2xl shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
            
            <div className="pl-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                
                {/* Current */}
                <div className="flex-1 bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Current</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500">Weight</p>
                      <p className="text-2xl font-bold text-slate-900">{overview.current_growth?.weight_kg?.toFixed(2) || 'N/A'} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Weight-for-age score</p>
                      <p className="text-lg font-medium text-slate-700">{overview.current_growth?.waz?.toFixed(2) || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex justify-center items-center px-4">
                  <ArrowRight className="h-8 w-8 text-indigo-300" />
                </div>

                {/* Approx 30 Days */}
                <div className="flex-1 bg-indigo-50/50 rounded-xl p-6 border border-indigo-100">
                  <h3 className="text-sm font-semibold text-indigo-700 uppercase tracking-wider mb-4">
                    Approx. {forecast.nominal_horizon_days || 30} Days
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-indigo-600/80">Estimated Weight</p>
                      <p className="text-2xl font-bold text-indigo-900">
                        {forecast.estimated_future_weight_kg !== undefined && forecast.estimated_future_weight_kg !== null 
                          ? `${forecast.estimated_future_weight_kg.toFixed(2)} kg` 
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600/80">Estimated Weight-for-age score</p>
                      <p className="text-lg font-medium text-indigo-800">
                        {forecast.estimated_future_waz !== undefined && forecast.estimated_future_waz !== null 
                          ? forecast.estimated_future_waz.toFixed(2) 
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {forecast.estimated_weight_change_kg !== undefined && forecast.estimated_weight_change_kg !== null && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${forecast.estimated_weight_change_kg > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Expected Weight Change: {forecast.estimated_weight_change_kg > 0 ? '+' : ''}{forecast.estimated_weight_change_kg.toFixed(2)} kg
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <ResearchDisclaimer />
        </div>
      ) : null}
    </div>
  );
}
