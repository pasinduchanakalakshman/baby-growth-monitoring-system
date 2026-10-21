import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GrowthOverviewPage from './GrowthOverviewPage';
import { growthApi } from '@/api/growth';
import { babyApi } from '@/api/baby';
import response from '@/test/fixtures/newbornWeightJourney.json';
import type { NewbornWeightJourney } from '@/types/growth';

vi.mock('@/api/baby', () => ({ babyApi: { getBabyProfile: vi.fn() } }));

// Mock recharts so it doesn't fail in JSDOM
vi.mock('recharts', async () => {
  const OriginalRechartsModule = await vi.importActual('recharts');
  return {
    ...OriginalRechartsModule,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    LineChart: ({ children }: any) => <div>{children}</div>,
    Line: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    ReferenceLine: () => <div />,
  };
});

vi.mock('@/api/growth', () => ({
  growthApi: {
    getGrowthOverview: vi.fn(),
    getGrowthHistory: vi.fn(),
    getNewbornWeightJourney: vi.fn(),
  }
}));

describe('GrowthOverviewPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue(response as NewbornWeightJourney);
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ id: 1, owner_id: 1, name: 'Test', sex: 'Female', date_of_birth: '2023-01-01', birth_weight_kg: 3.2, gestational_age_weeks: 39 });
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GrowthOverviewPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    (growthApi.getGrowthOverview as any).mockReturnValue(new Promise(() => {}));
    (growthApi.getGrowthHistory as any).mockReturnValue(new Promise(() => {}));
    
    const { container } = renderComponent();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('fetches the authenticated backend journey without measurements or writes', async () => {
    const now = new Date();
    const dob = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ id: 9, owner_id: 7, name: 'New baby', sex: 'Male', date_of_birth: dob, birth_weight_kg: 2.8 });
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: { birth_weight_kg: 4.5 } });
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue({ ...response, birth_weight_kg: 2.8, points: [{ ...response.points[0], weight_kg: 2.8 }, ...response.points.slice(1)] } as NewbornWeightJourney);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    const { container } = renderComponent();
    expect(await screen.findByText('Recorded birth weight: 2.8 kg')).toBeTruthy();
    expect(babyApi.getBabyProfile).toHaveBeenCalledTimes(1);
    expect(growthApi.getNewbornWeightJourney).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Add First Measurement')).toBeNull();
    expect(screen.queryByText('Add Measurement')).toBeNull();
    expect(container.querySelector('input, form')).toBeNull();
  });

  it('keeps the journey available when the existing dashboard fails', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockRejectedValue(new Error('Unavailable'));
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    renderComponent();
    expect(await screen.findByText('Recorded birth weight: 3.2 kg')).toBeTruthy();
    expect(await screen.findByText(/couldn't load growth data/)).toBeTruthy();
  });


  it('refetches the journey when saved profile inputs change', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: {} });
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    renderComponent();
    expect(await screen.findByText(/Recorded birth weight: 3\.2 kg/)).toBeTruthy();
    vi.mocked(growthApi.getNewbornWeightJourney).mockResolvedValue({ ...response, available: false, points: [], message: 'This example does not suit the recorded gestational age.' } as NewbornWeightJourney);
    queryClient.setQueryData(['baby.profile'], { id: 1, owner_id: 1, name: 'Test', sex: 'Female', birth_weight_kg: 3.2, gestational_age_weeks: 35 });
    expect(await screen.findByText(/does not suit the recorded gestational age/)).toBeTruthy();
    expect(growthApi.getNewbornWeightJourney).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Recorded birth weight: 3\.2 kg/)).toBeNull();
  });

  it('shows journey API errors independently of the dashboard', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: {} });
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    vi.mocked(growthApi.getNewbornWeightJourney).mockRejectedValue(new Error('Unavailable'));
    renderComponent();
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load the newborn weight journey");
    expect(screen.getByText('No growth measurements recorded yet.')).toBeTruthy();
  });

  it('renders no-data empty state when no measurements exist', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({ baby: { name: 'Test' } });
    (growthApi.getGrowthHistory as any).mockResolvedValue([]);
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('No growth measurements recorded yet.')).toBeTruthy();
    });
  });

  it('omits the marked measurement and status cards while retaining the journey and header actions', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { name: 'Test' },
      current_growth: {
        visit_date: '2023-05-01',
        weight_kg: 7.2,
        length_height_cm: 65,
        waz: -1.05,
        haz: 0.4,
      }
    });
    (growthApi.getGrowthHistory as any).mockResolvedValue([
      { id: 1, visit_date: '2023-05-01', weight_kg: 7.2, length_height_cm: 65, verified_waz: -1.05, verified_haz: 0.4 }
    ]);
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Your Baby\'s First 30 Days')).toBeInTheDocument();
      expect(screen.queryByText('Latest Measurement')).not.toBeInTheDocument();
      expect(screen.queryByText('Current WHO Growth Status')).not.toBeInTheDocument();
      expect(screen.queryByText('More visits are needed to show a growth trend')).not.toBeInTheDocument();
      expect(screen.queryByText('Growth Charts')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'History List' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Detailed Charts' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add Measurement' })).toBeVisible();
    });
  });

  it('keeps the marked cards absent when saved height and HAZ are missing', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { name: 'Test' },
      current_growth: {
        visit_date: '2023-05-01',
        weight_kg: 7.2,
        length_height_cm: null,
        waz: -1.05,
        haz: null,
      }
    });
    (growthApi.getGrowthHistory as any).mockResolvedValue([
      { id: 1, visit_date: '2023-05-01', weight_kg: 7.2, length_height_cm: null, verified_waz: -1.05, verified_haz: null }
    ]);
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Growth Monitoring')).toBeInTheDocument();
      expect(screen.queryByText('Latest Measurement')).not.toBeInTheDocument();
      expect(screen.queryByText('Current WHO Growth Status')).not.toBeInTheDocument();
      expect(screen.queryByText('Growth Charts')).not.toBeInTheDocument();
    });
  });

  it('removes the marked explorer, explanation, recorded charts and forecast links with multiple visits', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { name: 'Test' },
      current_growth: {
        visit_date: '2023-06-01',
        weight_kg: 8.0,
      }
    });
    (growthApi.getGrowthHistory as any).mockResolvedValue([
      { id: 1, visit_date: '2023-05-01', weight_kg: 7.2 },
      { id: 2, visit_date: '2023-06-01', weight_kg: 8.0 }
    ]);
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Growth Monitoring')).toBeInTheDocument();
      expect(screen.queryByLabelText('Explore a day')).not.toBeInTheDocument();
      expect(screen.queryByText(/This chart shows an example of how a newborn/)).not.toBeInTheDocument();
      expect(screen.queryByText('Latest Measurement')).not.toBeInTheDocument();
      expect(screen.queryByText('Current WHO Growth Status')).not.toBeInTheDocument();
      expect(screen.queryByText('Growth Charts')).not.toBeInTheDocument();
      expect(screen.queryByText('30-Day Forecast')).not.toBeInTheDocument();
      expect(screen.queryByText('Early Growth Risk')).not.toBeInTheDocument();
      expect(screen.getByText('Understanding this journey and when to seek advice')).toBeInTheDocument();
    });
  });
});
