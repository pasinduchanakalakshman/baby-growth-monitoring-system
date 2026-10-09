import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RiskLatestPage from './RiskLatestPage';
import { growthApi } from '@/api/growth';

vi.mock('@/api/growth', () => ({
  growthApi: {
    getGrowthOverview: vi.fn(),
    getLatestRisk: vi.fn(),
    getModelInfo: vi.fn(),
  }
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RiskLatestPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('RiskLatestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('shows no-data state when current_growth is missing', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: null
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('no-data-state')).toBeTruthy();
    });
    
    expect(screen.getByText(/Add a growth measurement before viewing a risk assessment/i)).toBeTruthy();
  });

  it('shows unavailable-risk state if risk_available is false', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 5 }
    });
    
    (growthApi.getLatestRisk as any).mockResolvedValue({
      risk_available: false,
      reason: 'Model not applicable.'
    });

    (growthApi.getModelInfo as any).mockResolvedValue({});

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('unavailable-risk-state')).toBeTruthy();
    });
    
    expect(screen.getByText(/Model not applicable/i)).toBeTruthy();
  });

  it('displays risk probability and model info correctly from backend', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 5 }
    });
    
    (growthApi.getLatestRisk as any).mockResolvedValue({
      risk_available: true,
      risk_probability: 0.18,
      risk_threshold: 0.50,
      risk_flag: 0,
      prediction_horizon_days: 180,
      model_version: 'v1'
    });

    (growthApi.getModelInfo as any).mockResolvedValue({
      Risk: { model: 'XGBoost v1', horizon_days: 180, threshold: 0.50 },
      Disclaimers: ['Research support only.']
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    expect(screen.getByText('18%')).toBeTruthy();
    expect(screen.getByText(/180-day growth-faltering outcome/i)).toBeTruthy();
    expect(screen.getByText(/Standard Risk/i)).toBeTruthy();
    expect(screen.getByText(/XGBoost v1/i)).toBeTruthy();
  });
});
