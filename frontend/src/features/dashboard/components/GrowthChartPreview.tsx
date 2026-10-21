import { ChartNoAxesCombined, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { BabyProfile } from '@/types/baby';
import type { GrowthHistoryPoint } from '@/types/growth';
import { recordedWeightPoints, shortDate, type RecordedWeightPoint } from '../dashboardDisplay';

export function GrowthChartPreview({ baby, history, loading, error, onRetry }: {
  baby?: BabyProfile; history: GrowthHistoryPoint[]; loading: boolean; error: boolean;
  onRetry?: () => void;
}) {
  const allRecorded = recordedWeightPoints(history, baby?.date_of_birth);
  const recorded = allRecorded.slice(-12);
  const hasChart = recorded.length > 0;
  return (
    <Card role="region" aria-label="Weight Progress" className="min-w-0 rounded-2xl border-border/60">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Weight Progress</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Track your baby's weight over time.</p>
        </div>
        {baby && <Button asChild variant="link" className="min-h-11 shrink-0 gap-2 px-0 text-sm text-primary"><Link to="/growth/charts">View Growth Charts<ExternalLink aria-hidden="true" className="size-3.5" /></Link></Button>}
      </CardHeader>
      <CardContent className="px-3 pb-5 sm:px-5 sm:pb-6">
        {loading ? <div role="status" aria-label="Loading weight chart" className="px-2"><Skeleton className="h-52 w-full sm:h-60" /></div> : error ? (
          <div role="status" className="mx-2 rounded-xl bg-muted/50 px-5 py-6 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">We couldn't load recorded weights. Please try again.</p>
            {onRetry && <Button variant="link" className="mt-2 min-h-11" onClick={onRetry}>Retry weight progress</Button>}
          </div>
        ) : !hasChart ? <ChartEmpty hasHistory={history.length > 0} hasProfile={!!baby} /> : <>
          {allRecorded.length > 12 && <p className="mb-3 px-2 text-xs text-muted-foreground">Your 12 most recent recorded visits</p>}
          <div className="mb-3 flex flex-wrap justify-end gap-x-4 gap-y-2 px-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-primary" />Recorded weight</span>
          </div>
          <div role="img" aria-label={`Recorded weight in kilograms by age in days, across ${recorded.length} visits. A text list of these measurements follows.`} className="h-60 w-full min-w-0 sm:h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart<RecordedWeightPoint> data={recorded} margin={{ top: 12, right: 15, bottom: 24, left: 0 }} accessibilityLayer={false}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
                <XAxis type="number" dataKey="day" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} label={{ value: 'Age (days)', position: 'bottom', offset: 8, fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                <YAxis width={52} domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickFormatter={v => Number(v).toFixed(1)} tickLine={false} axisLine={false} label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                <Tooltip formatter={value => [`${Number(value).toFixed(2)} kg`, 'Recorded weight']} labelFormatter={day => `Age: ${day} days`} contentStyle={{ borderRadius: 12, borderColor: 'var(--color-border)', fontSize: 12 }} />
                <Line dataKey="weightKg" type="linear" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-primary)', stroke: 'var(--color-card)', strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="mx-2 mt-3 text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer rounded-md py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">View recorded values</summary><ul className="space-y-2 pb-2">{recorded.map((point, i) => <li key={`${point.visitDate}-${i}`}>{shortDate(point.visitDate)} · Age {point.day} days · {point.weightKg.toFixed(2)} kg</li>)}</ul></details>
        </>}
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
