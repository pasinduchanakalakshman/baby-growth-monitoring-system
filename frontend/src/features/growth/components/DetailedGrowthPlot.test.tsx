import { cloneElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GrowthCharts from './GrowthCharts';
import { DetailedRecordedTooltip } from './DetailedGrowthPlot';
import type { GrowthHistoryPoint } from '@/types/growth';
import { agePlotData } from '@/features/growth/detailedGrowthData';

const { capture, touchMode } = vi.hoisted(() => ({ capture: vi.fn(), touchMode: { current: false } }));
vi.mock('@/features/growth/useChartTooltipTrigger', () => ({
  useChartTooltipTrigger: () => touchMode.current ? 'click' : 'hover',
}));
vi.mock('recharts', async () => ({
  ...await vi.importActual('recharts'),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number; data?: unknown }> }) => {
    capture(children.props.data);
    return cloneElement(children, { width: 320, height: 384 });
  },
}));

const baby = { id: 1, sex: 'Male' as const, date_of_birth: '2023-01-01' };
const visits: GrowthHistoryPoint[] = [
  { id: 1, baby_id: 1, visit_date: '2023-02-01', age_days: 31, weight_kg: 4.56789, length_height_cm: 60, verified_waz: 0, verified_haz: -0.25 },
  { id: 2, baby_id: 1, visit_date: '2023-03-01', age_days: 59, weight_kg: 5.5, length_height_cm: null, verified_waz: -0.2, verified_haz: null },
  { id: 3, baby_id: 1, visit_date: '2023-05-01', age_days: 120, weight_kg: 6.2, length_height_cm: 66, verified_waz: -0.4, verified_haz: -0.5 },
];

beforeEach(() => { capture.mockClear(); touchMode.current = false; });

describe('detailed recorded growth plots', () => {
  it('shows profile birth weight at age zero with its own tooltip and unchanged visit records', async () => {
    const { container } = render(<GrowthCharts detailed baby={{ ...baby, birth_weight_kg: 3.21, birth_length_cm: 49.5 }} history={[visits[0]]} />);
    const birth = container.querySelector('.birth-measurement-dot')!;
    expect(birth).toHaveAttribute('fill', 'var(--color-card)');
    expect(Number(birth.getAttribute('cx'))).toBeLessThan(Number(container.querySelector('.recharts-line-dot')?.getAttribute('cx')));
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(1);
    expect(screen.getByText('1 visit')).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(capture.mock.lastCall?.[0]).toHaveLength(1);
    fireEvent.mouseEnter(birth);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Birth weight: 3.21 kg');
    expect(tooltip).toHaveTextContent('January 1, 2023');
    expect(tooltip).toHaveTextContent('Age: 0 days');
    expect(tooltip).toHaveTextContent('From saved birth details');
    fireEvent.click(screen.getByText('View recorded values'));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('February 1, 2023');
  });

  it('shows a saved birth length even if no visit lengths were recorded, and supports tapping it', async () => {
    const { container } = render(<GrowthCharts detailed baby={{ ...baby, birth_weight_kg: 3.2, birth_length_cm: 49.5 }} history={[{ ...visits[0], length_height_cm: null }]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Length / Height' }));
    expect(screen.queryByText('No length/height data recorded yet.')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.birth-measurement-dot')).toHaveLength(1);
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(0);
    expect(capture.mock.lastCall?.[0][0].length_height_cm).toBeNull();
    fireEvent.click(container.querySelector('.birth-measurement-dot')!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Birth length: 49.5 cm');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Age: 0 days');
    fireEvent.click(screen.getByText('View recorded values'));
    expect(screen.getByRole('table')).toHaveTextContent('Not recorded');
    expect(screen.getByText('1 visit')).toBeVisible();
  });

  it('retains the birth source for a touch gesture without a synthetic visit click', async () => {
    const { container } = render(<GrowthCharts detailed baby={{ ...baby, birth_weight_kg: 3.2 }} history={[visits[0]]} />);
    const birth = container.querySelector('.birth-measurement-dot')!;
    const allowed = fireEvent.touchEnd(birth, { changedTouches: [{ clientX: 0, clientY: 0 }] });
    expect(allowed).toBe(false);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Birth weight: 3.2 kg');
  });

  it('keeps birth and visit hover values distinct while switching between tabs', async () => {
    const { container } = render(<GrowthCharts detailed baby={{ ...baby, birth_weight_kg: 3.2, birth_length_cm: 49.5 }} history={[visits[0]]} />);
    fireEvent.mouseEnter(container.querySelector('.birth-measurement-dot')!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Birth weight: 3.2 kg');
    fireEvent.mouseLeave(container.querySelector('.birth-measurement-dot')!);
    fireEvent.mouseEnter(container.querySelector('.recharts-line-dot')!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Recorded Weight: 4.56789 kg');
    fireEvent.click(screen.getByRole('tab', { name: 'Length / Height' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(container.querySelector('.birth-measurement-dot')!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Birth length: 49.5 cm');
    for (const tab of ['WAZ', 'HAZ']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      expect(container.querySelector('.birth-measurement-dot')).not.toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    }
  });

  it('omits absent birth length and invalid birth weight without changing the shared Overview chart', () => {
    const { container, rerender } = render(<GrowthCharts detailed baby={{ ...baby, birth_weight_kg: 0 }} history={visits} />);
    expect(container.querySelector('.birth-measurement-dot')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Length / Height' }));
    expect(container.querySelector('.birth-measurement-dot')).not.toBeInTheDocument();
    rerender(<GrowthCharts baby={{ ...baby, birth_weight_kg: 3.2, birth_length_cm: 49.5 }} history={visits} />);
    expect(container.querySelector('.birth-measurement-dot')).not.toBeInTheDocument();
  });

  it('shows five labeled official curves for the matching child sex and exact recorded ages', () => {
    const supplied = Object.freeze([...visits].reverse());
    const { container } = render(<GrowthCharts detailed baby={baby} history={supplied as unknown as GrowthHistoryPoint[]} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/WHO reference percentiles for boys/);
    for (const label of ['3rd', '15th', '50th', '85th', '97th']) expect(screen.getByText(`${label} percentile`)).toBeVisible();
    expect(screen.getByText('Age (months)')).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(6);
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(3);
    expect(capture.mock.lastCall?.[0].map((point: { ageMonths: number }) => point.ageMonths)).toEqual([31, 59, 120].map(day => day / 30.4375));
    expect(supplied.map(point => point.id)).toEqual([3, 2, 1]);
    expect(screen.queryByRole('link', { name: 'WHO Child Growth Standards' })).not.toBeInTheDocument();
  });

  it('selects girls reference curves when biological sex is Female', () => {
    render(<GrowthCharts detailed baby={{ ...baby, sex: 'Female' }} history={visits} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/WHO reference percentiles for girls/);
    expect(screen.queryByRole('link', { name: 'WHO Child Growth Standards' })).not.toBeInTheDocument();
  });

  it('shows one real point without a child trend and keeps reference curves distinct', () => {
    const { container } = render(<GrowthCharts detailed baby={baby} history={[visits[0]]} />);
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(1);
    expect(screen.queryByText(/More visits are needed/)).not.toBeInTheDocument();
    const curves = [...container.querySelectorAll('.recharts-line-curve')];
    expect(curves.filter(curve => curve.getAttribute('stroke') === 'var(--color-primary)')).toHaveLength(0);
  });

  it('shows the single recorded weight on mouse hover, including on touch-capable devices', async () => {
    touchMode.current = true;
    const { container } = render(<GrowthCharts detailed baby={baby} history={[visits[0]]} />);
    const point = container.querySelector('.recharts-line-dot')!;
    fireEvent.mouseEnter(point);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText('Recorded Weight: 4.56789 kg')).toBeVisible();
    expect(tooltip).toHaveTextContent('February 1, 2023');
    expect(tooltip).toHaveTextContent('Age: 31 days');
    fireEvent.mouseLeave(container.querySelector('.recharts-line-dot')!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('switches hover tooltips directly between recorded points and leaves references without child tooltips', async () => {
    const { container } = render(<GrowthCharts detailed baby={baby} history={visits} />);
    fireEvent.mouseEnter(container.querySelectorAll('.recharts-line-dot')[0]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Recorded Weight: 4.56789 kg');
    fireEvent.mouseLeave(container.querySelectorAll('.recharts-line-dot')[0]);
    fireEvent.mouseEnter(container.querySelectorAll('.recharts-line-dot')[2]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Recorded Weight: 6.2 kg');
    fireEvent.mouseLeave(container.querySelectorAll('.recharts-line-dot')[2]);
    fireEvent.mouseEnter(container.querySelector('.recharts-line-curve')!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('preserves gaps and separates reference length from height without converting visits', () => {
    const { container } = render(<GrowthCharts detailed baby={baby} history={visits} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Length / Height' }));
    expect(capture.mock.lastCall?.[0].map((point: GrowthHistoryPoint) => point.length_height_cm)).toEqual([60, null, 66]);
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(2);
    const recordedLine = [...container.querySelectorAll('.recharts-line-curve')].find(curve => curve.getAttribute('stroke') === 'var(--color-primary)');
    expect(recordedLine?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
    expect(screen.queryByText(/Length reference through day 730/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(11);
    fireEvent.click(screen.getByText('View recorded values'));
    expect(screen.getByRole('table')).toHaveTextContent('Not recorded');
    expect(visits[1].length_height_cm).toBeNull();
  });

  it.each([['WAZ', 'Weight-for-Age Z-score'], ['HAZ', 'Length/Height-for-Age Z-score']])('shows five labeled z-score references and supplied scores for %s', (tab, axis) => {
    render(<GrowthCharts detailed baby={baby} history={visits} />);
    fireEvent.click(screen.getByRole('tab', { name: tab }));
    for (const label of ['WHO -3', 'WHO -2', 'WHO 0', 'WHO +2', 'WHO +3']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(axis)).toBeInTheDocument();
    expect(screen.getByText('Age (months)')).toBeInTheDocument();
    expect(screen.queryByText('50th percentile')).not.toBeInTheDocument();
    if (tab === 'WAZ') expect(capture.mock.lastCall?.[0].map((point: GrowthHistoryPoint) => point.verified_waz)).toEqual([0, -0.2, -0.4]);
    else expect(capture.mock.lastCall?.[0].map((point: GrowthHistoryPoint) => point.verified_haz)).toEqual([-0.25, null, -0.5]);
  });

  it('uses the existing birth-date age utility for missing API ages without adding points', () => {
    render(<GrowthCharts detailed baby={baby} history={visits.map(visit => ({ ...visit, age_days: undefined }))} />);
    expect(screen.getByText('Age (months)')).toBeInTheDocument();
    expect(capture.mock.lastCall?.[0]).toHaveLength(3);
    expect(capture.mock.lastCall?.[0][0].chartAgeDays).toBe(31);
  });

  it('falls back to recorded dates when age inputs are missing and never guesses sex', () => {
    const { container } = render(<GrowthCharts detailed history={visits.map(visit => ({ ...visit, age_days: undefined }))} />);
    expect(screen.getByText(/Age is unavailable for one or more visits/)).toBeVisible();
    expect(screen.getByText('Visit date (month/day)')).toBeInTheDocument();
    expect(screen.queryByText('50th percentile')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(3);
  });

  it('retains age positioning but omits reference curves without matching profile data', () => {
    render(<GrowthCharts detailed baby={{ ...baby, id: 2 }} history={visits} />);
    expect(screen.getByText('Age (months)')).toBeInTheDocument();
    expect(screen.getByText(/WHO reference curves are unavailable/)).toBeVisible();
    expect(screen.queryByText('50th percentile')).not.toBeInTheDocument();
  });

  it('never derives ages from another child profile when API ages are unavailable', () => {
    render(<GrowthCharts detailed baby={{ ...baby, id: 2 }} history={visits.map(visit => ({ ...visit, age_days: null }))} />);
    expect(screen.getByText('Visit date (month/day)')).toBeInTheDocument();
    expect(screen.queryByText('Age (months)')).not.toBeInTheDocument();
    expect(screen.queryByText('50th percentile')).not.toBeInTheDocument();
  });

  it('keeps the shared Overview chart on its existing measurement-only presentation', () => {
    render(<GrowthCharts baby={baby} history={visits} />);
    expect(screen.getByText('Visit date (month/day)')).toBeInTheDocument();
    expect(screen.queryByText('50th percentile')).not.toBeInTheDocument();
    expect(screen.queryByText('Age (months)')).not.toBeInTheDocument();
  });

  it('keeps all four tabs and the table when detailed values are missing', () => {
    render(<GrowthCharts detailed baby={baby} history={[{ ...visits[0], verified_haz: null }]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'HAZ' }));
    expect(screen.getByText('No HAZ available (requires length/height).')).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByText('1 visit')).toBeVisible();
    fireEvent.click(screen.getByText('View recorded values'));
    expect(screen.getByRole('table')).toHaveTextContent('Not recorded');
  });

  it('shows every horizontal month label and omits the marked sections while retaining the table', async () => {
    const { container } = render(<GrowthCharts detailed baby={baby} history={visits} />);
    await waitFor(() => {
      const labels = [...container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(label => label.textContent);
      expect(labels).toEqual(Array.from({ length: 61 }, (_, month) => String(month)));
    });
    expect(screen.getByRole('region', { name: 'Growth chart, scroll horizontally to view every month' })).toHaveAttribute('tabindex', '0');
    expect(screen.queryByText('Explore a recorded visit')).not.toBeInTheDocument();
    expect(screen.queryByText(/Points are saved visits|Missing values remain gaps|WHO Child Growth Standards/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('View recorded values'));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
  });

  it('pins the tapped real visit, supports another tap, and avoids stale tooltips across tabs', async () => {
    touchMode.current = true;
    const { container } = render(<GrowthCharts detailed baby={baby} history={visits} />);
    fireEvent.click(container.querySelectorAll('.recharts-line-dot')[0]);
    expect(await screen.findByText('Recorded Weight: 4.56789 kg')).toBeVisible();
    fireEvent.click(container.querySelectorAll('.recharts-line-dot')[2]);
    expect(await screen.findByText('Recorded Weight: 6.2 kg')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Length / Height' }));
    expect(screen.queryByText('Recorded Weight: 6.2 kg')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(2);
    fireEvent.click(container.querySelectorAll('.recharts-line-dot')[1]);
    expect(await screen.findByText('Recorded Length/Height: 66 cm')).toBeVisible();
  });
});

describe('detailed measurement tooltips', () => {
  it.each([
    ['weight_kg', 'Weight', 'kg', '4.56789'],
    ['length_height_cm', 'Length/Height', 'cm', '60'],
    ['verified_waz', 'Weight-for-Age', 'Z-score', '0'],
    ['verified_haz', 'Length/Height-for-Age', 'Z-score', '-0.25'],
  ] as const)('shows accurate dates, exact age and supplied %s with no estimated percentile', (key, title, unit, value) => {
    render(<DetailedRecordedTooltip active payload={[{ payload: agePlotData(visits)[0] }]} config={{ key, title, unit, axis: title }} />);
    expect(screen.getByText('February 1, 2023')).toBeVisible();
    expect(screen.getByText(/Age: 31 days/)).toBeVisible();
    expect(screen.getByText(`Recorded ${title}: ${value} ${unit}`)).toBeVisible();
    expect(screen.queryByText(/percentile|estimated|predicted/i)).not.toBeInTheDocument();
  });

  it('does not present a reference-only point or missing value as a recorded measurement', () => {
    const { container, rerender } = render(<DetailedRecordedTooltip active payload={[{ payload: { ageMonths: 1 } }]} config={{ key: 'weight_kg', title: 'Weight', unit: 'kg', axis: 'Weight' }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DetailedRecordedTooltip active payload={[{ payload: { ...agePlotData(visits)[0], verified_haz: null } }]} config={{ key: 'verified_haz', title: 'Length/Height-for-Age', unit: 'Z-score', axis: 'HAZ' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
