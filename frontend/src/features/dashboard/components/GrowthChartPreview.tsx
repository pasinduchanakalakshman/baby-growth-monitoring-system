import { ChartNoAxesCombined, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { NewbornJourneyPlot } from '@/features/growth/components/NewbornJourneyPlot';
import { JourneyExplanation } from '@/features/growth/components/JourneyExplanation';
import type { BabyProfile } from '@/types/baby';
import type { GrowthHistoryPoint, NewbornWeightJourney } from '@/types/growth';
import { recordedWeightPoints, shortDate, type RecordedWeightPoint } from '../dashboardDisplay';

export function GrowthChartPreview({ baby, newborn, journey: response, history, loading, error, onRetry }: {
  baby?: BabyProfile; newborn: boolean; history: GrowthHistoryPoint[]; loading: boolean; error: boolean;
  journey?: NewbornWeightJourney; onRetry?: () => void;
}) {
  const journey = response?.available ? response.points : [];
  const allRecorded = recordedWeightPoints(history, baby?.date_of_birth);
  const recorded = allRecorded.slice(-12);
  const hasChart = newborn ? journey.length > 0 : recorded.length > 0;
  return (
    <Card className="min-w-0 rounded-2xl border-border/40">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">{newborn ? 'Weight journey · Birth to 30 days' : 'Weight progress'}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{newborn ? 'A birth-weight-based illustrative example' : allRecorded.length > 12 ? 'Your 12 most recent recorded visits' : 'Your recorded weight measurements'}</p>
        </div>
        {baby && <Button asChild variant="ghost" className="min-h-11 shrink-0 gap-2 px-2 text-xs text-primary"><Link to={newborn ? '/growth' : '/growth/charts'}>{newborn ? 'About this journey' : 'View Charts'}<ExternalLink aria-hidden="true" className="size-3.5" /></Link></Button>}
      </CardHeader>
      <CardContent className="px-3 pb-5 sm:px-5 sm:pb-6">
        {loading ? <div role="status" aria-label="Loading weight chart" className="px-2"><Skeleton className="h-60 w-full" /></div> : error ? <>
          <ChartEmpty text={newborn ? "We couldn't load the newborn weight journey. Please try again." : "We couldn't load recorded weights. Please try again."} />
          {newborn && onRetry && <Button variant="link" className="min-h-11" onClick={onRetry}>Retry weight journey</Button>}
        </> : newborn && response?.available && hasChart ? <NewbornJourneyPlot journey={response} compact /> : !hasChart ? <ChartEmpty text={newborn ? (response?.message || 'The birth details needed for this example are unavailable. No additional weight entries are needed.') : 'No measurements with a recorded weight and age are available yet.'} /> : <>
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
        {newborn && !loading && <div className="mx-2 mt-4"><JourneyExplanation journey={!error ? response : undefined} compact /></div>}
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="mx-2 flex min-h-56 flex-col items-center justify-center rounded-xl bg-muted/50 px-5 py-8 text-center"><ChartNoAxesCombined aria-hidden="true" className="mb-3 size-8 text-primary/70" /><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{text}</p></div>;
}
