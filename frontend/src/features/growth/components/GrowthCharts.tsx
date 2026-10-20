import { useId, useState, type KeyboardEvent } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { GrowthHistoryPoint } from '@/types/growth';
import { formatCalendarDate } from '@/utils/growthDisplay';
import { useChartTooltipTrigger } from '@/features/growth/useChartTooltipTrigger';

type Metric = 'weight' | 'height' | 'waz' | 'haz';
type MetricKey = 'weight_kg' | 'length_height_cm' | 'verified_waz' | 'verified_haz';
const metrics: Record<Metric, { label: string; title: string; key: MetricKey; unit: string; axis: string; empty: string }> = {
  weight: { label: 'Weight', title: 'Weight', key: 'weight_kg', unit: 'kg', axis: 'Weight (kg)', empty: 'No recorded weights available.' },
  height: { label: 'Length / Height', title: 'Length/Height', key: 'length_height_cm', unit: 'cm', axis: 'Length/Height (cm)', empty: 'No length/height data recorded yet.' },
  waz: { label: 'WAZ', title: 'Weight-for-Age', key: 'verified_waz', unit: 'Z-score', axis: 'Z-score', empty: 'No weight-for-age scores recorded yet.' },
  haz: { label: 'HAZ', title: 'Length/Height-for-Age', key: 'verified_haz', unit: 'Z-score', axis: 'Z-score', empty: 'No HAZ available (requires length/height).' },
};
const metricOrder: Metric[] = ['weight', 'height', 'waz', 'haz'];

function hasValue(value: unknown, key: MetricKey): value is number {
  return typeof value === 'number' && Number.isFinite(value) && (key === 'verified_waz' || key === 'verified_haz' || value > 0);
}

export function RecordedGrowthTooltip({ active, payload, metric }: {
  active?: boolean; payload?: ReadonlyArray<{ payload?: GrowthHistoryPoint }>; metric: Metric;
}) {
  const visit = payload?.[0]?.payload;
  if (!active || !visit) return null;
  const config = metrics[metric];
  const value = visit[config.key];
  return <div className="max-w-64 rounded-xl border border-border/60 bg-card p-3 text-sm shadow-card">
    <p className="font-semibold">{formatCalendarDate(visit.visit_date)}</p>
    {typeof visit.age_days === 'number' && <p className="mt-1 text-xs text-muted-foreground">Age: {visit.age_days} days</p>}
    <p className="mt-1 text-primary">Recorded {config.title}: {hasValue(value, config.key) ? value.toFixed(2) + ' ' + config.unit : 'Not recorded'}</p>
  </div>;
}

export default function GrowthCharts({ history }: { history: GrowthHistoryPoint[] }) {
  const id = useId();
  const [activeTab, setActiveTab] = useState<Metric>('weight');
  const [selectedDate, setSelectedDate] = useState('');
  const tooltipTrigger = useChartTooltipTrigger();
  const config = metrics[activeTab];
  const chartData = [...history].sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime());
  const validCount = chartData.filter(visit => hasValue(visit[config.key], config.key)).length;
  // Retain every visit so nulls create gaps, rather than bridging a missing value.
  const plotData = chartData.map(visit => ({ ...visit, [config.key]: hasValue(visit[config.key], config.key) ? visit[config.key] : null }));
  const selected = chartData.find(visit => visit.visit_date === selectedDate) ?? chartData.at(-1);
  const selectedValue = selected?.[config.key];
  const score = activeTab === 'waz' || activeTab === 'haz';

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, tab: Metric) {
    const index = metricOrder.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : null;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(metricOrder[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return <Card className="min-w-0 rounded-2xl border-border/50">
    <CardHeader className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Growth Charts</h2><p className="mt-1 text-sm text-muted-foreground">Recorded visits, separate from illustrations and forecasts.</p></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground">{history.length} {history.length === 1 ? 'visit' : 'visits'}</span></div>
      <div role="tablist" aria-label="Growth measurement" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1.5 sm:grid-cols-4">
        {metricOrder.map(tab => <Button key={tab} role="tab" id={id + tab} aria-selected={activeTab === tab} aria-controls={id + 'panel'} tabIndex={activeTab === tab ? 0 : -1} variant={activeTab === tab ? 'default' : 'ghost'} onClick={() => setActiveTab(tab)} onKeyDown={event => moveTab(event, tab)} className="min-h-11 rounded-full px-2 text-xs sm:text-sm">{metrics[tab].label}</Button>)}
      </div>
    </CardHeader>
    <CardContent role="tabpanel" id={id + 'panel'} aria-labelledby={id + activeTab} tabIndex={0} className="min-w-0 space-y-4 px-3 pb-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5 sm:pb-6">
      {!validCount ? <p className="mx-2 flex min-h-40 items-center justify-center rounded-xl bg-muted/60 p-5 text-center text-sm text-muted-foreground">{config.empty}</p> : <>
        <ul aria-label="Recorded chart legend" className="flex flex-wrap justify-end gap-x-4 gap-y-2 px-2 text-xs text-muted-foreground"><li className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />Recorded {config.title} ({config.unit})</li>{score && <li>WHO reference lines: −2 and −3 Z-score</li>}</ul>
        <div role="img" aria-label={'Recorded ' + config.title + ' by visit date, in ' + config.unit + '. ' + validCount + ' recorded values. Use the visit selector or text table below to explore.'} className="h-72 w-full min-w-0 sm:h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={plotData} margin={{ top: 16, right: 16, left: 0, bottom: 30 }} accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 5" />
              <XAxis dataKey="visit_date" tickFormatter={value => String(value).split('-').slice(1).join('/')} allowDuplicatedCategory={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} label={{ value: 'Visit date (month/day)', position: 'bottom', offset: 10, fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
              <YAxis width={60} domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickFormatter={value => Number(value).toFixed(1)} tickLine={false} axisLine={false} label={{ value: config.axis, angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
              <Tooltip trigger={tooltipTrigger} content={<RecordedGrowthTooltip metric={activeTab} />} allowEscapeViewBox={{ x: false, y: false }} />
              {score && <><ReferenceLine y={-2} ifOverflow="extendDomain" stroke="var(--color-muted-foreground)" strokeDasharray="4 4" label={{ value: 'WHO -2', position: 'insideTopLeft', fill: 'var(--color-muted-foreground)', fontSize: 11 }} /><ReferenceLine y={-3} ifOverflow="extendDomain" stroke="var(--color-muted-foreground)" strokeDasharray="4 4" label={{ value: 'WHO -3', position: 'insideTopLeft', fill: 'var(--color-muted-foreground)', fontSize: 11 }} /><ReferenceLine y={0} stroke="var(--color-border)" /></>}
              <Line dataKey={config.key} name={config.title + ' (' + config.unit + ')'} type="linear" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-primary)', stroke: 'var(--color-card)', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">{validCount === 1 ? 'One recorded value is available. More visits are needed to show a trend. ' : ''}Points are saved visits, not daily estimates. Missing values remain gaps.</p>
      </>}
      {selected && <div className="mx-2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-muted/60 p-3 text-xs sm:p-4">
        <label htmlFor={id + 'visit'} className="font-medium">Explore a recorded visit</label>
        <select id={id + 'visit'} value={selected.visit_date} onChange={event => setSelectedDate(event.target.value)} className="min-h-11 max-w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{chartData.map(visit => <option key={visit.id} value={visit.visit_date}>{formatCalendarDate(visit.visit_date)}</option>)}</select>
        <output htmlFor={id + 'visit'} aria-live="polite" className="min-w-0 flex-1 basis-44 leading-relaxed"><span className="block text-muted-foreground">{typeof selected.age_days === 'number' ? 'Age: ' + selected.age_days + ' days' : 'Age not recorded'}</span><span className="font-medium text-primary">{config.title}: {hasValue(selectedValue, config.key) ? selectedValue.toFixed(2) + ' ' + config.unit : 'Not recorded'}</span></output>
      </div>}
      {chartData.length > 0 && <details className="mx-2 rounded-xl border border-border/60">
        <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">View recorded values</summary>
        <div className="overflow-x-auto border-t border-border/60 p-3"><table className="w-full text-left text-xs"><caption className="sr-only">Recorded {config.title} values, including missing visits</caption><thead><tr className="text-muted-foreground"><th className="p-2 font-medium">Visit date</th><th className="p-2 font-medium">Age (days)</th><th className="p-2 font-medium">{config.title} ({config.unit})</th></tr></thead><tbody>{chartData.map(visit => <tr key={visit.id} className="border-t border-border/50"><td className="p-2">{formatCalendarDate(visit.visit_date)}</td><td className="p-2">{visit.age_days ?? 'Not recorded'}</td><td className="p-2">{hasValue(visit[config.key], config.key) ? Number(visit[config.key]).toFixed(2) : 'Not recorded'}</td></tr>)}</tbody></table></div>
      </details>}
    </CardContent>
  </Card>;
}
