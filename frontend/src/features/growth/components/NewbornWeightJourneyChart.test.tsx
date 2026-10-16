import { cloneElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewbornWeightJourneyChart, { JourneyTooltip } from './NewbornWeightJourneyChart';
import { apiClient } from '@/api/client';

// Give the real Recharts SVG a mobile-sized container in JSDOM.
vi.mock('recharts', async () => ({
  ...await vi.importActual('recharts'),
  ResponsiveContainer: ({ children }: any) => cloneElement(children, { width: 320, height: 300 }),
}));

describe('newborn weight journey chart', () => {
  it('renders locally without API reads, prediction requests or measurement writes', () => {
    const get = vi.spyOn(apiClient, 'get');
    const post = vi.spyOn(apiClient, 'post');
    const put = vi.spyOn(apiClient, 'put');
    const { unmount } = render(<NewbornWeightJourneyChart birthWeightKg={3.2} gestationalAgeWeeks={39} />);
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    unmount();
    vi.restoreAllMocks();
  });
  it.each([2.8, 3.2, 3.8])('renders a real mobile-sized SVG for %s kg', birth => {
    const { container } = render(<NewbornWeightJourneyChart birthWeightKg={birth} gestationalAgeWeeks={39} />);
    expect(screen.getByText(`● Recorded birth weight: ${birth} kg`)).toBeTruthy();
    expect(container.querySelector('svg.recharts-surface')?.getAttribute('width')).toBe('320');
    expect(container.querySelector('.recharts-line-curve')?.getAttribute('stroke-dasharray')).toBe('7 5');
    expect(container.querySelector('.recharts-reference-dot-dot')).toBeTruthy();
    expect(screen.getByText('Days after birth')).toBeTruthy();
    expect(screen.getByText('Illustrative weight (kg)')).toBeTruthy();
    expect(screen.getByText(/not measurements or exact predictions/)).toBeTruthy();
    ['At Birth', 'First Few Days', 'Weight Recovery', 'Continued Growth', 'When Should You Seek Advice?'].forEach(title => expect(screen.getByText(title)).toBeTruthy());
    expect(container.querySelector('input, form, a')).toBeNull();
  });
  it.each([undefined, null, 0, -3, NaN, Infinity])('handles unavailable birth weight %s', birth => {
    const { container } = render(<NewbornWeightJourneyChart birthWeightKg={birth} />);
    expect(screen.getByText(/valid recorded birth weight is unavailable/)).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });
  it.each([undefined, null, 32, 36, 42, NaN])('limits the example for unconfirmed term status %s', weeks => {
    render(<NewbornWeightJourneyChart birthWeightKg={3.2} gestationalAgeWeeks={weeks} />);
    expect(screen.getByText(/term status is not established/)).toBeTruthy();
    expect(screen.getByText(/unwell or need special care/)).toBeTruthy();
  });
  it.each([0, 3, 12, 30])('distinguishes recorded and illustrative tooltip values at day %s', day => {
    render(<JourneyTooltip active payload={[{ payload: { day, illustrativeWeightKg: 3.2, phase: 'Recovery' } }]} />);
    expect(screen.getByText(`${day === 0 ? 'Recorded birth weight' : 'Illustrative example'}: 3.20 kg`)).toBeTruthy();
  });
});
