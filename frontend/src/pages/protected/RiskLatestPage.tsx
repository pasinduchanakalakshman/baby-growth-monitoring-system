import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  History,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Activity,
  HeartHandshake
} from 'lucide-react';
import { growthApi } from '@/api/growth';
import { formatCalendarDate } from '@/utils/growthDisplay';
import {
  formatRiskScore,
  getScreeningStatus,
  isScreeningElevated,
  RESEARCH_SCREENING_THRESHOLD
} from '@/utils/riskDisplay';
import {
  getRecordedVisitCount,
  getMatchedScreeningStatus,
  analyzeWeightHistory,
  analyzeWazComparison,
  analyzeForecastComparison,
  buildIntegratedGrowthStory,
  getWeightRelatedFactors
} from '@/utils/explanationDisplay';
import type { GrowthHistoryPoint, Forecast30Day } from '@/types/growth';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';
import WeightHistoryChart from '@/features/growth/components/WeightHistoryChart';
import { shortDate } from '@/features/dashboard/dashboardDisplay';

function readableGrowthDates(text: string) {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, date => shortDate(date) ?? date);
}

export default function RiskLatestPage() {
  const navigate = useNavigate();
  const location = useLocation();

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

  // Query explanation data together on the combined page
  const { data: explanationData, isLoading: explanationLoading } = useQuery({
    queryKey: ['risk.explanation', overview?.baby?.id],
    queryFn: async ({ signal }) => {
      const explanation = await growthApi.getRiskExplanation(signal);
      let history: GrowthHistoryPoint[] = [];
      let forecast: Forecast30Day | null = null;

      if (!signal.aborted) {
        try {
          if (typeof growthApi.getGrowthHistory === 'function') {
            history = await growthApi.getGrowthHistory();
          }
        } catch {
          history = [];
        }
      }

      if (!signal.aborted) {
        try {
          if (typeof growthApi.getGrowthForecast === 'function') {
            forecast = await growthApi.getGrowthForecast();
          }
        } catch {
          forecast = null;
        }
      }

      return { explanation, history, forecast };
    },
    enabled: !!overview?.current_growth && !!risk?.risk_available,
    retry: false
  });

  const scrollToExplanation = () => {
    const el = document.getElementById('why-this-risk-assessment');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (location.hash === '#why-this-risk-assessment' || location.hash === '#explanation') {
      const timer = setTimeout(() => {
        scrollToExplanation();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.hash, risk]);

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

  // Explanation computations
  const explanation = explanationData?.explanation;
  const history = explanationData?.history ?? [];
  const forecast = explanationData?.forecast ?? null;
  const visitCount = explanation ? getRecordedVisitCount(explanation) : null;
  const matchedStatus = explanation ? getMatchedScreeningStatus(explanation, risk) : null;
  const effectiveStatus = matchedStatus ?? (isElevated ? 'elevated' : 'below');
  const weightAnalysis = explanation ? analyzeWeightHistory(history, explanation) : null;
  const wazComparison = explanation ? analyzeWazComparison(history, explanation) : null;
  const forecastComparison = analyzeForecastComparison(forecast);

  const weightFactors = explanation ? getWeightRelatedFactors(explanation, effectiveStatus) : [];

  const story = weightAnalysis && wazComparison
    ? buildIntegratedGrowthStory(weightAnalysis, wazComparison, effectiveStatus, weightFactors, forecastComparison)
    : null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-8" data-testid="combined-risk-page">
      <PageHeader
        title="Growth Risk & Insights"
        description="Understand your baby's growth assessment and the information behind it."
        actions={
            <Button
              variant="outline"
              onClick={() => navigate('/growth/risk/history')}
              className="min-h-12 shrink-0 gap-3 rounded-xl border-primary/20 bg-card px-4 py-3 font-semibold text-primary hover:bg-primary/5 hover:text-primary"
            >
              <History aria-hidden="true" className="size-5" />
              View Risk History
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
        }
      />

      <div className="space-y-8">
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
            {/* FIRST SECTION — GROWTH RISK ASSESSMENT */}
            <div className="bg-white border rounded-2xl shadow-sm p-6 md:p-8 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-2 h-full ${isElevated ? 'bg-amber-400' : 'bg-slate-300'}`}></div>
              <div className="pl-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Growth-Faltering Risk Score
                    </h2>
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

                  </div>
                  
                  <div className="flex items-center gap-4 rounded-2xl border border-primary/10 bg-secondary/50 p-5 sm:p-6">
                    <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                      <CalendarDays className="size-6" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-muted-foreground">Latest measurement</h3>
                      <p className="mt-1 text-xl font-semibold leading-snug tracking-tight text-foreground">
                        <time dateTime={overview?.current_growth?.visit_date ?? undefined}>{formatCalendarDate(overview?.current_growth?.visit_date)}</time>
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Used for this risk assessment</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECOND SECTION — RISK EXPLANATION */}
            <div id="why-this-risk-assessment" className="space-y-6 pt-4 border-t border-slate-200/80" data-testid="explanation-section">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Why This Risk Assessment?</h2>
                  <p className="text-sm text-slate-500">
                    How recorded measurements and growth indicators informed this screening.
                  </p>
                </div>
              </div>

              {explanationLoading ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-500 text-center" data-testid="explanation-loading">
                  Loading growth assessment explanation...
                </div>
              ) : !explanation ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-600" data-testid="explanation-unavailable">
                  <p className="font-medium text-slate-800">Growth explanation is currently unavailable</p>
                  <p className="text-xs text-slate-500 mt-1">
                    We cannot show detailed explanation factors right now, but your baby&apos;s risk score above remains confirmed.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Subsection A: Your Baby's Growth Assessment */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                        <Activity className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">A. Your Baby&apos;s Growth Assessment</h3>
                    </div>

                    <div data-testid="screening-summary" className={`rounded-xl p-4 border space-y-2.5 ${
                      isElevated ? 'bg-amber-50/60 border-amber-200 text-amber-950' : 'bg-slate-50 border-slate-100 text-slate-700'
                    }`}>
                      <p className="font-semibold text-base">
                        {isElevated
                          ? 'Closer growth monitoring may be helpful'
                          : 'Continue regular growth checks'}
                      </p>
                      <p className="text-sm leading-relaxed">
                        {isElevated
                          ? "Your baby's recorded growth information has triggered an early screening alert for possible growth difficulties."
                          : "Your baby's recorded growth information did not trigger an elevated screening alert for possible growth difficulties. Regular growth checks remain important."}
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {isElevated
                          ? "This is an early monitoring alert, not a medical diagnosis. It does not predict future weight decline or diagnose conditions such as stunting, wasting, or underweight. Please discuss this result with your healthcare provider."
                          : "This assessment is encouraging, but it does not guarantee that growth difficulties cannot occur. Regular growth checks remain important."}
                      </p>
                    </div>

                    {story && (
                      <div
                        data-testid="integrated-growth-story"
                        className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-100 rounded-xl p-4 md:p-5 space-y-3"
                      >
                        <div className="flex items-center gap-2 text-indigo-900">
                          <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                          <h4 className="font-semibold text-sm text-indigo-950">At a Glance: Key Answers for Parents</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="bg-white/90 border border-indigo-100/70 rounded-lg p-3 space-y-1">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-indigo-700 block">
                              Is my baby gaining weight?
                            </span>
                            <p className="text-slate-700 text-xs leading-relaxed">{story.isGainingWeight}</p>
                          </div>
                          <div className="bg-white/90 border border-indigo-100/70 rounded-lg p-3 space-y-1">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-indigo-700 block">
                              Why is the AI concerned about my baby?
                            </span>
                            <p className="text-slate-700 text-xs leading-relaxed">{story.whyAiConcerned}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 30-Day Growth Forecast Card */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5" data-testid="forecast-30day-card">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span className="uppercase tracking-wider">30-Day Short-Term Growth Forecast</span>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200/70 font-semibold">
                          {forecastComparison.available ? 'Short-Term Projection' : 'Not Yet Available'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {forecastComparison.summaryText}
                      </p>
                    </div>
                  </div>

                  {/* Subsection C: Changes in Your Baby's Growth */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">C. Changes in Your Baby&apos;s Growth</h3>
                    </div>
                    <p className="text-sm text-slate-600">
                      Compare your baby's saved measurements between visits.
                    </p>

                    {weightAnalysis && (
                      <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="weight-summary-cards">
                          <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">Previous Weight</span>
                            <span className="font-semibold text-slate-900 text-lg">
                              {weightAnalysis.previous ? `${weightAnalysis.previous.weightKg.toFixed(2)} kg` : 'None recorded'}
                            </span>
                            <span className="text-xs text-slate-500 block mt-1">
                              {weightAnalysis.previous ? shortDate(weightAnalysis.previous.date) : 'No earlier check'}
                            </span>
                          </div>

                          <div className="rounded-2xl border border-primary/10 bg-secondary/40 p-4">
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">Latest Weight</span>
                            <span className="font-semibold text-slate-900 text-lg">
                              {weightAnalysis.latest ? `${weightAnalysis.latest.weightKg.toFixed(2)} kg` : 'Not recorded'}
                            </span>
                            <span className="text-xs text-slate-500 block mt-1">
                              {weightAnalysis.latest ? shortDate(weightAnalysis.latest.date) : 'No visit date'}
                            </span>
                          </div>

                          <div className="col-span-2 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:col-span-1">
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">Observed Change</span>
                            <span className="font-semibold text-slate-900 text-lg">
                              {weightAnalysis.hasEnoughData && weightAnalysis.changeKg !== null
                                ? `${weightAnalysis.changeKg > 0 ? '+' : ''}${weightAnalysis.changeKg.toFixed(2)} kg`
                                : 'Cannot yet be determined'}
                            </span>
                            <span className="text-xs text-slate-500 block mt-1">
                              {weightAnalysis.hasEnoughData && weightAnalysis.rateGramsPerDay !== null
                                ? `${weightAnalysis.daysBetween} days (${weightAnalysis.rateGramsPerDay > 0 ? '+' : ''}${weightAnalysis.rateGramsPerDay} g/day)`
                                : 'Need 2+ recorded checks'}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70" data-testid="weight-analysis-summary">
                          {readableGrowthDates(weightAnalysis.summaryText)}
                        </p>
                        <WeightHistoryChart points={weightAnalysis.points} />
                      </>
                    )}

                    {/* WAZ Position Comparison */}
                    {wazComparison && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3" data-testid="waz-growth-comparison">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-medium text-slate-500">
                          <span className="uppercase tracking-wider">Weight-for-age comparison</span>
                          {wazComparison.status === 'lower' && (
                            <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200/70 self-start sm:self-auto">
                              Tracking lower relative to age curve
                            </span>
                          )}
                          {wazComparison.status === 'higher' && (
                            <span className="text-emerald-800 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70 self-start sm:self-auto">
                              Keeping pace well with age curve
                            </span>
                          )}
                          {wazComparison.status === 'steady' && (
                            <span className="text-blue-800 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-200/70 self-start sm:self-auto">
                              Maintaining steady position
                            </span>
                          )}
                        </div>

                        {wazComparison.hasEnoughData && (
                          <div className="grid grid-cols-1 gap-2 text-center py-1 sm:grid-cols-3">
                            <div className="bg-white rounded-lg p-2.5 border border-slate-200/70">
                              <span className="text-xs text-slate-500 block">Previous Score</span>
                              <span className="font-semibold text-slate-900 text-sm">
                                {wazComparison.previousWaz !== null ? `${wazComparison.previousWaz > 0 ? '+' : ''}${wazComparison.previousWaz.toFixed(2)}` : 'N/A'}
                              </span>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 border border-slate-200/70">
                              <span className="text-xs text-slate-500 block">Latest Score</span>
                              <span className="font-semibold text-slate-900 text-sm">
                                {wazComparison.latestWaz !== null ? `${wazComparison.latestWaz > 0 ? '+' : ''}${wazComparison.latestWaz.toFixed(2)}` : 'N/A'}
                              </span>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 border border-slate-200/70">
                              <span className="text-xs text-slate-500 block">Relative Shift</span>
                              <span className="font-semibold text-slate-900 text-sm">
                                {wazComparison.wazChange !== null ? `${wazComparison.wazChange > 0 ? '+' : ''}${wazComparison.wazChange.toFixed(2)}` : 'N/A'}
                              </span>
                            </div>
                          </div>
                        )}

                        <p className="text-sm text-slate-700 leading-relaxed">
                          {readableGrowthDates(wazComparison.summaryText)}
                        </p>

                        <details className="rounded-xl border border-border/60 bg-card text-sm">
                          <summary className="min-h-11 cursor-pointer rounded-xl px-3 py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">How to read this comparison</summary>
                          <p className="border-t border-border/60 p-3 text-xs leading-relaxed text-muted-foreground">{wazComparison.cautionText}</p>
                        </details>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>

            {/* WHAT SHOULD YOU DO NEXT? SECTION */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-3" data-testid="next-steps-section">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <HeartHandshake className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">What Should You Do Next?</h3>
              </div>
              <div className="text-sm text-slate-600 space-y-2">
                <p>Continue your baby&apos;s regular growth checks with your healthcare provider.</p>
                <p>Bring your baby&apos;s Child Health Development Record (CHDR) booklet to each clinic appointment.</p>
                <p>If you have concerns about your baby&apos;s feeding, weight gain, or health, contact your Public Health Midwife or doctor.</p>
                {isElevated && (
                  <p className="font-medium text-slate-800 pt-1">
                    Please discuss this screening result with your Public Health Midwife or doctor.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <ResearchDisclaimer />
      </div>
    </div>
  );
}
