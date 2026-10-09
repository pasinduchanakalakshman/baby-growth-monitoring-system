import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { ShieldAlert, AlertCircle, Info, ChevronRight, Activity, ActivitySquare } from 'lucide-react';
import { formatCalendarDate } from '@/utils/growthDisplay';

export default function RiskLatestPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ['growth.overview'],
    queryFn: growthApi.getGrowthOverview
  });

  const { data: risk, isLoading: riskLoading, error: riskError } = useQuery({
    queryKey: ['risk.latest'],
    queryFn: growthApi.getLatestRisk,
    enabled: !!overview?.current_growth
  });

  const { data: modelInfo, isLoading: modelLoading } = useQuery({
    queryKey: ['model.info'],
    queryFn: growthApi.getModelInfo
  });

  if (overviewLoading || (riskLoading && overview?.current_growth) || modelLoading) {
    return (
      <div className="flex items-center justify-center p-12" data-testid="loading-state">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (overviewError || riskError) {
    return (
      <div className="p-4 max-w-4xl mx-auto" data-testid="error-state">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load risk assessment data. Please try again.</p>
        </div>
      </div>
    );
  }

  const hasNoData = !overview?.current_growth;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Early Growth Risk</h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            Review the model's current estimate of growth-faltering risk over the next 180 days based on your child's recorded growth history.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/growth/risk/history')}
            className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-md font-medium transition-colors shadow-sm text-sm inline-flex items-center gap-2"
          >
            <ActivitySquare className="h-4 w-4" />
            Risk History
          </button>
          {risk?.risk_available && (
            <button
              onClick={() => navigate('/growth/explanation')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <Info className="h-4 w-4" />
              Why This Risk?
            </button>
          )}
        </div>
      </div>

      {hasNoData ? (
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center" data-testid="no-data-state">
          <div className="flex justify-center mb-4">
            <Activity className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Add a growth measurement before viewing a risk assessment.</h3>
        </div>
      ) : risk && !risk.risk_available ? (
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center" data-testid="unavailable-risk-state">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">
            Risk assessment is not available for the current record.
          </h3>
          {risk.reason && <p className="text-slate-500 mt-2">{risk.reason}</p>}
        </div>
      ) : risk && risk.risk_available ? (
        <div className="space-y-6" data-testid="risk-available-state">
          
          <div className="bg-white border rounded-xl shadow-sm p-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-2 h-full ${risk.risk_flag === 1 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
            <div className="pl-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">Latest Assessment</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Model-estimated Risk</p>
                  <p className="text-4xl font-bold text-slate-900">
                    {risk.risk_probability !== undefined && risk.risk_probability !== null 
                      ? `${(risk.risk_probability * 100).toFixed(0)}%` 
                      : 'N/A'}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    probability of the defined {risk.prediction_horizon_days || 180}-day growth-faltering outcome.
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-slate-500 mb-1">Assessment Date</p>
                  <p className="text-xl font-medium text-slate-900">
                    {formatCalendarDate(overview.current_growth?.visit_date)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500 mb-1">Risk Category</p>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                    risk.risk_flag === 1 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {risk.risk_flag === 1 ? 'Elevated Risk' : 'Standard Risk'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border rounded-lg p-5">
            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Info className="h-5 w-5 text-slate-500" />
              About the Model
            </h4>
            <div className="space-y-2 text-sm text-slate-600">
              <p><strong>Research Model:</strong> {modelInfo?.Risk?.model || 'XGBoost v1'} (Primary)</p>
              <p><strong>Monitoring Horizon:</strong> {modelInfo?.Risk?.horizon_days || 180} days</p>
              <p><strong>Interpretation:</strong> This is decision-support information based on genuine growth visits, not a clinical diagnosis or guaranteed future outcome.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-500">
                {modelInfo?.Disclaimers?.map((disc, idx) => (
                  <li key={idx}>{disc}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
