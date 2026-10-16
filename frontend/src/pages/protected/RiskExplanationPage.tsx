import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { growthApi } from '@/api/growth';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  Calendar,
  Activity,
  HeartHandshake,
  BookOpen,
  ShieldAlert,
  Stethoscope,
  ClipboardList
} from 'lucide-react';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';
import {
  getParentFriendlyFeatureName,
  formatRecordedValue,
  getParentFriendlyDescription,
  isLongitudinalFeature,
  HYBRID_MODEL_COVERAGE_DISCLOSURE
} from '@/utils/explanationDisplay';

export default function RiskExplanationPage() {
  const [techOpen, setTechOpen] = useState(false);

  const { data: explanation, isLoading, error } = useQuery({
    queryKey: ['risk.explanation'],
    queryFn: growthApi.getRiskExplanation
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorStateUI message="We couldn't load explanation data right now. Please try again." />;
  }

  const hasNoData = !explanation?.frontend_safe_explanation || explanation.frontend_safe_explanation.length === 0;

  if (hasNoData) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
        <PageHeader
          title="Why This Risk?"
          description="A parent-friendly guide to understanding which recorded measurements influenced your child's 180-day growth assessment."
        />
        <EmptyState
          icon={Brain}
          title="No explanation available."
          description="There is not enough data to generate an explanation for this risk assessment."
        />
        <ResearchDisclaimer />
      </div>
    );
  }

  const allFactors = explanation.frontend_safe_explanation || [];
  const contributions = explanation.technical_explanation?.contributions || [];

  // Categorize factors into longitudinal (between visits) and point-in-time measurements
  const longitudinalFactors = allFactors.filter(f => isLongitudinalFeature(f.feature));
  const currentMeasurements = allFactors.filter(f => !isLongitudinalFeature(f.feature));

  // If all factors happened to be in one category, ensure both sections remain informative
  const measurementsToDisplay = currentMeasurements.length > 0 ? currentMeasurements : allFactors;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-8" data-testid="explanation-container">
      <PageHeader
        title="Why This Risk?"
        description="A parent-friendly guide to understanding which recorded measurements influenced your child's 180-day growth assessment."
      />

      {/* SECTION 1: Understanding Your Child's Growth Assessment */}
      <section
        data-testid="section-understanding"
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              1. Understanding Your Child&apos;s Growth Assessment
            </h2>
            <p className="text-sm text-slate-500">
              How to read this page and what the AI assessment means for you and your family.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
            <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-blue-600" />
              Early Monitoring Aid
            </h3>
            <p>
              This score helps healthcare workers identify children who may benefit from closer growth monitoring over the next 6 months.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
            <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-amber-600" />
              Not a Medical Diagnosis
            </h3>
            <p>
              A higher screening score is not a disease or illness. A low score does not guarantee good health. It is an early screening estimate.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
            <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-purple-600" />
              Patterns, Not Single Numbers
            </h3>
            <p>
              The AI combines many measurements together. No single factor caused the screening score on its own.
            </p>
          </div>
        </div>
      </section>

      {/* MODEL COVERAGE DISCLOSURE (STEP 6) */}
      <section
        data-testid="section-coverage-disclosure"
        className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-indigo-950">
              {HYBRID_MODEL_COVERAGE_DISCLOSURE.title}
            </h3>
            <p className="text-xs md:text-sm text-indigo-900 leading-relaxed">
              {HYBRID_MODEL_COVERAGE_DISCLOSURE.summary}
            </p>
            <p className="text-xs text-indigo-800 leading-relaxed pt-1">
              {HYBRID_MODEL_COVERAGE_DISCLOSURE.details}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: Measurements the AI Paid Attention To */}
      <section
        data-testid="section-measurements"
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              2. Measurements the AI Paid Attention To
            </h2>
            <p className="text-sm text-slate-500">
              The recorded health measurements from your child that most strongly influenced the model&apos;s assessment.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {measurementsToDisplay.map((factor, idx) => {
            const techVal = contributions.find(c => c.feature === factor.feature);
            const friendlyName = getParentFriendlyFeatureName(factor.feature, factor.display_label);
            const recordedValueText = formatRecordedValue(factor.feature, techVal?.raw_value);
            const friendlyDesc = getParentFriendlyDescription(factor.feature, factor.direction);
            const isIncreasing = factor.direction.toLowerCase().includes('increase');

            return (
              <div
                key={`${factor.feature}-${idx}`}
                className={`rounded-xl p-5 border transition-colors ${
                  isIncreasing
                    ? 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70'
                    : 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-base">
                      {friendlyName}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      Factor #{factor.importance_rank}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      isIncreasing
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isIncreasing ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5" />
                        Shifted model score higher
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3.5 w-3.5" />
                        Shifted model score lower
                      </>
                    )}
                  </span>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed mb-3">
                  {friendlyDesc}
                </p>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Recorded Value</span>
                  <span className="font-semibold text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                    {recordedValueText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: Changes Between Clinic Visits */}
      <section
        data-testid="section-longitudinal"
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              3. Changes Between Clinic Visits
            </h2>
            <p className="text-sm text-slate-500">
              How your child grows over time is just as important as single measurements on one day.
            </p>
          </div>
        </div>

        {longitudinalFactors.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              The AI evaluated how your child&apos;s growth evolved between check-ups:
            </p>
            <div className="grid grid-cols-1 gap-4">
              {longitudinalFactors.map((factor, idx) => {
                const techVal = contributions.find(c => c.feature === factor.feature);
                const friendlyName = getParentFriendlyFeatureName(factor.feature, factor.display_label);
                const recordedValueText = formatRecordedValue(factor.feature, techVal?.raw_value);
                const friendlyDesc = getParentFriendlyDescription(factor.feature, factor.direction);
                const isIncreasing = factor.direction.toLowerCase().includes('increase');

                return (
                  <div
                    key={`longitudinal-${factor.feature}-${idx}`}
                    className={`rounded-xl p-5 border ${
                      isIncreasing ? 'bg-amber-50/40 border-amber-200' : 'bg-emerald-50/40 border-emerald-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="font-semibold text-slate-900 text-base">
                        {friendlyName}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          isIncreasing ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isIncreasing ? (
                          <>
                            <TrendingUp className="h-3.5 w-3.5" />
                            Shifted model score higher
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3.5 w-3.5" />
                            Shifted model score lower
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed mb-3">
                      {friendlyDesc}
                    </p>

                    <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium">Recorded Change</span>
                      <span className="font-semibold text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                        {recordedValueText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-sm text-slate-600 space-y-2">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              Visit-to-Visit Growth Progression
            </h3>
            <p className="leading-relaxed">
              When previous growth visits are on file, the AI checks how your child&apos;s weight, height, and growth scores progress over time. For this specific check, the main measurements listed in Section 2 had the strongest impact on the model&apos;s output.
            </p>
            <p className="text-xs text-slate-500">
              Regular monthly visits provide the most accurate timeline for growth monitoring.
            </p>
          </div>
        )}
      </section>

      {/* SECTION 4: What You Can Do Next */}
      <section
        data-testid="section-next-steps"
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              4. What You Can Do Next
            </h2>
            <p className="text-sm text-slate-500">
              Helpful, everyday steps to support your child&apos;s healthy growth and development.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Calendar className="h-4 w-4" />
              Attend Regular Clinic Visits
            </div>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              Bring your child to the monthly child welfare clinic (MOH / PHM clinic) for regular weight and height checks.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <ClipboardList className="h-4 w-4" />
              Follow Your CHDR Booklet
            </div>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              Check the growth curve in your blue or pink Child Health Development Record (CHDR) to see your baby&apos;s growth curve over time.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Stethoscope className="h-4 w-4" />
              Talk to Healthcare Workers
            </div>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              If you have any questions about feeding, weight, or recent illnesses, speak with your Public Health Midwife (PHM) or doctor.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Info className="h-4 w-4" />
              Use as a Supportive Guide
            </div>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              Remember that this AI screening score is an experimental guide to support clinic monitoring, not medical advice.
            </p>
          </div>
        </div>
      </section>

      {/* OPTIONAL TECHNICAL DETAILS EXPANDABLE SECTION (FOR DEBUGGING / CLINICIANS) */}
      <section
        data-testid="section-technical-details"
        className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setTechOpen(!techOpen)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors"
          aria-expanded={techOpen}
        >
          <div className="flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-slate-500" />
            <div>
              <span className="font-semibold text-slate-800 text-sm">
                Technical Details (For Clinicians & Researchers)
              </span>
              <p className="text-xs text-slate-500">
                View exact feature identifiers, preprocessed values, and raw SHAP log-odds contributions.
              </p>
            </div>
          </div>
          {techOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          )}
        </button>

        {techOpen && (
          <div className="p-5 pt-0 border-t border-slate-200/70 space-y-4">
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200/70 text-slate-700 uppercase font-semibold">
                    <th className="p-2.5 border border-slate-300">Feature Identifier</th>
                    <th className="p-2.5 border border-slate-300">Raw Value</th>
                    <th className="p-2.5 border border-slate-300">Transformed Value</th>
                    <th className="p-2.5 border border-slate-300">SHAP Attribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {contributions.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-100/50">
                      <td className="p-2.5 font-mono text-slate-800 border border-slate-200">
                        {c.feature}
                      </td>
                      <td className="p-2.5 text-slate-700 border border-slate-200">
                        {c.raw_value !== null ? String(c.raw_value) : 'null'}
                      </td>
                      <td className="p-2.5 text-slate-700 border border-slate-200">
                        {c.transformed_value !== null ? Number(c.transformed_value).toFixed(4) : 'null'}
                      </td>
                      <td
                        className={`p-2.5 font-mono font-medium border border-slate-200 ${
                          c.shap_contribution > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {c.shap_contribution > 0 ? '+' : ''}
                        {Number(c.shap_contribution).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {explanation.technical_explanation?.base_value !== undefined && (
              <p className="text-xs text-slate-500">
                Model Base Expected Value (margin space):{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {Number(explanation.technical_explanation.base_value).toFixed(4)}
                </span>
              </p>
            )}

            <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 mb-1">Technical Disclaimer:</p>
              <p>
                {explanation.disclaimer ||
                  'These features influenced the model-predicted risk. They do not establish clinical causality.'}
              </p>
            </div>
          </div>
        )}
      </section>

      <ResearchDisclaimer />
    </div>
  );
}
