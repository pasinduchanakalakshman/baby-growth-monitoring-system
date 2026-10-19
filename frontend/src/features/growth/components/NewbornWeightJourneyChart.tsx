import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { journeyPhases } from '@/utils/newbornWeightJourney';
import type { NewbornWeightJourney } from '@/types/growth';
import { NewbornJourneyPlot } from './NewbornJourneyPlot';
import { JourneyExplanation } from './JourneyExplanation';

export { JourneyTooltip } from './NewbornJourneyPlot';

type Props = { journey?: NewbornWeightJourney; isLoading?: boolean; error?: boolean; onRetry?: () => void };

export default function NewbornWeightJourneyChart({ journey, isLoading, error, onRetry }: Props) {
  const available = journey?.available && journey.points.length > 0;
  return (
    <Card role="region" aria-label="Newborn Weight Journey" className="min-w-0 rounded-2xl border-border/50">
      <CardHeader className="space-y-3 p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-primary">Newborn Weight Journey</p>
          <Badge variant="outline" className="border-transparent bg-accent text-primary">Birth to 30 days</Badge>
        </div>
        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Your Baby's First 30 Days</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Birth weight is recorded. The dashed line shows an illustrative example, not your baby's actual daily weight.</p>
      </CardHeader>
      <CardContent className="space-y-5 p-5 pt-0 sm:p-6 sm:pt-0">
        {isLoading ? <div role="status" aria-label="Loading newborn weight journey" className="space-y-3"><Skeleton className="h-5 w-56 max-w-full" /><Skeleton className="h-72 w-full" /></div>
          : error ? <div role="alert" className="rounded-xl border border-border/60 bg-muted/50 p-5 text-sm"><p>We couldn't load the newborn weight journey. Please try again.</p>{onRetry && <Button variant="outline" className="mt-3 min-h-11" onClick={onRetry}>Try again</Button>}</div>
          : available ? <NewbornJourneyPlot journey={journey} />
          : <p className="rounded-xl bg-muted/60 p-5 text-sm leading-relaxed text-muted-foreground">{journey?.message || 'This example is unavailable because the recorded birth details could not be loaded.'} No additional weight measurements are needed for this section.</p>}
        <JourneyExplanation journey={!isLoading && !error ? journey : undefined} />
        <details className="rounded-xl border border-border/60 bg-card">
          <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Understanding this journey and when to seek advice</summary>
          <div className="space-y-4 border-t border-border/60 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {journeyPhases.map(phase => <div key={phase.title} className="rounded-xl bg-muted/60 p-4"><p className="mb-1 text-xs font-medium text-primary">{phase.label}</p><h3 className="text-sm font-semibold">{phase.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{phase.description}</p></div>)}
            </div>
            <aside className="rounded-xl bg-accent/50 p-4 text-sm leading-relaxed">
              <h3 className="font-semibold">When Should You Seek Advice?</h3>
              <p className="mt-2">Contact a doctor, Public Health Midwife or healthcare provider if your newborn:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5"><li>Has difficulty feeding.</li><li>Has noticeably fewer wet nappies.</li><li>Appears unusually sleepy, weak or unwell.</li><li>Shows other concerning symptoms.</li><li>Has weight concerns raised during a clinical check.</li></ul>
              <p className="mt-3">This is general guidance only. The illustration cannot assess your baby's health.</p>
            </aside>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
