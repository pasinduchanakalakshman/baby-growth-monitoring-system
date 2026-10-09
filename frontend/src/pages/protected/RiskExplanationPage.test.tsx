import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RiskExplanationPage from './RiskExplanationPage';
import { growthApi } from '@/api/growth';

vi.mock('@/api/growth', () => ({
  growthApi: {
    getRiskExplanation: vi.fn(),
  }
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RiskExplanationPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('RiskExplanationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('shows no-data state when explanation is empty', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      frontend_safe_explanation: []
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('no-data-state')).toBeTruthy();
    });
    
    expect(screen.getByText(/No explanation available/i)).toBeTruthy();
  });

  it('renders increasing and decreasing factors safely', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        contributions: [
          { feature: 'verified_waz', raw_value: -2.1, shap_contribution: 0.5 },
          { feature: 'weight_velocity', raw_value: 0.1, shap_contribution: -0.2 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'verified_waz', display_label: 'Weight-for-age Score', direction: 'increased model-predicted risk', importance_rank: 1 },
        { feature: 'weight_velocity', display_label: 'Recent Weight Change', direction: 'decreased model-predicted risk', importance_rank: 1 }
      ],
      disclaimer: "These features influenced the model-predicted risk. They do not establish clinical causality."
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('explanation-container')).toBeTruthy();
    });

    // Check non-causal language
    expect(screen.getByText(/This factor increased the model-predicted risk/i)).toBeTruthy();
    expect(screen.getByText(/This factor reduced the model-predicted risk/i)).toBeTruthy();
    expect(screen.getByText(/They do not establish clinical causality/i)).toBeTruthy();

    // Check labels and values
    expect(screen.getByText('Weight-for-age Score')).toBeTruthy();
    expect(screen.getByText('-2.1')).toBeTruthy();
    expect(screen.getByText('Recent Weight Change')).toBeTruthy();
    expect(screen.getByText('0.1')).toBeTruthy();
  });

  it('handles missing recorded values safely', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        contributions: [
          { feature: 'fever_last_14_days', raw_value: null, shap_contribution: 0.1 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'fever_last_14_days', display_label: 'Fever Last 14 Days', direction: 'increased model-predicted risk', importance_rank: 2 }
      ],
      disclaimer: ""
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('explanation-container')).toBeTruthy();
    });

    expect(screen.getByText('Fever Last 14 Days')).toBeTruthy();
    expect(screen.getByText('Not recorded')).toBeTruthy();
  });
});
