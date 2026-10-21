import { cloneElement, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeightHistoryChart from './WeightHistoryChart';

vi.mock('recharts', async () => ({
  ...await vi.importActual('recharts'),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => cloneElement(children, { width: 360, height: 288 }),
}));

const points = [
  { date: '2026-01-01', weightKg: 3.69 },
  { date: '2026-01-11', weightKg: 3.9 },
  { date: '2026-01-31', weightKg: 4.3 },
];

describe('Recorded weight history chart', () => {
  it('spaces visits by elapsed time, preserves every value and leaves supplied points unchanged', () => {
    const supplied = Object.freeze([...points].reverse());
    const { container } = render(<WeightHistoryChart points={supplied as typeof points} />);
    const positions = [...container.querySelectorAll('.weight-history-dot')].map(dot => Number(dot.getAttribute('cx')));
    expect(positions).toHaveLength(3);
    expect((positions[2] - positions[1]) / (positions[1] - positions[0])).toBeCloseTo(2, 5);
    expect(supplied.map(point => point.weightKg)).toEqual([4.3, 3.9, 3.69]);
    fireEvent.click(screen.getByText('View saved weight checks'));
    expect(screen.getByTestId('weight-chart-points')).toHaveTextContent('1 Jan 2026');
    expect(screen.getByTestId('weight-chart-points')).toHaveTextContent('3.69 kg');
    expect(screen.getByTestId('weight-chart-points')).toHaveTextContent('31 Jan 2026');
    expect(screen.getByTestId('weight-chart-points')).toHaveTextContent('4.30 kg');
  });

  it('supports previous/next controls, point selection and hover with exact saved values', () => {
    const { container } = render(<WeightHistoryChart points={points} />);
    const reading = () => screen.getByTestId('selected-weight-visit');
    expect(reading()).toHaveTextContent('Latest visit');
    expect(reading()).toHaveTextContent('4.30 kg');
    expect(screen.getByRole('button', { name: 'Next weight check' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous weight check' }));
    expect(reading()).toHaveTextContent('11 Jan 2026');
    expect(reading()).toHaveTextContent('3.90 kg');
    fireEvent.click(screen.getByRole('button', { name: 'Next weight check' }));
    expect(reading()).toHaveTextContent('4.30 kg');
    fireEvent.click(container.querySelector('[data-weight-check="0"]')!);
    expect(reading()).toHaveTextContent('3.69 kg');
    expect(screen.getByRole('button', { name: 'Previous weight check' })).toBeDisabled();
    fireEvent.mouseEnter(container.querySelector('[data-weight-check="2"]')!);
    expect(reading()).toHaveTextContent('4.30 kg');
  });

  it('shows one saved measurement without inventing a trend or another visit', () => {
    const { container } = render(<WeightHistoryChart points={[points[0]]} />);
    expect(container.querySelectorAll('.weight-history-dot')).toHaveLength(1);
    expect(container.querySelector('.recharts-line-curve')).toBeNull();
    expect(screen.getByRole('button', { name: 'Previous weight check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next weight check' })).toBeDisabled();
    expect(screen.getByText(/One weight check is saved/)).toBeVisible();
  });

  it('omits invalid chart inputs without creating zero values or placeholder visits', () => {
    const { container } = render(<WeightHistoryChart points={[{ date: 'bad-date', weightKg: 4 }, { date: '2026-01-01', weightKg: NaN }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
