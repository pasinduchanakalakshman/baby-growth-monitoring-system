import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GrowthOverviewPage from './GrowthOverviewPage';
import { growthApi } from '@/api/growth';
import { babyApi } from '@/api/baby';

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
  }
}));

describe('GrowthOverviewPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('uses the authenticated profile birth weight without measurements or writes', async () => {
    const now = new Date();
    const dob = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue({ id: 9, owner_id: 7, name: 'New baby', sex: 'Male', date_of_birth: dob, birth_weight_kg: 2.8 });
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({ baby: { birth_weight_kg: 4.5 } });
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    const { container } = renderComponent();
    expect(await screen.findByText('● Recorded birth weight: 2.8 kg')).toBeTruthy();
    expect(babyApi.getBabyProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Add First Measurement')).toBeNull();
    expect(screen.queryByText('Add Measurement')).toBeNull();
    expect(container.querySelector('input, form')).toBeNull();
  });

  it('keeps the journey available when the existing dashboard fails', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockRejectedValue(new Error('Unavailable'));
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue([]);
    renderComponent();
    expect(await screen.findByText('● Recorded birth weight: 3.2 kg')).toBeTruthy();
    expect(await screen.findByText(/couldn't load growth data/)).toBeTruthy();
  });

  it('renders no-data empty state when no measurements exist', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({ baby: { name: 'Test' } });
    (growthApi.getGrowthHistory as any).mockResolvedValue([]);
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('No growth measurements recorded yet.')).toBeTruthy();
    });
  });

  it('renders one genuine measurement correctly with WAZ and HAZ', async () => {
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
      // 1.05 should be formatted to -1.05
      expect(screen.getByText('-1.05')).toBeTruthy();
      expect(screen.getByText('0.40')).toBeTruthy();
      // Status string check
      expect(screen.getAllByText('Within expected WHO threshold').length).toBeGreaterThan(0);
      
      // Should show the "More visits are needed" message because history length == 1
      expect(screen.getByText('More visits are needed to show a growth trend')).toBeTruthy();
    });
  });

  it('handles missing height by showing Not recorded and missing HAZ', async () => {
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
      expect(screen.getByText('Not recorded')).toBeTruthy();
      expect(screen.getByText('Not available')).toBeTruthy();
      expect(screen.getByText('Length/height was not recorded for this visit.')).toBeTruthy();
    });
  });

  it('displays multiple measurements with charts', async () => {
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
      expect(screen.queryByText('More visits are needed to show a growth trend')).not.toBeTruthy();
      // Charts should render
      expect(screen.getByText('Growth Charts')).toBeTruthy();
    });
  });
});
