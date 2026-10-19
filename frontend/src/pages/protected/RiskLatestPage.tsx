import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { ShieldAlert, Info, ActivitySquare } from 'lucide-react';
import { formatCalendarDate } from '@/utils/growthDisplay';
import { 
  formatRiskScore, 
  getScreeningStatus, 
  isScreeningElevated, 
  RESEARCH_SCREENING_THRESHOLD, 
  RISK_DISCLAIMER_TEXT 
} from '@/utils/riskDisplay';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';

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
    return <LoadingState />;
  }

  if (overviewError || riskError) {
    return <ErrorStateUI message="We couldn't load this information right now. Please try again." />;
  }

  const hasNoData = !overview?.current_growth;

  const score = risk?.risk_score ?? risk?.risk_probability;
  const threshold = risk?.risk_threshold ?? modelInfo?.Risk?.threshold ?? RESEARCH_SCREENING_THRESHOLD;
  const isElevated = risk?.risk_flag !== undefined && risk?.risk_flag !== null
    ? risk.risk_flag === 1
    : isScreeningElevated(score, threshold);
  const screeningStatus = risk?.screening_status || getScreeningStatus(score, threshold);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
      <PageHeader
        title="Early Growth Risk"
        description="Experimental AI screening score based on your child's recorded growth history."
        actions={
          <>
            <button
              onClick={() => navigate('/growth/risk/history')}
              className="border bg-background hover:bg-slate-50 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm text-sm inline-flex items-center gap-2 text-slate-700"
            >
              <ActivitySquare className="h-4 w-4 text-slate-500" />
              View Risk History
            </button>
            {risk?.risk_available && (
              <button
                onClick={() => navigate('/growth/explanation')}
                className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
              >
                <Info className="h-4 w-4" />
                Why This Risk?
              </button>
            )}
          </>
        }
      />

      <div className="space-y-8 mt-8">
        {hasNoData ? (
          <EmptyState
            icon={ShieldAlert}
            title="Add a growth measurement before viewing a risk assessment."
          />
        ) : risk && !risk.risk_available ? (
          <EmptyState
            icon={ShieldAlert}
            title="Risk assessment is not available for the current record."
            description={risk.reason || undefined}
            testId="unavailable-risk-state"
          />
        ) : risk && risk.risk_available ? (
          <div className="space-y-8" data-testid="risk-available-state">
            <div className="bg-white border rounded-2xl shadow-sm p-8 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-2 h-full ${isElevated ? 'bg-amber-400' : 'bg-slate-300'}`}></div>
              <div className="pl-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      180-Day Growth-Faltering Risk Score
                    </h3>
                    <div className="flex items-baseline gap-3 mt-4">
                      <span className="text-sm font-medium text-slate-500">Risk score:</span>
                      <span className="text-6xl font-bold text-slate-900 tracking-tight" data-testid="risk-score-value">
                        {formatRiskScore(score)}
                      </span>
                    </div>
                    
                    <div className="mt-4">
                      <span 
                        data-testid="screening-status-badge"
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          isElevated 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {screeningStatus}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mt-6 leading-relaxed">
                      {RISK_DISCLAIMER_TEXT}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      Research screening threshold: {threshold.toFixed(3)}. Scores at or above this threshold indicate elevated screening risk for research observation.
                    </p>
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col justify-center space-y-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Based on measurements up to:</p>
                      <p className="text-lg font-medium text-slate-900">
                        {formatCalendarDate(overview.current_growth?.visit_date)}
                      </p>
                    </div>

                    {risk.component_scores && (
                      <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                        <div className="font-medium text-slate-600">Model Components (0.90 / 0.10 Hybrid):</div>
                        <div>Standard XGBoost Score: {formatRiskScore(risk.component_scores.xgboost_probability)} (Weight: 0.90)</div>
                        <div>Clean Transformer Score: {formatRiskScore(risk.component_scores.transformer_probability)} (Weight: 0.10)</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <ResearchDisclaimer />
      </div>
    </div>
  );
}
