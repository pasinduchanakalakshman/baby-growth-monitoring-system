import { ChartNoAxesCombined, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createNewbornWeightJourney, type JourneyPoint } from '@/utils/newbornWeightJourney';
import { JourneyTooltip } from '@/features/growth/components/NewbornWeightJourneyChart';
import type { BabyProfile } from '@/types/baby';
import type { GrowthHistoryPoint } from '@/types/growth';
import { recordedWeightPoints, shortDate, type RecordedWeightPoint } from '../dashboardDisplay';

export function GrowthChartPreview({ baby, newborn, history, loading, error }: {
  baby?: BabyProfile; newborn: boolean; history: GrowthHistoryPoint[]; loading: boolean; error: boolean;
}) {
  const journey = newborn ? createNewbornWeightJourney(baby?.birth_weight_kg) : [];
  const allRecorded = recordedWeightPoints(history, baby?.date_of_birth);
  const recorded = allRecorded.slice(-12);
  const hasChart = newborn ? journey.length > 0 : recorded.length > 0;
  const termRecorded = typeof baby?.gestational_age_weeks === 'number' && Number.isInteger(baby.gestational_age_weeks) && baby.gestational_age_weeks >= 37 && baby.gestational_age_weeks <= 41;
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
        {loading ? <div role="status" aria-label="Loading weight chart" className="px-2"><Skeleton className="h-60 w-full" /></div> : error && !newborn ? <ChartEmpty text="We couldn't load recorded weights. Please try again." /> : !hasChart ? <ChartEmpty text={newborn ? 'A valid birth weight is needed to show this example. No additional weight entries are needed.' : 'No measurements with a recorded weight and age are available yet.'} /> : <>
          <div className="mb-3 flex flex-wrap justify-end gap-x-4 gap-y-2 px-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-primary" />{newborn ? 'Recorded birth weight' : 'Recorded weight'}</span>
            {newborn && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-primary" />Illustrative example</span>}
          </div>
          <div role="img" aria-label={newborn ? `Illustrative weight journey beginning at the recorded birth weight of ${baby?.birth_weight_kg} kg. Values after birth are examples, not actual measurements or individual predictions.` : `Recorded weight in kilograms by age in days, across ${recorded.length} visits. A text list of these measurements follows.`} className="h-60 w-full min-w-0 sm:h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart<JourneyPoint | RecordedWeightPoint> data={newborn ? journey : recorded} margin={{ top: 12, right: 15, bottom: 24, left: 0 }} accessibilityLayer={false}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
                <XAxis type="number" dataKey="day" domain={newborn ? [0, 30] : ['dataMin', 'dataMax']} ticks={newborn ? [0, 5, 10, 15, 20, 25, 30] : undefined} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} label={{ value: 'Age (days)', position: 'bottom', offset: 8, fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                <YAxis width={52} domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickFormatter={v => Number(v).toFixed(1)} tickLine={false} axisLine={false} label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                {newborn ? <Tooltip content={<JourneyTooltip />} /> : <Tooltip formatter={value => [`${Number(value).toFixed(2)} kg`, 'Recorded weight']} labelFormatter={day => `Age: ${day} days`} contentStyle={{ borderRadius: 12, borderColor: 'var(--color-border)', fontSize: 12 }} />}
                <Line dataKey={newborn ? 'illustrativeWeightKg' : 'weightKg'} type={newborn ? 'monotone' : 'linear'} stroke="var(--color-primary)" strokeWidth={2.5} strokeDasharray={newborn ? '7 5' : undefined} dot={newborn ? false : { r: 4, fill: 'var(--color-primary)', stroke: 'var(--color-card)', strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
                {newborn && <ReferenceDot x={0} y={journey[0].illustrativeWeightKg} r={5} fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth={2} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!newborn && <details className="mx-2 mt-3 text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer rounded-md py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">View recorded values</summary><ul className="space-y-2 pb-2">{recorded.map((point, i) => <li key={`${point.visitDate}-${i}`}>{shortDate(point.visitDate)} · Age {point.day} days · {point.weightKg.toFixed(2)} kg</li>)}</ul></details>}
        </>}
        {newborn && !loading && <div className="mx-2 mt-4 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-foreground/80">
          <p>Except for the recorded birth weight, this curve is illustrative. It is not a record of your baby's weight or an individual prediction.</p>
          <p className="mt-2">{termRecorded ? 'This is a general teaching example for babies born at term.' : 'This general example is for babies born at term. Your baby was born early, or term status is not established in the recorded details.'} It may not suit babies born early or babies who are unwell or need special care. It cannot assess your baby's health. Follow your healthcare provider's individual advice.</p>
          <p className="mt-2 font-medium">No extra weight entries are needed during the first 30 days to view this journey. Keep routine clinical checks.</p>
        </div>}
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="mx-2 flex min-h-56 flex-col items-center justify-center rounded-xl bg-muted/50 px-5 py-8 text-center"><ChartNoAxesCombined aria-hidden="true" className="mb-3 size-8 text-primary/70" /><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{text}</p></div>;
}
