import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GrowthForecastPage from './GrowthForecastPage';
import { growthApi } from '@/api/growth';

// Mock the API client
vi.mock('@/api/growth', () => ({
  growthApi: {
    getGrowthOverview: vi.fn(),
    getGrowthForecast: vi.fn(),
  }
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => mockNavigate,
  };
});

describe('GrowthForecastPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GrowthForecastPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('renders loading state initially', () => {
    (growthApi.getGrowthOverview as any).mockReturnValue(new Promise(() => {}));
    (growthApi.getGrowthForecast as any).mockReturnValue(new Promise(() => {}));
    
    renderComponent();
    expect(screen.getByTestId('loading-state')).toBeTruthy();
  });

  it('shows generic error state if API fails', async () => {
    (growthApi.getGrowthOverview as any).mockRejectedValue(new Error('Network error'));
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeTruthy();
    });
    expect(screen.getByText(/We couldn't load the forecast right now/i)).toBeTruthy();
  });

  it('shows no-data state if there are no measurements', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { name: 'Leo', sex: 'M', date_of_birth: '2023-01-01' },
      current_growth: null
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByTestId('no-data-state')).toBeTruthy();
    });
    expect(screen.getByText(/Add a growth measurement before viewing a forecast/i)).toBeTruthy();
  });

  it('shows insufficient-history state if forecast not available', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { name: 'Leo', sex: 'M', date_of_birth: '2023-01-01' },
      current_growth: {
        visit_date: '2023-02-01',
        weight_kg: 5.0,
        waz: -0.5
      }
    });

    (growthApi.getGrowthForecast as any).mockResolvedValue({
      forecast_available: false,
      reason: "Not enough data points."
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByTestId('unavailable-forecast-state')).toBeTruthy();
    });
    expect(screen.getByText(/Not enough data points/i)).toBeTruthy();
  });

  it('shows forecast data correctly', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { name: 'Leo', sex: 'M', date_of_birth: '2023-01-01' },
      current_growth: {
        visit_date: '2023-05-01',
        weight_kg: 7.2,
        waz: -0.52
      }
    });

    (growthApi.getGrowthForecast as any).mockResolvedValue({
      forecast_available: true,
      estimated_future_waz: -0.65,
      estimated_future_weight_kg: 7.85,
      estimated_weight_change_kg: 0.65,
      nominal_horizon_days: 30
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByTestId('forecast-available-state')).toBeTruthy();
    });
    
    // Check heading wording
    expect(screen.getByText(/30-Day Forecast/i)).toBeTruthy();
    expect(screen.getByText(/See an estimated view/i)).toBeTruthy();
    
    // Check Current values
    expect(screen.getByText('7.20 kg')).toBeTruthy(); // weight
    expect(screen.getByText('-0.52')).toBeTruthy(); // WAZ
    
    // Check Forecast values
    expect(screen.getByText('Expected Weight Change: +0.65 kg')).toBeTruthy(); // change
    expect(screen.getByText('7.85 kg')).toBeTruthy(); // future weight
    expect(screen.getByText('-0.65')).toBeTruthy(); // future WAZ
    
    // Check disclaimer
    expect(screen.getByText(/Monitoring information/i)).toBeTruthy();
  });
});
