import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { Activity, Plus, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { formatCalendarDate } from '@/utils/growthDisplay';

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
    return (
      <div className="flex items-center justify-center p-12" data-testid="loading-state">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (overviewError || forecastError) {
    return (
      <div className="p-4 max-w-4xl mx-auto" data-testid="error-state">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load forecast data. Please try again.</p>
        </div>
      </div>
    );
  }

  const hasNoData = !overview?.current_growth;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">30-Day Growth Forecast</h1>
        <p className="text-slate-500 mt-2">
          See an estimated view of your child's growth around 30 days ahead based on their recorded growth history.
        </p>
      </div>

      {hasNoData ? (
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center" data-testid="no-data-state">
          <div className="flex justify-center mb-4">
            <Activity className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Add a growth measurement before viewing a forecast.</h3>
          <button
            onClick={() => navigate('/growth/add')}
            className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-md font-medium transition-colors shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Measurement
          </button>
        </div>
      ) : forecast && !forecast.forecast_available ? (
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center" data-testid="insufficient-history-state">
          <div className="flex justify-center mb-4">
            <TrendingUp className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">
            {forecast.reason || "More recorded growth visits are needed before a forecast can be generated."}
          </h3>
        </div>
      ) : forecast && forecast.forecast_available ? (
        <div className="space-y-6" data-testid="forecast-available-state">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current State */}
            <div className="bg-white border rounded-xl shadow-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">Current</h3>
              
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Latest visit date</p>
                  <p className="font-medium text-slate-900">{formatCalendarDate(overview.current_growth?.visit_date)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Weight</p>
                    <p className="text-2xl font-bold text-slate-900">{overview.current_growth?.weight_kg?.toFixed(2)} <span className="text-base font-normal text-slate-500">kg</span></p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">WAZ</p>
                    <p className="text-2xl font-bold text-slate-900">{overview.current_growth?.waz !== undefined && overview.current_growth?.waz !== null ? overview.current_growth.waz.toFixed(2) : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Forecast State */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl shadow-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-6">
                Approximately {forecast.nominal_horizon_days || 30} Days Ahead
              </h3>
              
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Expected weight change</p>
                  <p className="font-medium text-blue-700">
                    {forecast.estimated_weight_change_kg !== undefined && forecast.estimated_weight_change_kg !== null 
                      ? `${forecast.estimated_weight_change_kg > 0 ? '+' : ''}${forecast.estimated_weight_change_kg.toFixed(2)} kg` 
                      : 'N/A'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Estimated weight</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {forecast.estimated_future_weight_kg !== undefined && forecast.estimated_future_weight_kg !== null 
                        ? forecast.estimated_future_weight_kg.toFixed(2) 
                        : 'N/A'} <span className="text-base font-normal text-blue-700/70">kg</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Estimated WAZ</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {forecast.estimated_future_waz !== undefined && forecast.estimated_future_waz !== null 
                        ? forecast.estimated_future_waz.toFixed(2) 
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border rounded-lg p-4 flex gap-3 text-sm text-slate-600">
            <Info className="h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <p className="font-medium text-slate-700 mb-1">About this forecast</p>
              <p>This forecast is a research-based estimate and is not a medical diagnosis or a guarantee of future growth. It is built using genuine follow-up observations and estimates growth around 30 days ahead based on recorded history.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
