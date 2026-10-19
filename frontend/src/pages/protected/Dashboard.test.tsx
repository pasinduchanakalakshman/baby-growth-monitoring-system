import { cloneElement, type ReactElement } from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { babyApi } from '@/api/baby';
import { growthApi } from '@/api/growth';
import type { BabyProfile } from '@/types/baby';
import type { GrowthOverview, GrowthHistoryPoint } from '@/types/growth';
import { ageInDays, babyAgeLabel, calendarDate, recordedWeightPoints } from '@/features/dashboard/dashboardDisplay';
import Dashboard from './Dashboard';
import response from '@/test/fixtures/newbornWeightJourney.json';
import type { NewbornWeightJourney } from '@/types/growth';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/baby', () => ({ babyApi: { getBabyProfile: vi.fn() } }));
vi.mock('@/api/growth', () => ({ growthApi: { getGrowthOverview: vi.fn(), getGrowthHistory: vi.fn(), getNewbornWeightJourney: vi.fn() } }));
// Render the real chart at a mobile container width; browser QA checks fluid sizing.
vi.mock('recharts', async () => ({
  ...await vi.importActual('recharts'),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => cloneElement(children, { width: 300, height: 240 }),
}));

const baby: BabyProfile = { id: 1, owner_id: 1, name: 'Emma', sex: 'Female', date_of_birth: '2026-01-01', birth_weight_kg: 3.2, gestational_age_weeks: 39 };
const history: GrowthHistoryPoint[] = [
  { id: 2, baby_id: 1, visit_date: '2026-10-15', age_days: 287, weight_kg: 7.2 },
  { id: 1, baby_id: 1, visit_date: '2026-09-15', age_days: 257, weight_kg: 6.9 },
];
const overview: GrowthOverview = { baby: { ...baby, birth_weight_kg: 9 }, current_growth: { visit_date: '2026-10-15', weight_kg: 7.2 }, forecast_30d: { available: false } };
const auth: ReturnType<typeof useAuth> = { user: { id: 1, name: 'Sarah Johnson', email: 'sarah@example.com', is_active: true, created_at: '' }, isAuthenticated: true, isLoading: false, authState: 'AUTHENTICATED', logout: vi.fn(), refreshUser: vi.fn() };

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/app']}><Routes>
    <Route path="/app" element={<Dashboard />} />
    {['/baby', '/growth', '/growth/charts', '/growth/history', '/growth/forecast'].map(path => <Route key={path} path={path} element={<h1>Destination {path}</h1>} />)}
  </Routes></MemoryRouter></QueryClientProvider>);
}

async function ready() {
  await screen.findByText('7.20');
  await screen.findByRole('img', { name: /Recorded weight in kilograms/ });
}

describe('Dashboard content', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 10));
    vi.clearAllMocks();
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue(response as NewbornWeightJourney);
    vi.mocked(useAuth).mockReturnValue(auth);
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(baby);
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue(overview);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(history);
  });
  afterEach(() => vi.useRealTimers());

  it('renders actual account and profile data, calendar age and kilogram values', async () => {
    renderDashboard(); await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Sarah Johnson!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(screen.getByText('9 months old')).toBeInTheDocument();
    expect(screen.getByText('Born 1 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('Birth weight: 3.20 kg')).toBeInTheDocument();
    expect(screen.getByText('+4.00')).toHaveTextContent('+4.00 kg');
    expect(screen.getByText('15 Oct 2026', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/Registered on/)).not.toBeInTheDocument();
    expect(babyApi.getBabyProfile).toHaveBeenCalledOnce();
    expect(growthApi.getGrowthOverview).toHaveBeenCalledOnce();
    expect(growthApi.getGrowthHistory).toHaveBeenCalledOnce();
  });

  it('renders a real measured chart with units and accessible recorded values', async () => {
    const { container } = renderDashboard(); await ready();
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('width', '300');
    expect(screen.getByText('Age (days)')).toBeInTheDocument();
    expect(screen.getByText('Weight (kg)')).toBeInTheDocument();
    expect(container.querySelector('.recharts-line-curve')).not.toHaveAttribute('stroke-dasharray');
    fireEvent.click(screen.getByText('View recorded values'));
    expect(screen.getByText('15 Oct 2026 · Age 287 days · 7.20 kg')).toBeInTheDocument();
    expect(screen.queryByText(/Illustrative example/)).not.toBeInTheDocument();
  });

  it('shows useful profile loading skeletons without fabricated values', () => {
    vi.mocked(babyApi.getBabyProfile).mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    expect(screen.getByRole('status', { name: 'Loading baby profile' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading weight chart' })).toBeInTheDocument();
    expect(growthApi.getGrowthOverview).not.toHaveBeenCalled();
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
  });

  it('loads growth cards and chart independently of the available profile', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockImplementation(() => new Promise(() => {}));
    vi.mocked(growthApi.getGrowthHistory).mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    await screen.findByRole('heading', { name: 'Emma' });
    expect(screen.getByRole('status', { name: 'Loading latest recorded weight' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading weight chart' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute('href', '/baby');
  });

  it('handles a missing profile without fictional baby details or extra data reads', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(null as unknown as BabyProfile);
    renderDashboard();
    expect(await screen.findByText('Baby details are not available.')).toBeInTheDocument();
    expect(growthApi.getGrowthOverview).not.toHaveBeenCalled();
    expect(growthApi.getGrowthHistory).not.toHaveBeenCalled();
    expect(screen.queryByText('Emma')).not.toBeInTheDocument();
  });

  it('handles a failed profile request and retries it using the real query', async () => {
    vi.mocked(babyApi.getBabyProfile).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(baby);
    renderDashboard();
    await screen.findByText("We couldn't load your baby's profile.");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await ready();
    expect(babyApi.getBabyProfile).toHaveBeenCalledTimes(2);
  });

  it('uses a general greeting when the account name is unavailable', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...auth, user: null });
    renderDashboard(); await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back!' })).toBeInTheDocument();
    expect(screen.queryByText(/Mama|Mother|Sarah/)).not.toBeInTheDocument();
  });

  it('does not invent metrics, daily gain, normal-range bands or a health status', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: {}, current_growth: null });
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    const { container } = renderDashboard();
    await screen.findByText('No current measurement available');
    expect(await screen.findAllByText('Not recorded')).toHaveLength(3);
    expect(screen.getByText(/No measurements with a recorded weight/)).toBeInTheDocument();
    expect(container.querySelector('svg.recharts-surface')).toBeNull();
    expect(screen.queryByText(/Daily gain|Normal|On track|Growth status/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View Forecast' })).not.toBeInTheDocument();
  });

  it('keeps Add Measurement unavailable on the dashboard for older babies', async () => {
    renderDashboard(); await ready();
    expect(screen.getByRole('button', { name: 'Add Measurement' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Add Measurement' })).not.toBeInTheDocument();
  });

  it.each([['View Profile', '/baby'], ['Growth Overview', '/growth'], ['Growth Charts', '/growth/charts'], ['Growth History', '/growth/history'], ['View Charts', '/growth/charts']])('navigates %s to the existing %s route', async (label, path) => {
    renderDashboard(); await ready();
    fireEvent.click(screen.getByRole('link', { name: label }));
    expect(await screen.findByRole('heading', { name: `Destination ${path}` })).toBeInTheDocument();
  });

  it('links to the real forecast only when its existing availability and value are supplied', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ ...overview, forecast_30d: { available: true, estimated_weight_kg: 7.4, horizon_days: 30 } });
    renderDashboard(); await ready();
    fireEvent.click(screen.getByRole('link', { name: 'View Forecast' }));
    expect(await screen.findByRole('heading', { name: 'Destination /growth/forecast' })).toBeInTheDocument();
  });

  it('keeps the birth-based first-month example separate from recorded and forecast values', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07' });
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: { birth_weight_kg: 9 }, current_growth: null });
    const { container } = renderDashboard();
    await screen.findByRole('img', { name: /Illustrative weight journey beginning.*3.2 kg/ });
    expect(screen.getByText('12 days old')).toBeInTheDocument();
    expect(screen.getByText('Recorded birth weight: 3.2 kg')).toBeInTheDocument();
    expect(screen.getByText('Illustrative example')).toBeInTheDocument();
    expect(container.querySelector('.recharts-line-curve')).toHaveAttribute('stroke-dasharray', '7 5');
    expect(container.querySelector('.recharts-reference-dot-dot')).toBeInTheDocument();
    expect(screen.getByText(response.message)).toBeInTheDocument();
    expect(growthApi.getNewbornWeightJourney).toHaveBeenCalledOnce();
    expect(screen.getByText(/No extra weight entries are needed during the first 30 days/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Measurement/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View Charts|Forecast|History/ })).not.toBeInTheDocument();
    expect(growthApi.getGrowthHistory).not.toHaveBeenCalled();
    expect(await screen.findAllByText('Not recorded')).toHaveLength(3);
  });

  it('keeps the newborn journey visible when the growth service fails', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07' });
    vi.mocked(growthApi.getGrowthOverview).mockRejectedValue(new Error('Offline'));
    renderDashboard();
    expect(await screen.findByRole('img', { name: /Illustrative weight journey/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'View Weight Journey' }));
    expect(await screen.findByRole('heading', { name: 'Destination /growth' })).toBeInTheDocument();
  });

  it('identifies saved visit summaries separately from the first-month illustrative curve', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07' });
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: {}, current_growth: { visit_date: '2026-10-19', weight_kg: 3.3 } });
    renderDashboard();
    expect(await screen.findByText('3.30', { selector: 'p' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Illustrative weight journey beginning.*3.2 kg/ })).toBeInTheDocument();
    expect(screen.getByText(/Recorded visit weights, when available, come from saved visit data/)).toBeVisible();
    expect(screen.getByText('From a recorded visit')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add Measurement' })).not.toBeInTheDocument();
  });

  it.each([32, null])('shows no unsupported curve for gestational age %s', async weeks => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07', gestational_age_weeks: weeks });
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue({ ...response, available: false, points: [], message: 'This example does not suit the recorded birth details.' } as NewbornWeightJourney);
    renderDashboard();
    expect(await screen.findByText(/does not suit the recorded birth details/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Illustrative weight journey/ })).toBeNull();
  });

  it('handles incomplete birth details without drawing an example or calculating a change', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07', birth_weight_kg: null } as unknown as BabyProfile);
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue({ ...response, available: false, points: [], message: 'A valid recorded birth weight is unavailable.' } as NewbornWeightJourney);
    const { container } = renderDashboard();
    await screen.findByText(/A valid recorded birth weight is unavailable/);
    expect(container.querySelector('svg.recharts-surface')).toBeNull();
    expect(await screen.findByText('Requires birth and recorded weights')).toBeInTheDocument();
    expect(screen.queryByText('+4.00')).not.toBeInTheDocument();
  });

  it('shows a measured-history error without hiding available profile and metric data', async () => {
    vi.mocked(growthApi.getGrowthHistory).mockRejectedValue(new Error('Offline'));
    renderDashboard();
    await screen.findByText("We couldn't load recorded weights. Please try again.");
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(screen.getByText('7.20')).toBeInTheDocument();
  });

  it('preserves the complete existing medical disclaimer in an accessible note', async () => {
    renderDashboard(); await ready();
    const note = screen.getByRole('note', { name: 'System disclaimer' });
    expect(within(note).getByText(/This system provides growth estimates and risk assessments and is not a medical diagnosis. Always consult with a healthcare professional for medical advice./)).toBeInTheDocument();
  });
});

describe('Dashboard date and chart presentation', () => {
  const today = new Date(2026, 9, 19, 10);
  it.each(['', '2026-02-30', 'bad-date', '2026-13-01', undefined])('rejects an invalid date %s', value => {
    expect(calendarDate(value)).toBeNull();
    expect(ageInDays(value, today)).toBeNull();
  });
  it('uses calendar age at the inclusive newborn boundary and rejects future birth dates', () => {
    expect(ageInDays('2026-09-19', today)).toBe(30);
    expect(ageInDays('2026-09-18', today)).toBe(31);
    expect(ageInDays('2026-10-20', today)).toBeNull();
    expect(babyAgeLabel('2026-10-18', today)).toBe('1 day old');
    expect(babyAgeLabel('2026-10-19', today)).toBe('0 days old');
    expect(babyAgeLabel('2026-10-20', today)).toBe('Age unavailable');
  });
  it('sorts genuine visits, derives missing age from birth/visit dates, and excludes unusable values', () => {
    expect(recordedWeightPoints([
      { ...history[0], age_days: null },
      history[1],
      { ...history[0], weight_kg: NaN },
      { ...history[0], visit_date: 'bad-date' },
    ], baby.date_of_birth)).toEqual([
      { day: 257, weightKg: 6.9, visitDate: '2026-09-15' },
      { day: 287, weightKg: 7.2, visitDate: '2026-10-15' },
    ]);
  });
});
