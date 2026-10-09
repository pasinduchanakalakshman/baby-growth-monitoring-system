import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import { AlertCircle, Brain, TrendingUp, TrendingDown, Info } from 'lucide-react';

export default function RiskExplanationPage() {
  const { data: explanation, isLoading, error } = useQuery({
    queryKey: ['risk.explanation'],
    queryFn: growthApi.getRiskExplanation
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12" data-testid="loading-state">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto" data-testid="error-state">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Failed to load explanation data. The risk assessment may not be available for the current record.</p>
        </div>
      </div>
    );
  }

  const hasNoData = !explanation?.frontend_safe_explanation || explanation.frontend_safe_explanation.length === 0;

  const increasingFactors = explanation?.frontend_safe_explanation?.filter(f => f.direction.includes('increased')) || [];
  const decreasingFactors = explanation?.frontend_safe_explanation?.filter(f => f.direction.includes('decreased')) || [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Why This Risk?</h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          See which recorded factors most influenced the model's current risk estimate.
        </p>
      </div>

      {hasNoData ? (
        <div className="bg-card border rounded-xl shadow-sm p-12 text-center" data-testid="no-data-state">
          <div className="flex justify-center mb-4">
            <Brain className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">No explanation available.</h3>
        </div>
      ) : (
        <div className="space-y-6" data-testid="explanation-container">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Increasing Factors */}
            <div className="bg-white border rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Factors increasing predicted risk
              </h3>
              
              {increasingFactors.length > 0 ? (
                <div className="space-y-4">
                  {increasingFactors.map((factor, idx) => {
                    const techVal = explanation.technical_explanation.contributions.find(c => c.feature === factor.feature);
                    return (
                      <div key={idx} className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-slate-800">{factor.display_label}</p>
                          <span className="text-xs font-medium text-amber-700 bg-amber-200/50 px-2 py-0.5 rounded-full">
                            #{factor.importance_rank}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">This factor increased the model-predicted risk.</p>
                        {techVal && (
                          <div className="mt-3 pt-3 border-t border-amber-200/50 flex justify-between text-sm">
                            <span className="text-slate-500">Recorded Value</span>
                            <span className="font-medium text-slate-900">
                              {techVal.raw_value !== null ? String(techVal.raw_value) : 'Not recorded'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No significant increasing factors found.</p>
              )}
            </div>

            {/* Decreasing Factors */}
            <div className="bg-white border rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Factors reducing predicted risk
              </h3>
              
              {decreasingFactors.length > 0 ? (
                <div className="space-y-4">
                  {decreasingFactors.map((factor, idx) => {
                    const techVal = explanation.technical_explanation.contributions.find(c => c.feature === factor.feature);
                    return (
                      <div key={idx} className="bg-green-50 rounded-lg p-4 border border-green-100">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-slate-800">{factor.display_label}</p>
                          <span className="text-xs font-medium text-green-700 bg-green-200/50 px-2 py-0.5 rounded-full">
                            #{factor.importance_rank}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">This factor reduced the model-predicted risk.</p>
                        {techVal && (
                          <div className="mt-3 pt-3 border-t border-green-200/50 flex justify-between text-sm">
                            <span className="text-slate-500">Recorded Value</span>
                            <span className="font-medium text-slate-900">
                              {techVal.raw_value !== null ? String(techVal.raw_value) : 'Not recorded'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No significant reducing factors found.</p>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border rounded-lg p-5">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Info className="h-5 w-5 text-slate-500" />
              Interpretation Note
            </h4>
            <p className="text-sm text-slate-600">
              {explanation.disclaimer || "These features influenced the model-predicted risk. They do not establish clinical causality."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
