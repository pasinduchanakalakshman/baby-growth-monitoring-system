import { ChartNoAxesCombined, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import GrowthCharts from '@/features/growth/components/GrowthCharts';
import type { BabyProfile } from '@/types/baby';
import type { GrowthHistoryPoint } from '@/types/growth';
import { recordedWeightPoints } from '../dashboardDisplay';

export function GrowthChartPreview({ baby, history, loading, error, onRetry }: {
  baby?: BabyProfile; history: GrowthHistoryPoint[]; loading: boolean; error: boolean;
  onRetry?: () => void;
}) {
  const hasChart = recordedWeightPoints(history, baby?.date_of_birth).length > 0;
  const chartLink = baby && <Button asChild variant="link" className="min-h-11 shrink-0 gap-2 px-0 text-sm text-primary"><Link to="/growth/charts">View Growth Charts<ExternalLink aria-hidden="true" className="size-3.5" /></Link></Button>;

  if (!loading && !error && hasChart) {
    return <section aria-label="Growth Charts"><GrowthCharts detailed weightOnly baby={baby} history={history} headerAction={chartLink} /></section>;
  }

  return (
    <Card role="region" aria-label="Growth Charts" className="min-w-0 rounded-2xl border-border/60">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Growth Charts</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Recorded visits, separate from illustrations and forecasts.</p>
        </div>
        {chartLink}
      </CardHeader>
      <CardContent className="px-3 pb-5 sm:px-5 sm:pb-6">
        {loading ? <div role="status" aria-label="Loading weight chart" className="px-2"><Skeleton className="h-52 w-full sm:h-60" /></div> : error ? (
          <div role="status" className="mx-2 rounded-xl bg-muted/50 px-5 py-6 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">We couldn't load recorded weights. Please try again.</p>
            {onRetry && <Button variant="link" className="mt-2 min-h-11" onClick={onRetry}>Retry weight progress</Button>}
          </div>
        ) : <ChartEmpty hasHistory={history.length > 0} hasProfile={!!baby} />}
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ hasHistory, hasProfile }: { hasHistory: boolean; hasProfile: boolean }) {
  return <div className="mx-2 flex flex-col items-center justify-center rounded-xl bg-muted/50 px-5 py-6 text-center">
    <ChartNoAxesCombined aria-hidden="true" className="mb-3 size-8 text-primary/70" />
    <h3 className="text-base font-semibold">{hasHistory ? 'Weight progress is not available yet' : hasProfile ? "Your baby's growth journey starts here" : 'Your weight progress will appear here'}</h3>
    <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{hasHistory ? 'Your saved visits need a valid weight and date to appear on this chart.' : hasProfile ? "Add your first measurement to start tracking your baby's growth over time." : "Your baby's profile is needed to show recorded measurements."}</p>
  </div>;
}
