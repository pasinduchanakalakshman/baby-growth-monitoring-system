import { cloneElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GrowthChartsPage from './GrowthChartsPage';
import { babyApi } from '@/api/baby';
import { growthApi } from '@/api/growth';
import type { BabyProfile } from '@/types/baby';
import type { NewbornWeightJourney } from '@/types/growth';
import response from '@/test/fixtures/newbornWeightJourney.json';

vi.mock('@/api/baby', () => ({ babyApi: { getBabyProfile: vi.fn() } }));
vi.mock('@/api/growth', () => ({ growthApi: { getGrowthHistory: vi.fn(), getNewbornWeightJourney: vi.fn() } }));
vi.mock('recharts', async () => ({
  ...await vi.importActual('recharts'),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => cloneElement(children, { width: 320, height: 300 }),
}));

const baby: BabyProfile = { id: 1, owner_id: 1, name: 'Emma', sex: 'Male', date_of_birth: '2026-01-01', birth_weight_kg: 3.2, gestational_age_weeks: 39 };
const recorded = [
  { id: 1, baby_id: 1, visit_date: '2026-10-10', age_days: 3, weight_kg: 3.05, verified_waz: null },
  { id: 2, baby_id: 1, visit_date: '2026-10-19', age_days: 12, weight_kg: 3.3, verified_waz: null },
];
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/growth/charts']}><Routes>
    <Route path="/growth/charts" element={<GrowthChartsPage />} />
    <Route path="/growth" element={<h1>Overview destination</h1>} />
    <Route path="/growth/add" element={<h1>Measurement destination</h1>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
function newborn() {
  vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07' });
}

describe('GrowthChartsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 10));
    vi.clearAllMocks();
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(baby);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue(response as NewbornWeightJourney);
  });
  afterEach(() => vi.useRealTimers());

  it('renders the existing older-baby no-data state and entry destination', async () => {
    renderPage();
    expect(await screen.findByText('No measurements yet')).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Add Measurement' })).toHaveAttribute('href', '/growth/add');
    expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Add Measurement' }));
    expect(screen.getByRole('heading', { name: 'Measurement destination' })).toBeVisible();
  });

  it('renders existing recorded charts and Overview navigation', async () => {
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(recorded);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Growth Charts' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Detailed Growth Charts' })).toBeVisible();
    expect(screen.getByText('Longitudinal visualization of actual measurement history.')).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Back to Overview' }));
    expect(screen.getByRole('heading', { name: 'Overview destination' })).toBeVisible();
  });

  it.each([0, 3, 12, 30, 31, 90])('uses the correct presentation at age %s days without modifying entry rules', async days => {
    const date = new Date(2026, 9, 19 - days);
    const dob = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: dob });
    renderPage();
    await screen.findByText('No measurements yet');
    if (days <= 30) {
      expect(screen.getByText('An illustrative first-month journey, separate from saved visit measurements.')).toBeVisible();
      expect(await screen.findByRole('region', { name: 'Newborn Weight Journey' })).toBeVisible();
      expect(await screen.findByRole('img', { name: /Illustrative weight journey/ })).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Add Measurement' })).not.toBeInTheDocument();
      expect(growthApi.getNewbornWeightJourney).toHaveBeenCalledOnce();
    } else {
      expect(await screen.findByRole('link', { name: 'Add Measurement' })).toBeVisible();
      expect(screen.queryByRole('region', { name: 'Newborn Weight Journey' })).not.toBeInTheDocument();
      expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
    }
  });

  it('keeps first-month saved visits separate from the illustration without discarding either', async () => {
    newborn();
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(recorded);
    const { container } = renderPage();
    await screen.findByRole('img', { name: /Illustrative weight journey/ });
    const note = screen.getByRole('note', { name: 'Recorded visit source' });
    expect(note).toHaveTextContent('They do not identify who took or entered the measurements.');
    expect(container.querySelectorAll('svg.recharts-surface')).toHaveLength(2);
    expect(screen.getByText(response.message)).toBeVisible();
    const tabs = screen.getByRole('tabpanel');
    fireEvent.click(within(tabs).getByText('View recorded values'));
    expect(within(tabs).getByRole('table')).toHaveTextContent('3.05');
    expect(within(tabs).getByRole('table')).toHaveTextContent('3.30');
    expect(screen.queryByRole('link', { name: /Add Measurement/ })).not.toBeInTheDocument();
    expect(container.querySelector('input, form')).toBeNull();
  });

  it('shows independent loading skeletons for profile and history', () => {
    vi.mocked(babyApi.getBabyProfile).mockImplementation(() => new Promise(() => {}));
    vi.mocked(growthApi.getGrowthHistory).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading birth details' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Loading recorded growth charts' })).toBeVisible();
  });

  it('keeps the newborn illustration available when recorded-history reads fail', async () => {
    newborn();
    vi.mocked(growthApi.getGrowthHistory).mockRejectedValue(new Error('Unavailable'));
    renderPage();
    expect(await screen.findByRole('img', { name: /Illustrative weight journey/ })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load growth charts");
  });

  it('retries a failed journey read while preserving genuine history', async () => {
    newborn();
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(recorded);
    vi.mocked(growthApi.getNewbornWeightJourney).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(response as NewbornWeightJourney);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load the newborn weight journey");
    expect(screen.getByRole('heading', { name: 'Growth Charts' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: /Illustrative weight journey/ })).toBeVisible();
    expect(growthApi.getNewbornWeightJourney).toHaveBeenCalledTimes(2);
  });

  it.each(['missing_birth_weight', 'unsupported_gestational_age', 'missing_gestational_age'])('preserves the endpoint unavailable response for %s', async reason => {
    newborn();
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue({ ...response, available: false, points: [], reason, message: 'An illustrative curve is unavailable for the recorded birth details.' } as NewbornWeightJourney);
    const { container } = renderPage();
    expect(await screen.findByText(/An illustrative curve is unavailable/)).toBeVisible();
    expect(container.querySelector('svg.recharts-surface')).toBeNull();
    expect(screen.queryByRole('link', { name: /Add Measurement/ })).not.toBeInTheDocument();
    expect(screen.getByText(response.limitations[0])).toBeVisible();
  });

  it('shows saved visits when birth details fail and allows profile retry', async () => {
    vi.mocked(babyApi.getBabyProfile).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(baby);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(recorded);
    renderPage();
    await screen.findByText(/Birth details could not be loaded/);
    expect(screen.getByRole('heading', { name: 'Growth Charts' })).toBeVisible();
    expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry birth details' }));
    expect(await screen.findByRole('img', { name: /Recorded Weight by visit date/ })).toBeVisible();
  });

  it('does not encourage entry when a birth date is missing or invalid', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '' });
    renderPage();
    await screen.findByText('No measurements yet');
    expect(screen.queryByRole('link', { name: 'Add Measurement' })).not.toBeInTheDocument();
    expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
  });

  it('retains the medical disclaimer in empty and failed states', async () => {
    vi.mocked(growthApi.getGrowthHistory).mockRejectedValue(new Error('Unavailable'));
    renderPage();
    await screen.findByRole('alert');
    expect(screen.getByRole('note', { name: 'Medical disclaimer' })).toHaveTextContent('Monitoring information. This is not a medical diagnosis.');
  });
});
