import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { calendarDate, shortDate } from '@/features/dashboard/dashboardDisplay';
import type { WeightHistoryPointSimple } from '@/utils/explanationDisplay';

export default function WeightHistoryChart({ points }: { points: WeightHistoryPointSimple[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const data = points.flatMap(point => {
    const date = calendarDate(point.date);
    return date && Number.isFinite(point.weightKg) && point.weightKg > 0
      ? [{ ...point, time: Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) }] : [];
  }).sort((a, b) => a.time - b.time);
  const match = data.findIndex(point => point.date === selectedDate);
  const selectedIndex = match >= 0 ? match : data.length - 1;
  const selected = data[selectedIndex];
  if (!selected) return null;

  const day = 86400000;
  const first = data[0];
  const last = data[data.length - 1];
  const dateLabel = (value: number) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return <div data-testid="weight-history-chart" className="min-w-0 space-y-4 rounded-2xl border border-primary/10 bg-gradient-to-b from-primary/5 to-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-foreground">Weight over time</h4>
      <span className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground">{data.length} {data.length === 1 ? 'check' : 'checks'} recorded</span>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-3 sm:px-4">
      <div aria-live="polite" aria-atomic="true" data-testid="selected-weight-visit">
        <p className="text-xs text-muted-foreground">{selectedIndex === data.length - 1 ? 'Latest visit' : 'Selected visit'} · {shortDate(selected.date)}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-primary">{selected.weightKg.toFixed(2)} <span className="text-sm font-medium">kg</span></p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-11 rounded-full" aria-label="Previous weight check" disabled={selectedIndex === 0} onClick={() => setSelectedDate(data[selectedIndex - 1].date)}><ChevronLeft aria-hidden="true" /></Button>
        <span className="min-w-10 text-center text-xs text-muted-foreground">{selectedIndex + 1} of {data.length}</span>
        <Button variant="outline" size="icon" className="size-11 rounded-full" aria-label="Next weight check" disabled={selectedIndex === data.length - 1} onClick={() => setSelectedDate(data[selectedIndex + 1].date)}><ChevronRight aria-hidden="true" /></Button>
      </div>
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Weight (kg)</span><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-primary" />Saved measurements</span></div>
    <div className="min-w-0 overflow-x-auto overscroll-x-contain">
      <div role="img" aria-label="Weight history chart. Select a point or use the previous and next weight check buttons to read a visit. A text list is available below." className="h-60 w-full sm:h-72" style={{ minWidth: data.length > 8 ? data.length * 36 + 80 : undefined }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ top: 16, right: 24, bottom: 24, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} strokeDasharray="3 5" />
            <XAxis type="number" dataKey="time" domain={data.length === 1 ? [first.time - day, first.time + day] : [first.time, last.time]} ticks={data.map(point => point.time)} tickFormatter={dateLabel} minTickGap={36} interval="preserveStartEnd" padding={{ left: 20, right: 20 }} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} tickMargin={10} tickLine={false} axisLine={false} label={{ value: 'Visit date', position: 'bottom', offset: 10, fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
            <YAxis width={48} domain={[(min: number) => Math.max(0, min - 0.2), (max: number) => max + 0.2]} tickCount={4} tickFormatter={value => Number(value).toFixed(2)} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
            <Line dataKey="weightKg" type="linear" stroke={data.length > 1 ? 'var(--color-primary)' : 'none'} strokeWidth={3} dot={<WeightPoint selectedIndex={selectedIndex} onSelect={index => setSelectedDate(data[index].date)} />} activeDot={false} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{data.length === 1 ? 'One weight check is saved. Another visit is needed to show a change over time.' : 'Tap a dot or use the arrows to view a saved weight check.'}</p>
    <details className="rounded-xl border border-border/60 bg-card text-sm">
      <summary className="min-h-11 cursor-pointer rounded-xl px-3 py-3 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">View saved weight checks</summary>
      <ul className="space-y-3 border-t border-border/60 p-3" data-testid="weight-chart-points">{data.map(point => <li key={point.date} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs"><span className="text-muted-foreground">{shortDate(point.date)}</span><span className="font-semibold tabular-nums">{point.weightKg.toFixed(2)} kg</span></li>)}</ul>
    </details>
  </div>;
}

function WeightPoint({ cx, cy, index, selectedIndex, onSelect }: {
  cx?: number; cy?: number; index?: number; selectedIndex: number; onSelect: (index: number) => void;
}) {
  if (cx === undefined || cy === undefined || index === undefined) return null;
  const selected = selectedIndex === index;
  return <g data-weight-check={index} className="cursor-pointer" onMouseEnter={() => onSelect(index)} onClick={() => onSelect(index)}>
    <circle cx={cx} cy={cy} r={16} fill="transparent" />
    {selected && <circle cx={cx} cy={cy} r={12} fill="var(--color-primary)" fillOpacity={0.12} />}
    <circle className="weight-history-dot" cx={cx} cy={cy} r={selected ? 6 : 5} fill={selected ? 'var(--color-primary)' : 'var(--color-card)'} stroke="var(--color-primary)" strokeWidth={2.5} />
  </g>;
}
