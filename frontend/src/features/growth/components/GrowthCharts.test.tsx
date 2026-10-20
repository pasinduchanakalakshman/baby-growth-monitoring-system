import { cloneElement, type ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import GrowthCharts, { RecordedGrowthTooltip } from './GrowthCharts';
import type { GrowthHistoryPoint } from '@/types/growth';

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('recharts', async () => ({
  ...await vi.importActual('recharts'),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number; data?: unknown }> }) => {
    capture(children.props.data);
    return cloneElement(children, { width: 320, height: 300 });
  },
}));

const mockHistory: GrowthHistoryPoint[] = [
  { id: 1, baby_id: 1, visit_date: '2023-01-01', age_days: 31, weight_kg: 5.5, length_height_cm: null, verified_waz: -1.2, verified_haz: null },
  { id: 2, baby_id: 1, visit_date: '2023-02-01', age_days: 62, weight_kg: 6.2, length_height_cm: 61, verified_waz: -0.5, verified_haz: -0.1 },
];

describe('GrowthCharts Component', () => {
  it('renders the four existing measurement tabs with an active state', () => {
    render(<GrowthCharts history={mockHistory} />);
    ['Weight', 'Length / Height', 'WAZ', 'HAZ'].forEach(name => expect(screen.getByRole('tab', { name })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Weight' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Length / Height and handles missing height without hiding genuine values', () => {
    render(<GrowthCharts history={mockHistory} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Length / Height' }));
    expect(screen.queryByText('No length/height data recorded yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Length/Height: 61.00 cm');
    expect(capture.mock.lastCall?.[0][0].length_height_cm).toBeNull();
  });

  it('displays an informative HAZ empty state without plotting artificial values', () => {
    const { container } = render(<GrowthCharts history={[mockHistory[0]]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'HAZ' }));
    expect(screen.getByText('No HAZ available (requires length/height).')).toBeVisible();
    expect(container.querySelector('svg.recharts-surface')).toBeNull();
  });

  it('sorts history chronologically without mutating the supplied records', () => {
    const supplied = Object.freeze([mockHistory[1], mockHistory[0]]);
    render(<GrowthCharts history={supplied as unknown as GrowthHistoryPoint[]} />);
    expect(capture.mock.lastCall?.[0].map((p: GrowthHistoryPoint) => p.id)).toEqual([1, 2]);
    expect(supplied.map(p => p.id)).toEqual([2, 1]);
    fireEvent.click(screen.getByText('View recorded values'));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('January 1, 2023');
    expect(rows[2]).toHaveTextContent('February 1, 2023');
  });

  it('supports arrow, Home and End keyboard navigation between tabs', () => {
    render(<GrowthCharts history={mockHistory} />);
    const weight = screen.getByRole('tab', { name: 'Weight' });
    weight.focus();
    fireEvent.keyDown(weight, { key: 'ArrowRight' });
    const height = screen.getByRole('tab', { name: 'Length / Height' });
    expect(height).toHaveFocus();
    expect(height).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(height, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'HAZ' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'HAZ' }), { key: 'Home' });
    expect(weight).toHaveFocus();
  });

  it.each([['Weight', 'Weight (kg)'], ['Length / Height', 'Length/Height (cm)'], ['WAZ', 'Z-score'], ['HAZ', 'Z-score']])('renders correct units for %s in a real mobile SVG', (name, axis) => {
    const { container } = render(<GrowthCharts history={mockHistory} />);
    fireEvent.click(screen.getByRole('tab', { name }));
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('width', '320');
    expect(screen.getByText('Visit date (month/day)')).toBeInTheDocument();
    expect(within(screen.getByRole('img', { name: /Recorded .*by visit date/ })).getByText(axis)).toBeInTheDocument();
  });

  it('retains a missing middle value as a gap instead of connecting around it', () => {
    render(<GrowthCharts history={[{ ...mockHistory[0], length_height_cm: 59 }, { ...mockHistory[0], id: 3, visit_date: '2023-01-15', length_height_cm: null }, mockHistory[1]]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Length / Height' }));
    expect(capture.mock.lastCall?.[0].map((p: GrowthHistoryPoint) => p.length_height_cm)).toEqual([59, null, 61]);
    fireEvent.change(screen.getByLabelText('Explore a recorded visit'), { target: { value: '2023-01-15' } });
    expect(screen.getByRole('status')).toHaveTextContent('Not recorded');
  });

  it('preserves zero Z-scores and the existing WHO reference values', () => {
    render(<GrowthCharts history={[{ ...mockHistory[0], verified_waz: 0 }]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'WAZ' }));
    expect(screen.getByRole('status')).toHaveTextContent('Weight-for-Age: 0.00 Z-score');
    expect(screen.getByText('WHO -2')).toBeInTheDocument();
    expect(screen.getByText('WHO -3')).toBeInTheDocument();
    expect(screen.queryByText(/Normal range|Predicted|Healthy/)).not.toBeInTheDocument();
  });

  it('preserves a single real point and explains the lack of a trend', () => {
    const { container } = render(<GrowthCharts history={[mockHistory[0]]} />);
    expect(container.querySelector('.recharts-line-dot')).toBeInTheDocument();
    expect(screen.getByText(/One recorded value is available/)).toBeVisible();
  });

  it('shows no-data and missing-score states without zero placeholders', () => {
    const { container } = render(<GrowthCharts history={[]} />);
    expect(screen.getByText('No recorded weights available.')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'WAZ' }));
    expect(screen.getByText('No weight-for-age scores recorded yet.')).toBeVisible();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('explores recorded dates and values without changing measurement data', () => {
    render(<GrowthCharts history={mockHistory} />);
    fireEvent.change(screen.getByLabelText('Explore a recorded visit'), { target: { value: '2023-01-01' } });
    expect(screen.getByRole('status')).toHaveTextContent('Age: 31 days');
    expect(screen.getByRole('status')).toHaveTextContent('Weight: 5.50 kg');
    expect(mockHistory[0].weight_kg).toBe(5.5);
  });

  it('keeps measurement date, age and units in the recorded tooltip', () => {
    render(<RecordedGrowthTooltip active metric="weight" payload={[{ payload: mockHistory[0] }]} />);
    expect(screen.getByText('January 1, 2023')).toBeVisible();
    expect(screen.getByText('Age: 31 days')).toBeVisible();
    expect(screen.getByText('Recorded Weight: 5.50 kg')).toBeVisible();
  });
});
