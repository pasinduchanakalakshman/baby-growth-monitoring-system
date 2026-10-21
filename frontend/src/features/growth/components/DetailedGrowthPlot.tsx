import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { GrowthHistoryPoint } from '@/types/growth';
import { formatCalendarDate } from '@/utils/growthDisplay';
import {
  agePlotData, birthMeasurement, whoDaysPerMonth, whoPercentiles, whoReference,
  type BirthMeasurement, type DetailedMetric, type GrowthChartProfile, type RecordedMetricKey,
} from '@/features/growth/detailedGrowthData';

type ChartConfig = { key: RecordedMetricKey; title: string; unit: string; axis: string };
type PlotPoint = ReturnType<typeof agePlotData>[number];

const scoreReferences = [
  { value: -3, color: '#be436d', tint: '#fff0f5' },
  { value: -2, color: '#a86c13', tint: '#fff6e5' },
  { value: 0, color: '#177d76', tint: '#ebf9f3' },
  { value: 2, color: '#287db3', tint: '#edf6ff' },
  { value: 3, color: '#7952b7', tint: '#f5efff' },
];

function RecordedMeasurementDot({ cx, cy, index, selectedIndex, onShow, onLeave, birth = false, emphasized = false }: {
  cx?: number; cy?: number; index?: number; selectedIndex?: number;
  birth?: boolean;
  emphasized?: boolean;
  onShow: (element: SVGCircleElement, index: number, cx: number, cy: number, pinned: boolean) => void;
  onLeave: () => void;
}) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || index === undefined) return null;
  return <circle className={birth ? 'birth-measurement-dot' : 'recharts-line-dot'} data-recorded-index={birth ? undefined : index} data-birth-measurement={birth ? 'true' : undefined} cx={cx} cy={cy} r={selectedIndex === index ? emphasized ? 8 : 6.5 : emphasized ? 6 : birth ? 5 : 4.5} fill={birth ? 'var(--color-card)' : 'var(--color-primary)'} stroke={birth ? 'var(--color-primary)' : 'var(--color-card)'} strokeWidth={emphasized ? 2.5 : 2}
    onMouseEnter={event => onShow(event.currentTarget, index, cx!, cy!, false)}
    onMouseLeave={onLeave}
    onTouchEnd={event => {
      const touch = event.changedTouches[0];
      const bounds = event.currentTarget.getBoundingClientRect();
      if (!touch || touch.clientX < bounds.left || touch.clientX > bounds.right || touch.clientY < bounds.top || touch.clientY > bounds.bottom) return;
      // Keep the tapped marker's source when nearby birth/visit points overlap.
      // Cancel the synthetic mouse click so it cannot select a different point.
      event.preventDefault();
      event.stopPropagation();
      onShow(event.currentTarget, index, cx!, cy!, true);
    }}
    onClick={event => {
      event.stopPropagation();
      onShow(event.currentTarget, index, cx!, cy!, true);
    }}
  />;
}

export function DetailedRecordedTooltip({ active, payload, config, birth }: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Partial<PlotPoint> }>;
  config: ChartConfig;
  birth?: BirthMeasurement | null;
}) {
  // Reference-only payloads never become a child's measurement or percentile.
  const visit = payload?.find(entry => typeof entry.payload?.visit_date === 'string')?.payload;
  const value = birth ? birth.value : visit?.[config.key];
  if (!active || (!visit && !birth) || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const days = birth ? 0 : visit?.chartAgeDays;
  return <div className="max-w-56 rounded-xl border border-border/60 bg-card p-3 text-sm shadow-card">
    <p className="font-semibold">{formatCalendarDate(birth ? birth.date : visit?.visit_date)}</p>
    <p className="mt-1 text-xs text-muted-foreground">{typeof days === 'number' ? `Age: ${days} days (${(days / whoDaysPerMonth).toFixed(2)} months)` : 'Age not recorded'}</p>
    <p className="mt-1 font-medium text-primary">{birth ? birth.label : `Recorded ${config.title}`}: {value} {config.unit}</p>
    {birth && <p className="mt-1 text-xs text-muted-foreground">From saved birth details</p>}
  </div>;
}

export default function DetailedGrowthPlot({ history, metric, config, baby }: {
  history: GrowthHistoryPoint[];
  metric: DetailedMetric;
  config: ChartConfig;
  baby?: GrowthChartProfile;
}) {
  const [activePoint, setActivePoint] = useState<{
    metric: DetailedMetric; index: number; left: number; top: number; pinned: boolean; source: 'visit' | 'birth';
  } | null>(null);
  const selectedPoint = activePoint?.metric === metric ? activePoint : null;
  const matchingProfile = baby && history.every(visit => visit.baby_id === baby.id);
  const birthDate = matchingProfile ? baby.date_of_birth : undefined;
  const data = useMemo(() => agePlotData(history, birthDate), [history, birthDate]);
  const hasAges = data.every(visit => visit.ageMonths !== null);
  const birth = hasAges ? birthMeasurement(metric, baby, history) : null;
  const score = metric === 'waz' || metric === 'haz';
  const scores = score ? data.flatMap(visit => {
    const value = visit[config.key];
    return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
  }) : [];
  // Shading follows the existing reference levels and never classifies a visit.
  const scoreBands = [
    { from: Math.min(-3.5, ...scores), to: -3, fill: '#fff0f5' },
    { from: -3, to: -2, fill: '#fff6e5' },
    { from: -2, to: 2, fill: '#ebf9f3' },
    { from: 2, to: 3, fill: '#edf6ff' },
    { from: 3, to: Math.max(3.5, ...scores), fill: '#f5efff' },
  ];
  const reference = useMemo(() => hasAges && matchingProfile ? whoReference(metric, baby.sex) : null, [hasAges, matchingProfile, metric, baby]);
  const lastReference = reference?.segments.at(-1)?.at(-1);
  const referenceEnd = lastReference?.ageMonths ?? 60;
  const maxAge = Math.max(referenceEnd, ...data.map(visit => visit.ageMonths ?? 0));
  const validCount = data.filter(visit => typeof visit[config.key] === 'number' && Number.isFinite(visit[config.key])).length;
  const axisTitle = metric === 'waz' ? 'Weight-for-Age Z-score' : metric === 'haz' ? 'Length/Height-for-Age Z-score' : config.axis;

  function showPoint(element: SVGCircleElement, index: number, cx: number, cy: number, pinned: boolean, source: 'visit' | 'birth' = 'visit') {
    const width = element.ownerSVGElement?.getBoundingClientRect().width ?? 0;
    const viewport = element.closest<HTMLElement>('[data-chart-scroll]');
    const visibleLeft = viewport?.scrollLeft ?? 0;
    const visibleWidth = viewport?.clientWidth || width;
    // Anchor the tooltip to this saved visit, independently of reference-series
    // indices and the device's primary input type (touchscreen laptops can hover).
    const next = {
      metric, index, pinned, source,
      left: Math.max(visibleLeft + 8, Math.min(cx + 12, visibleLeft + visibleWidth - 232)),
      top: Math.max(8, cy - 104),
    };
    setActivePoint(previous => previous?.metric === metric && previous.index === index && previous.source === source && previous.pinned === pinned && previous.left === next.left && previous.top === next.top ? previous : next);
  }

  return <>
    <ul aria-label="Recorded chart legend" className="flex flex-wrap gap-x-4 gap-y-2 px-2 text-xs text-muted-foreground">
      <li className="inline-flex items-center gap-2 font-medium text-primary"><span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />Recorded {config.title} ({config.unit})</li>
      {birth && <li className="inline-flex items-center gap-2 font-medium text-primary"><span aria-hidden="true" className="size-2.5 rounded-full border-2 border-primary bg-card" />{birth.label} ({config.unit})</li>}
      {reference && whoPercentiles.map(percentile => <li key={percentile.key} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4" style={{ background: percentile.color }} />{percentile.label} percentile</li>)}
      {score && scoreReferences.map(reference => <li key={reference.value} className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-medium" style={{ color: reference.color, backgroundColor: reference.tint, borderColor: `${reference.color}30` }}><span aria-hidden="true" className="w-4 border-t-2" style={{ borderColor: reference.color, borderStyle: reference.value === 0 ? 'solid' : 'dashed' }} />{reference.value > 0 ? '+' : ''}{reference.value} Z-score</li>)}
    </ul>
    {!hasAges && <p role="note" className="px-2 text-xs leading-relaxed text-muted-foreground">Age is unavailable for one or more visits. Showing recorded measurements by date.</p>}
    {hasAges && !score && !reference && <p role="note" className="px-2 text-xs leading-relaxed text-muted-foreground">WHO reference curves are unavailable for the current birth details. Recorded measurements are shown.</p>}
    <div data-chart-scroll role="region" aria-label="Growth chart, scroll horizontally to view every month" tabIndex={0} className={`w-full min-w-0 overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-ring${score ? ' rounded-2xl border border-border/60 bg-muted/20' : ''}`}>
    <div role="img" aria-label={`Recorded ${config.title} by ${hasAges ? 'age in months' : 'visit date'}, in ${config.unit}. ${validCount} recorded values.${birth ? ` ${birth.label} from the baby profile at age zero.` : ''}${reference ? ` WHO reference percentiles for ${reference.sexLabel}.` : ''} Hover or tap a point, or use the text table below to explore.`} className="relative h-80 w-full sm:h-96" style={{ minWidth: hasAges ? Math.max(1280, (Math.floor(maxAge) + 1) * 20 + 100) : undefined }}
      onClick={() => setActivePoint(null)}
      onMouseLeave={() => setActivePoint(previous => previous?.pinned ? previous : null)}
      onMouseMove={event => {
        const point = event.target instanceof Element ? event.target.closest<SVGCircleElement>('circle[data-recorded-index], circle[data-birth-measurement]') : null;
        if (point) showPoint(point, Number(point.dataset.recordedIndex ?? 0), point.cx.baseVal.value, point.cy.baseVal.value, false, point.dataset.birthMeasurement ? 'birth' : 'visit');
        else setActivePoint(previous => previous?.pinned ? previous : null);
      }}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 16, right: reference ? 38 : 16, left: 0, bottom: 30 }} accessibilityLayer={false}>
          {score && scoreBands.map(band => <ReferenceArea key={band.from} y1={band.from} y2={band.to} fill={band.fill} fillOpacity={1} stroke="none" zIndex={-200} pointerEvents="none" />)}
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 5" />
          <XAxis
            dataKey={hasAges ? 'ageMonths' : 'visit_date'} type={hasAges ? 'number' : 'category'}
            domain={hasAges ? [0, maxAge] : undefined} ticks={hasAges ? Array.from({ length: Math.floor(maxAge) + 1 }, (_, month) => month) : undefined}
            tickFormatter={value => hasAges ? String(Number(value)) : String(value).split('-').slice(1).join('/')}
            allowDuplicatedCategory={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
            tickLine={false} axisLine={false} tickMargin={8} minTickGap={hasAges ? 0 : 20} interval={hasAges ? 0 : 'preserveEnd'}
            label={{ value: hasAges ? 'Age (months)' : 'Visit date (month/day)', position: 'bottom', offset: 10, fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          />
          <YAxis width={60} domain={score ? [(min: number) => Math.min(-3.5, min), (max: number) => Math.max(3.5, max)] : ['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={value => Number(value).toFixed(1)} label={{ value: axisTitle, angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
          {reference?.segments.flatMap((segment, index) => whoPercentiles.map(percentile => <Line
            key={`${percentile.key}-${index}`} data={segment} dataKey={percentile.key}
            name={`${percentile.label} percentile`} type="monotoneX" stroke={percentile.color}
            strokeWidth={percentile.key === 'p50' ? 1.7 : 1.2} dot={false} activeDot={false}
            tooltipType="none" legendType="none" isAnimationActive={false} connectNulls={false}
          />))}
          {lastReference && whoPercentiles.map(percentile => <ReferenceDot key={percentile.key} x={lastReference.ageMonths} y={lastReference[percentile.key]} r={0} label={{ value: percentile.label, position: 'right', fill: percentile.color, fontSize: 10 }} />)}
          {score && scoreReferences.map(({ value, color }) => <ReferenceLine key={value} y={value} ifOverflow="extendDomain" stroke={color} strokeWidth={value === 0 ? 1.75 : 1.2} strokeDasharray={value === 0 ? undefined : '5 5'} strokeOpacity={0.8} label={{ value: `WHO ${value > 0 ? '+' : ''}${value}`, position: 'insideTopRight', fill: color, fontSize: 11 }} />)}
          <Line dataKey={config.key} name={`Recorded ${config.title}`} type="linear" stroke={validCount > 1 ? 'var(--color-primary)' : 'none'} strokeWidth={score ? 3.25 : 2.75} dot={<RecordedMeasurementDot emphasized={score}
            selectedIndex={selectedPoint?.source === 'visit' ? selectedPoint.index : undefined} onShow={showPoint}
            onLeave={() => setActivePoint(previous => previous?.pinned ? previous : null)}
          />} activeDot={false} isAnimationActive={false} connectNulls={false} />
          {birth && <ReferenceDot x={0} y={birth.value} zIndex={1000} ifOverflow="extendDomain" shape={<RecordedMeasurementDot
            birth index={0} selectedIndex={selectedPoint?.source === 'birth' ? 0 : undefined}
            onShow={(element, index, cx, cy, pinned) => showPoint(element, index, cx, cy, pinned, 'birth')}
            onLeave={() => setActivePoint(previous => previous?.pinned ? previous : null)}
          />} />}
        </LineChart>
      </ResponsiveContainer>
      {selectedPoint && (selectedPoint.source === 'birth' ? birth : data[selectedPoint.index]) && <div role="tooltip" className="pointer-events-none absolute z-10 w-56 max-w-[calc(100%-1rem)]" style={{ left: selectedPoint.left, top: selectedPoint.top }}>
        <DetailedRecordedTooltip active birth={selectedPoint.source === 'birth' ? birth : null} payload={selectedPoint.source === 'visit' ? [{ payload: data[selectedPoint.index] }] : undefined} config={config} />
      </div>}
    </div>
    </div>
  </>;
}
