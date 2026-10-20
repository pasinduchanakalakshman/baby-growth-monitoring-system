import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Calendar, ClipboardList, HeartHandshake, type LucideIcon } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { ApiClientError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { LoadingState } from '@/components/ui/shared/LoadingState';
import { EmptyState } from '@/components/ui/shared/EmptyState';
import { ErrorStateUI } from '@/components/ui/shared/ErrorStateUI';
import { ResearchDisclaimer } from '@/components/ui/shared/ResearchDisclaimer';
import {
  getMotherFriendlyFactors,
  getRecordedVisitCount,
  getMatchedScreeningStatus,
  isValidModelCombination,
  EXPLANATION_LIMITATION,
  NEUTRAL_FACTOR_INFLUENCE,
} from '@/utils/explanationDisplay';
import type { Risk180Day } from '@/types/growth';

function Section({ id, title, icon: Icon, color, children }: {
  id: string; title: string; icon: LucideIcon; color: string; children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl shrink-0 ${color}`}><Icon aria-hidden="true" className="h-5 w-5" /></div>
        <h2 id={id} className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function NoGrowthChecks() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <PageHeader title="Your Baby's Growth Outlook — Next 6 Months" description="An early growth screening assessment based on your baby's recorded information." />
      <EmptyState icon={Calendar} title="No growth checks recorded yet"
        description="Add a growth check to see information about your baby's growth assessment." />
      <ResearchDisclaimer />
    </div>
  );
}

export default function RiskExplanationPage() {
  const { user, isAuthenticated } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['risk.explanation', user?.id, 'mother-view'],
    queryFn: async ({ signal }) => {
      const explanation = await growthApi.getRiskExplanation(signal);
      let risk: Risk180Day | null = null;
      // The explanation API omits status. Reuse the existing protected result;
      // accept its decision only if the entire inference breakdown matches exactly.
      if (!signal.aborted && getRecordedVisitCount(explanation) !== 0 && isValidModelCombination(explanation.model_combination)) {
        try {
          risk = await growthApi.getLatestRisk();
        } catch {
          // Missing status must not hide recorded factors or invent a conclusion.
        }
      }
      return { explanation, risk };
    },
    enabled: isAuthenticated && !!user,
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (isLoading || !isAuthenticated || !user) return <LoadingState />;
  if (error instanceof ApiClientError && error.status === 400 && error.message === 'No history available for explanation.') {
    return <NoGrowthChecks />;
  }
  if (error || !data) {
    return <ErrorStateUI message="We couldn't load your baby's growth explanation right now. Please try again." />;
  }

  const { explanation, risk } = data;
  const visitCount = getRecordedVisitCount(explanation);
  if (visitCount === 0) return <NoGrowthChecks />;
  const status = getMatchedScreeningStatus(explanation, risk);
  const { measurements, changes } = getMotherFriendlyFactors(explanation);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-5 text-base text-slate-600 leading-relaxed" data-testid="explanation-container">
      <PageHeader title="Your Baby's Growth Outlook — Next 6 Months" description="An early growth screening assessment based on your baby's recorded information." />

      <Section id="assessment-heading" title="Your Baby's Growth Assessment" icon={Activity} color="bg-blue-50 text-blue-600">
        <p>Early screening for possible growth difficulties during the next 180 days.</p>
        <div data-testid="screening-summary" className={`rounded-xl p-4 border space-y-2 ${
          status === 'elevated' ? 'bg-amber-50/50 border-amber-200 text-amber-950' : 'bg-slate-50 border-slate-100 text-slate-700'
        }`}>
          <p className="font-semibold">{status === 'elevated' ? 'Closer growth monitoring may be helpful' : status === 'below' ? 'Continue regular growth checks' : 'Growth screening result unavailable'}</p>
          <p>{status === 'elevated'
            ? "Your baby's recorded growth information has triggered an early screening alert for possible growth difficulties during the next 180 days."
            : status === 'below'
              ? "Your baby's recorded growth information did not trigger an elevated screening alert for possible growth difficulties during the next 180 days. Regular growth checks remain important."
              : 'We cannot show a confirmed growth screening result at the moment. Please try again later.'}</p>
          {status === 'elevated' && <p>This does not mean your baby will definitely develop a growth problem. Please discuss this result with your healthcare provider.</p>}
          {status === 'below' && <p>This does not guarantee that growth difficulties cannot occur. Regular growth checks are still important.</p>}
        </div>
      </Section>

      <Section id="measurements-heading" title="What Information Influenced This Assessment?" icon={ClipboardList} color="bg-indigo-50 text-indigo-600">
        <p>{EXPLANATION_LIMITATION}</p>
        {measurements.length > 0 ? (
          <>
            <p className="text-sm">{status
              ? 'These are some of the recorded details highlighted in this explanation.'
              : 'These details come from the available recorded-information explanation. They are not linked to a confirmed screening result here.'}</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="recorded-factors">
              {measurements.map(factor => (
                <div key={factor.feature} className="bg-slate-50 border border-slate-100 rounded-xl p-4 min-w-0">
                  <dt className="text-sm text-slate-600">{factor.label}</dt>
                  <dd className="font-semibold text-slate-900 break-words">{factor.recordedValue}</dd>
                  <dd className="text-sm text-slate-600 mt-2">{status ? factor.influence : NEUTRAL_FACTOR_INFLUENCE}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : <p>No recorded measurement details are available to highlight for this assessment.</p>}
      </Section>

      <Section id="history-heading" title="Changes in Your Baby's Growth" icon={Calendar} color="bg-purple-50 text-purple-600">
        {visitCount !== null && <p className="text-sm">Recorded growth checks: {visitCount}.</p>}
        {visitCount === 1 ? (
          <p>We have one recorded growth check for your baby. There are no earlier growth checks to compare yet.</p>
        ) : visitCount !== null && visitCount >= 2 ? (
          <>
            <p>Your baby&apos;s recorded growth checks help us understand how measurements have changed over time.</p>
            {changes.length > 0 ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="recorded-changes">
                {changes.map(factor => (
                  <div key={factor.feature} className="bg-purple-50/40 border border-purple-100 rounded-xl p-4 min-w-0">
                    <dt className="text-sm">{factor.label}</dt>
                    <dd className="font-semibold text-slate-900">{factor.recordedValue}</dd>
                    <dd className="text-sm text-slate-600 mt-2">{status ? factor.influence : NEUTRAL_FACTOR_INFLUENCE}</dd>
                  </div>
                ))}
              </dl>
            ) : <p>The available information does not support a reliable growth comparison for this assessment yet.</p>}
          </>
        ) : <p>The number of recorded growth checks is not available for this assessment, so we can&apos;t confirm whether earlier checks are available to compare.</p>}
      </Section>

      <Section id="next-steps-heading" title="What Should You Do Next?" icon={HeartHandshake} color="bg-emerald-50 text-emerald-600">
        <p>Continue your baby&apos;s regular growth checks with your healthcare provider.</p>
        <p>If you have concerns about your baby&apos;s feeding, weight gain, or health, contact your Public Health Midwife or doctor.</p>
        {status === 'elevated' && <p className="font-medium text-slate-800">Please discuss this screening result with your Public Health Midwife or doctor.</p>}
      </Section>
      <ResearchDisclaimer />
    </div>
  );
}
