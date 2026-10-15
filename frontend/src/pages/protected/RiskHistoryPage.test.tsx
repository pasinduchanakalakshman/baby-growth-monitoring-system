import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RiskHistoryPage from './RiskHistoryPage';
import { growthApi } from '@/api/growth';

vi.mock('@/api/growth', () => ({
  growthApi: {
    getRiskTrajectory: vi.fn(),
    getModelInfo: vi.fn(),
  }
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

// Mock Recharts to avoid DOM measurement issues in tests
vi.mock('recharts', async () => {
  const OriginalRechartsModule = await vi.importActual('recharts');
  return {
    ...OriginalRechartsModule,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 800, height: 400 }} data-testid="mock-responsive-container">
        {children}
      </div>
    ),
  };
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RiskHistoryPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('RiskHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('shows no-data state when trajectory is empty', async () => {
    (growthApi.getRiskTrajectory as any).mockResolvedValue([]);
    (growthApi.getModelInfo as any).mockResolvedValue({});
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('no-data-state')).toBeTruthy();
    });
    
    expect(screen.getByText(/Not enough genuine risk assessments available/i)).toBeTruthy();
  });

  it('renders trajectory chart when data is present', async () => {
    (growthApi.getRiskTrajectory as any).mockResolvedValue([
      { visit_date: '2023-01-01', risk_probability: 0.10 },
      { visit_date: '2023-02-01', risk_probability: 0.15 }
    ]);
    (growthApi.getModelInfo as any).mockResolvedValue({
      Risk: { threshold: 0.50 }
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('trajectory-chart-container')).toBeTruthy();
    });

    expect(screen.getByText(/Each point represents the experimental 180-day risk score at the time of a/i)).toBeTruthy();
  });
});
