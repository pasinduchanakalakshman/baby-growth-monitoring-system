import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GrowthChartsPage from './GrowthChartsPage';
import { growthApi } from '@/api/growth';

// Mock recharts
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
    getGrowthHistory: vi.fn(),
  }
}));

describe('GrowthChartsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GrowthChartsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('renders no-data empty state when no measurements exist', async () => {
    (growthApi.getGrowthHistory as any).mockResolvedValue([]);
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('No measurements yet')).toBeTruthy();
      expect(screen.getByText('Add Measurement')).toBeTruthy();
    });
  });

  it('renders charts when data exists', async () => {
    (growthApi.getGrowthHistory as any).mockResolvedValue([
      { id: 1, visit_date: '2023-05-01', weight_kg: 7.2 },
      { id: 2, visit_date: '2023-06-01', weight_kg: 8.0 }
    ]);
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Detailed Growth Charts')).toBeTruthy();
      expect(screen.getByText('Longitudinal visualization of actual measurement history.')).toBeTruthy();
      expect(screen.getByText('Growth Charts')).toBeTruthy(); // from the component
    });
  });
});
