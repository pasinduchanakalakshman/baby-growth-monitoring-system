import type { ReactNode } from 'react';
import { Baby, CalendarDays, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { BabyProfile } from '@/types/baby';
import { babyAgeLabel, shortDate } from '../dashboardDisplay';

type Props = {
  baby?: BabyProfile;
  loading: boolean;
  error: boolean;
  growthLoading: boolean;
  growthError: boolean;
  weight: number | null;
  change: number | null;
  measurementDate: string | null;
  onRetry: () => void;
};

export function BabySummaryCard({ baby, loading, error, growthLoading, growthError, weight, change, measurementDate, onRetry }: Props) {
  const born = shortDate(baby?.date_of_birth);
  return (
    <Card role="region" aria-label="Baby summary" className="min-w-0 rounded-2xl border-border/60">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:flex sm:gap-4">
          <div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10"><Baby className="size-9 text-primary" strokeWidth={1.5} /></div>
          <div className="min-w-0 flex-1">
            {loading ? <div role="status" aria-label="Loading baby profile" className="space-y-2"><Skeleton className="h-6 w-28 max-w-full" /><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-4 w-32 max-w-full" /></div> : <>
              <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">{baby?.name?.trim() || 'Baby Profile'}</h2>
              {baby ? <>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium text-primary">{babyAgeLabel(baby.date_of_birth)}</span>
                  <span aria-hidden="true" className="text-muted-foreground">&middot;</span>
                  <span className="text-muted-foreground">{baby.sex}</span>
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><CalendarDays aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{born ? `Born ${born}` : 'Birth date unavailable'}</p>
              </> : <p className="mt-1 text-sm text-muted-foreground">{error ? "We couldn't load your baby's profile." : 'Baby details are not available.'}</p>}
            </>}
          </div>
          {baby && <Button asChild variant="link" className="col-start-2 min-h-11 justify-self-start px-0 text-primary sm:shrink-0"><Link to="/baby">View Profile</Link></Button>}
        </div>

        <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-5 border-t border-border/60 pt-5 sm:grid-cols-3 sm:gap-x-6">
          <SummaryStat label="Latest Weight" loading={growthLoading}>
            {weight !== null ? <>{weight.toFixed(2)} <span className="text-sm font-medium text-muted-foreground">kg</span></> : '—'}
          </SummaryStat>
          <SummaryStat label="Weight Change" loading={growthLoading}>
            {change !== null ? <>{change > 0 ? '+' : ''}{change.toFixed(2)} <span className="text-sm font-medium text-muted-foreground">kg</span></> : '—'}
          </SummaryStat>
          <SummaryStat label="Last Measurement" loading={growthLoading} className="col-span-2 sm:col-span-1">
            {measurementDate ?? '—'}
          </SummaryStat>
        </dl>

        {(error || growthError) && <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 rounded-xl bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
          {error ? <span>Please try loading your baby's details again.</span> : <span>We couldn't load the latest growth summary. Any saved values are shown.</span>}
          <Button variant="link" className="min-h-11 gap-2 px-0" onClick={onRetry}><RefreshCw aria-hidden="true" className="size-4" />Try again</Button>
        </div>}

        {baby && <div className="flex justify-end">
          <Button asChild className="min-h-11 w-full rounded-xl px-5 sm:w-auto"><Link to="/growth/add"><Plus aria-hidden="true" />Add Measurement</Link></Button>
        </div>}
      </CardContent>
    </Card>
  );
}

function SummaryStat({ label, loading, children, className = '' }: { label: string; loading: boolean; children: ReactNode; className?: string }) {
  return <div className={`min-w-0 ${className}`}>
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="mt-2 text-xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">
      {loading ? <span role="status" aria-label={`Loading ${label.toLowerCase()}`}><Skeleton className="h-7 w-24 max-w-full" /></span> : children}
    </dd>
  </div>;
}
