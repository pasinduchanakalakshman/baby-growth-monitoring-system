import { useId, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NewbornJourneyPoint, NewbornWeightJourney } from '@/types/growth';
import { useChartTooltipTrigger } from '@/features/growth/useChartTooltipTrigger';

export function JourneyTooltip({ active, payload }: {
  active?: boolean; payload?: ReadonlyArray<{ payload?: NewbornJourneyPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="max-w-64 rounded-xl border border-border/60 bg-card p-3 text-sm shadow-card">
    <p className="font-semibold">Day {point.day} · {point.phase}</p>
    <p className="mt-1 text-primary">{point.value_type === 'recorded_birth_weight' ? 'Recorded birth weight' : 'Illustrative example'}: {point.weight_kg.toFixed(2)} kg</p>
  </div>;
}

// Presentation only: the endpoint's complete points array goes directly to Recharts.
export function NewbornJourneyPlot({ journey, compact = false }: { journey: NewbornWeightJourney; compact?: boolean }) {
  const id = useId();
  const [selectedDay, setSelectedDay] = useState(0);
  const tooltipTrigger = useChartTooltipTrigger();
  const points = journey.points;
  const point = points.find(p => p.day === selectedDay) ?? points[0];
  const birth = points.find(p => p.value_type === 'recorded_birth_weight' && p.day === 0);
  if (!points.length) return null;
  return <div className="min-w-0 space-y-4">
    <ul aria-label="Journey legend" className="flex flex-wrap gap-x-5 gap-y-2 text-xs leading-relaxed text-muted-foreground">
      <li className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-primary" /><span>Recorded birth weight: {journey.birth_weight_kg} kg</span></li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="w-6 shrink-0 border-t-2 border-dashed border-primary" /><span>Illustrative example</span></li>
    </ul>
    <div className={`w-full min-w-0 ${compact ? 'h-60 sm:h-64' : 'h-72 sm:h-80'}`} role="img" aria-label={`Illustrative weight journey beginning at the recorded birth weight of ${journey.birth_weight_kg} kg. All later values are illustrative, not actual measurements or individual predictions. Explore each day using the selector below.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 28 }} accessibilityLayer={false}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="day" type="number" domain={[0, 30]} ticks={[0, 3, 10, 20, 30]} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickMargin={8} tickLine={false} axisLine={false} label={{ value: 'Days after birth', position: 'bottom', offset: 10, fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
          <YAxis width={62} domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickFormatter={value => Number(value).toFixed(2)} tickLine={false} axisLine={false} label={{ value: 'Illustrative weight (kg)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
          <Tooltip trigger={tooltipTrigger} content={<JourneyTooltip />} allowEscapeViewBox={{ x: false, y: false }} />
          <Line dataKey="weight_kg" name="Illustrative example (kg)" type="monotone" stroke="var(--color-primary)" strokeWidth={2.5} strokeDasharray="7 5" dot={false} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
          {birth && <ReferenceDot x={birth.day} y={birth.weight_kg} r={5} fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth={2} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-muted/60 p-3 text-xs sm:p-4">
      <label htmlFor={id} className="font-medium">Explore a day</label>
      <select id={id} value={point.day} onChange={event => setSelectedDay(Number(event.target.value))} className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {points.map(p => <option key={p.day} value={p.day}>Day {p.day}</option>)}
      </select>
      <output htmlFor={id} aria-live="polite" className="min-w-0 flex-1 basis-44 leading-relaxed"><span className="block text-muted-foreground">{point.phase}</span><span className="font-medium text-primary">{point.value_type === 'recorded_birth_weight' ? 'Recorded birth weight' : 'Illustrative example'}: {point.weight_kg.toFixed(2)} kg</span></output>
    </div>
  </div>;
}
