import { cloneElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewbornWeightJourneyChart, { JourneyTooltip } from './NewbornWeightJourneyChart';
import response from '@/test/fixtures/newbornWeightJourney.json';
import type { NewbornWeightJourney } from '@/types/growth';
import { apiClient } from '@/api/client';

const journey = response as NewbornWeightJourney;

// Preserve the real SVG and capture the exact data handed to Recharts.
const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => {
      capture(children.props.data);
      return cloneElement(children, { width: 320, height: 300 });
    },
  };
});

describe('newborn weight journey chart', () => {
  it('renders all backend points unchanged in a mobile SVG without writes or extra requests', () => {
    const get = vi.spyOn(apiClient, 'get');
    const post = vi.spyOn(apiClient, 'post');
    const put = vi.spyOn(apiClient, 'put');
    const { container } = render(<NewbornWeightJourneyChart journey={journey} />);
    expect(capture).toHaveBeenLastCalledWith(journey.points);
    expect(journey.points).toHaveLength(31);
    expect(screen.getByText(/Recorded birth weight: 3\.2 kg/)).toBeTruthy();
    expect(container.querySelector('svg.recharts-surface')?.getAttribute('width')).toBe('320');
    expect(container.querySelector('.recharts-line-curve')?.getAttribute('stroke-dasharray')).toBe('7 5');
    expect(container.querySelector('.recharts-reference-dot-dot')).toBeTruthy();
    expect(screen.getByText('Days after birth')).toBeTruthy();
    expect(screen.getByText('Illustrative weight (kg)')).toBeTruthy();
    expect(screen.getByText(journey.message)).toBeTruthy();
    ['At Birth', 'First Few Days', 'Weight Recovery', 'Continued Growth', 'When Should You Seek Advice?'].forEach(title => expect(screen.getByText(title)).toBeTruthy());
    expect(container.querySelector('input, form, a')).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('uses arbitrary supplied values rather than rebuilding a curve from birth weight', () => {
    const supplied = { ...journey, points: journey.points.map(p => p.day === 21 ? { ...p, weight_kg: 3.777 } : p) };
    render(<NewbornWeightJourneyChart journey={supplied} />);
    expect(capture).toHaveBeenLastCalledWith(supplied.points);
    expect(capture.mock.lastCall?.[0][21].weight_kg).toBe(3.777);
  });

  it.each(['missing_gestational_age', 'unsupported_gestational_age', 'low_birth_weight', 'reference_unavailable'])('shows backend educational message without a curve for %s', reason => {
    const { container } = render(<NewbornWeightJourneyChart journey={{ ...journey, available: false, points: [], reason, message: 'Please ask your healthcare provider for individual guidance.' }} />);
    expect(screen.getByText(/Please ask your healthcare provider/)).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('input, form, a')).toBeNull();
  });

  it('handles an empty response', () => {
    const { container } = render(<NewbornWeightJourneyChart />);
    expect(screen.getByText(/recorded birth details could not be loaded/)).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows loading without a stale curve', () => {
    const { container } = render(<NewbornWeightJourneyChart journey={journey} isLoading />);
    expect(screen.getByRole('status', { name: 'Loading newborn weight journey' })).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows an error and supports retry without a stale curve', () => {
    const onRetry = vi.fn();
    const { container } = render(<NewbornWeightJourneyChart journey={journey} error onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(container.querySelector('svg')).toBeNull();
  });

  it.each([0, 3, 10, 12, 30])('distinguishes recorded and illustrative tooltip values at day %s', day => {
    render(<JourneyTooltip active payload={[{ payload: journey.points[day] }]} />);
    expect(screen.getByText(`${day === 0 ? 'Recorded birth weight' : 'Illustrative example'}: ${journey.points[day].weight_kg.toFixed(2)} kg`)).toBeTruthy();
  });

  it.each([0, 3, 12, 30])('explores exact returned values for day %s without entering a measurement', day => {
    const { container } = render(<NewbornWeightJourneyChart journey={journey} />);
    fireEvent.change(screen.getByLabelText('Explore a day'), { target: { value: String(day) } });
    const point = journey.points[day];
    expect(screen.getByRole('status')).toHaveTextContent(`${day === 0 ? 'Recorded birth weight' : 'Illustrative example'}: ${point.weight_kg.toFixed(2)} kg`);
    expect(container.querySelector('input, form')).toBeNull();
    expect(capture).toHaveBeenLastCalledWith(journey.points);
  });

  it('keeps essential limitations visible while allowing secondary explanations to expand', () => {
    const { container } = render(<NewbornWeightJourneyChart journey={journey} />);
    expect(screen.getByText(journey.message)).toBeVisible();
    journey.limitations.forEach(text => expect(screen.getByText(text)).toBeVisible());
    const detail = container.querySelector('details')!;
    expect(detail).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Understanding this journey and when to seek advice'));
    expect(detail).toHaveAttribute('open');
    expect(screen.getByText('Has difficulty feeding.')).toBeVisible();
    expect(screen.getByText(/Recorded visit weights, when available/)).toBeVisible();
  });
});
