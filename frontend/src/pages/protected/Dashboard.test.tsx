import { cloneElement, type ReactElement } from 'react';
import { cleanup, render, screen, within, fireEvent } from '@testing-library/react';
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
    {['/baby', '/growth/add', '/growth/charts'].map(path => <Route key={path} path={path} element={<h1>Destination {path}</h1>} />)}
  </Routes></MemoryRouter></QueryClientProvider>);
}

async function ready() {
  await screen.findByText('7.20', { selector: 'dd' });
  await screen.findByRole('img', { name: /Recorded Weight by age in months/ });
}

function stat(label: string) {
  return screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!;
}

describe('Dashboard content', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 10));
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(auth);
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(baby);
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue(overview);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(history);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('combines actual profile details and growth metrics into one of two main cards', async () => {
    renderDashboard(); await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back, Sarah Johnson!' })).toBeInTheDocument();
    const summary = within(screen.getByRole('region', { name: 'Baby summary' }));
    expect(summary.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(summary.getByText('9 months old')).toBeInTheDocument();
    expect(summary.getByText('Female')).toBeInTheDocument();
    expect(summary.getByText('Born 1 Jan 2026')).toBeInTheDocument();
    expect(stat('Latest Weight')).toHaveTextContent('7.20 kg');
    expect(stat('Weight Change')).toHaveTextContent('+4.00 kg');
    expect(stat('Last Measurement')).toHaveTextContent('15 Oct 2026');
    expect(screen.getByRole('region', { name: 'Growth Charts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Growth Charts' })).toBeInTheDocument();
    expect(screen.queryByText(/Explore your baby's growth|Birth weight:/)).not.toBeInTheDocument();
    expect(babyApi.getBabyProfile).toHaveBeenCalledOnce();
    expect(growthApi.getGrowthOverview).toHaveBeenCalledOnce();
    expect(growthApi.getGrowthHistory).toHaveBeenCalledOnce();
    expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
  });

  it('preserves the measured chart, units and accessible recorded values', async () => {
    const { container } = renderDashboard(); await ready();
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('width', '300');
    expect(screen.getByText('Age (months)')).toBeInTheDocument();
    expect(screen.getByText('Weight (kg)', { selector: 'tspan' })).toBeInTheDocument();
    expect(container.querySelector('.recharts-line-curve')).not.toHaveAttribute('stroke-dasharray');
    fireEvent.click(screen.getByText('View recorded values'));
    const row = screen.getByText('October 15, 2026').closest('tr')!;
    expect(row).toHaveTextContent('287');
    expect(row).toHaveTextContent('7.20');
    expect(screen.queryByText(/Illustrative example/)).not.toBeInTheDocument();
  });

  it('shows only the weight chart with references, birth marker and saved visit tooltips, and links to all charts', async () => {
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(history.map(visit => ({ ...visit, length_height_cm: 65, verified_waz: -0.5, verified_haz: -0.25 })));
    const { container } = renderDashboard(); await ready();
    expect(screen.getByText('2 visits')).toBeInTheDocument();
    expect(screen.getByText('50th percentile')).toBeInTheDocument();
    fireEvent.mouseEnter(container.querySelector('.birth-measurement-dot')!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Birth weight: 3.2 kg');
    fireEvent.mouseLeave(container.querySelector('.birth-measurement-dot')!);
    fireEvent.mouseEnter(container.querySelectorAll('.recharts-line-dot')[1]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Recorded Weight: 7.2 kg');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/Recorded Weight by age in months, in kg/);
    expect(screen.getByRole('link', { name: 'View Growth Charts' })).toHaveAttribute('href', '/growth/charts');
    expect(growthApi.getGrowthHistory).toHaveBeenCalledOnce();
    expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
  });

  it('shows loading placeholders without invented values or premature data reads', () => {
    vi.mocked(babyApi.getBabyProfile).mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    expect(screen.getByRole('status', { name: 'Loading baby profile' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading weight chart' })).toBeInTheDocument();
    expect(growthApi.getGrowthOverview).not.toHaveBeenCalled();
    expect(growthApi.getGrowthHistory).not.toHaveBeenCalled();
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
  });

  it('loads growth statistics and chart independently of the available profile', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockImplementation(() => new Promise(() => {}));
    vi.mocked(growthApi.getGrowthHistory).mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    await screen.findByRole('heading', { name: 'Emma' });
    expect(screen.getByRole('status', { name: 'Loading latest weight' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading weight chart' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute('href', '/baby');
    expect(screen.getByRole('link', { name: 'Add Measurement' })).toHaveAttribute('href', '/growth/add');
  });

  it('handles a missing profile without fictional details or extra data reads', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(null as unknown as BabyProfile);
    renderDashboard();
    expect(await screen.findByText('Baby details are not available.')).toBeInTheDocument();
    expect(growthApi.getGrowthOverview).not.toHaveBeenCalled();
    expect(growthApi.getGrowthHistory).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Add Measurement' })).not.toBeInTheDocument();
    expect(screen.queryByText('Emma')).not.toBeInTheDocument();
  });

  it('retries a failed profile request without showing the no-measurements state', async () => {
    vi.mocked(babyApi.getBabyProfile).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(baby);
    renderDashboard();
    await screen.findByText("We couldn't load your baby's profile.");
    expect(screen.queryByRole('heading', { name: "Your baby's growth journey starts here" })).not.toBeInTheDocument();
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

  it('shows three placeholders and a single compact empty state without inventing metrics', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: {}, current_growth: null });
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    const { container } = renderDashboard();
    await screen.findByRole('heading', { name: "Your baby's growth journey starts here" });
    expect(stat('Latest Weight').textContent).toBe('—');
    expect(stat('Weight Change').textContent).toBe('—');
    expect(stat('Last Measurement').textContent).toBe('—');
    expect(screen.getByText("Add your first measurement to start tracking your baby's growth over time.")).toBeInTheDocument();
    expect(container.querySelector('svg.recharts-surface')).toBeNull();
    expect(screen.queryByText(/Not recorded|Daily gain|Normal|On track|Growth status/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add Measurement' })).toHaveLength(1);
  });

  it.each([['View Profile', '/baby'], ['Add Measurement', '/growth/add'], ['View Growth Charts', '/growth/charts']])('navigates %s to the existing %s route', async (label, path) => {
    renderDashboard(); await ready();
    fireEvent.click(screen.getByRole('link', { name: label }));
    expect(await screen.findByRole('heading', { name: `Destination ${path}` })).toBeInTheDocument();
  });

  it('shows saved newborn measurements using the same recorded-weight chart', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07' });
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: {}, current_growth: { visit_date: '2026-10-19', weight_kg: 3.3 } });
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([{ ...history[0], visit_date: '2026-10-19', age_days: 12, weight_kg: 3.3 }]);
    const { container } = renderDashboard();
    await screen.findByRole('img', { name: /Recorded Weight by age in months/ });
    expect(screen.getByText('12 days old')).toBeInTheDocument();
    expect(stat('Latest Weight')).toHaveTextContent('3.30 kg');
    expect(stat('Weight Change')).toHaveTextContent('+0.10 kg');
    expect(screen.getByRole('link', { name: 'Add Measurement' })).toHaveAttribute('href', '/growth/add');
    expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(1);
    expect(container.querySelector('.birth-measurement-dot')).toBeInTheDocument();
    expect(screen.getByText('1 visit')).toBeInTheDocument();
  });

  it('shows the first-measurement empty state for a newborn without saved visits', async () => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, date_of_birth: '2026-10-07' });
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: {}, current_growth: null });
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    renderDashboard();
    await screen.findByRole('heading', { name: "Your baby's growth journey starts here" });
    expect(screen.queryByRole('img', { name: /Illustrative weight journey/ })).not.toBeInTheDocument();
    expect(growthApi.getNewbornWeightJourney).not.toHaveBeenCalled();
  });

  it.each([null, 0, NaN])('does not calculate weight change with invalid birth weight %s', async birth_weight_kg => {
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ ...baby, birth_weight_kg } as unknown as BabyProfile);
    renderDashboard(); await ready();
    expect(stat('Weight Change').textContent).toBe('—');
    expect(stat('Latest Weight')).toHaveTextContent('7.20 kg');
  });

  it('shows and retries a history error while retaining profile and summary data', async () => {
    vi.mocked(growthApi.getGrowthHistory).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(history);
    renderDashboard();
    await screen.findByText("We couldn't load recorded weights. Please try again.");
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(stat('Latest Weight')).toHaveTextContent('7.20 kg');
    expect(screen.queryByRole('heading', { name: "Your baby's growth journey starts here" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry weight progress' }));
    await ready();
    expect(growthApi.getGrowthHistory).toHaveBeenCalledTimes(2);
    expect(growthApi.getGrowthOverview).toHaveBeenCalledOnce();
  });

  it('retries an overview error while retaining the independent recorded chart', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(overview);
    renderDashboard();
    await screen.findByText(/We couldn't load the latest growth summary/);
    expect(await screen.findByRole('img', { name: /Recorded Weight by age in months/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await ready();
    expect(growthApi.getGrowthOverview).toHaveBeenCalledTimes(2);
    expect(growthApi.getGrowthHistory).toHaveBeenCalledOnce();
  });

  it('does not call invalid saved measurements an empty history', async () => {
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([{ ...history[0], weight_kg: NaN }]);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Weight progress is not available yet' });
    expect(screen.queryByText(/Add your first measurement/)).not.toBeInTheDocument();
  });

  it('retains a readable medical disclaimer at the bottom', async () => {
    renderDashboard(); await ready();
    const note = screen.getByRole('note', { name: 'System disclaimer' });
    expect(note).toHaveTextContent('BabyGrowth provides growth monitoring estimates and is not a medical diagnosis. Consult a healthcare professional for medical advice.');
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
