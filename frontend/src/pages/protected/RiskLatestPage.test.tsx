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
      expect(screen.getByText(/Add a growth measurement before viewing a risk assessment/i)).toBeTruthy();
    });
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

  it('displays 180-day growth-faltering risk score and elevated screening status correctly', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 5 }
    });
    
    (growthApi.getLatestRisk as any).mockResolvedValue({
      risk_available: true,
      risk_probability: 0.18,
      risk_score: 0.18,
      risk_threshold: 0.06405469514,
      risk_flag: 1,
      screening_status: 'Elevated screening risk',
      prediction_horizon_days: 180,
      model_version: 'v1',
      component_scores: {
        xgboost_probability: 0.17,
        transformer_probability: 0.27
      }
    });

    (growthApi.getModelInfo as any).mockResolvedValue({
      Risk: { model: 'XGBoost + Transformer Late Fusion Hybrid', horizon_days: 180, threshold: 0.06405469514 },
      Disclaimers: ['Research support only.']
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    expect(screen.getByText('0.180')).toBeTruthy();
    expect(screen.getByText('Elevated screening risk')).toBeTruthy();
    expect(screen.getByText(/This is an experimental AI screening score, not a medical diagnosis or an exact probability/i)).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/likelihood/i)).toBeNull();
  });

  it('displays below screening threshold status when score is below threshold', async () => {
    (growthApi.getGrowthOverview as any).mockResolvedValue({
      baby: { id: 1, name: 'Baby B' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 5 }
    });
    
    (growthApi.getLatestRisk as any).mockResolvedValue({
      risk_available: true,
      risk_probability: 0.03,
      risk_score: 0.03,
      risk_threshold: 0.06405469514,
      risk_flag: 0,
      screening_status: 'Below screening threshold',
      prediction_horizon_days: 180,
      model_version: 'v1'
    });

    (growthApi.getModelInfo as any).mockResolvedValue({
      Risk: { model: 'XGBoost + Transformer Late Fusion Hybrid', horizon_days: 180, threshold: 0.06405469514 }
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    expect(screen.getByText('0.030')).toBeTruthy();
    expect(screen.getByText('Below screening threshold')).toBeTruthy();
    // Must NOT label as "healthy" or "no risk"
    expect(screen.queryByText(/healthy/i)).toBeNull();
    expect(screen.queryByText(/no risk detected/i)).toBeNull();
  });
});
