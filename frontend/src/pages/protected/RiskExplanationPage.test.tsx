import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('RiskExplanationPage (Task 4.5A)', () => {
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
      expect(screen.getByText(/No explanation available/i)).toBeTruthy();
    });
  });

  it('renders all required 4 parent-friendly sections and coverage disclosure', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        base_value: -1.25,
        contributions: [
          { feature: 'weight_kg', raw_value: 8.254, transformed_value: 0.12, shap_contribution: 0.45 },
          { feature: 'days_since_previous_visit', raw_value: 30, transformed_value: -0.1, shap_contribution: -0.22 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'weight_kg', display_label: 'Current weight', direction: 'increased model-predicted risk', importance_rank: 1 },
        { feature: 'days_since_previous_visit', display_label: 'Time since previous growth check', direction: 'decreased model-predicted risk', importance_rank: 1 }
      ],
      disclaimer: "These features influenced the model-predicted risk. They do not establish clinical causality."
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('explanation-container')).toBeTruthy();
    });

    // Check 4 mandatory sections
    expect(screen.getByTestId('section-understanding')).toBeTruthy();
    expect(screen.getByText(/1\. Understanding Your Child's Growth Assessment/i)).toBeTruthy();

    expect(screen.getByTestId('section-measurements')).toBeTruthy();
    expect(screen.getByText(/2\. Measurements the AI Paid Attention To/i)).toBeTruthy();

    expect(screen.getByTestId('section-longitudinal')).toBeTruthy();
    expect(screen.getByText(/3\. Changes Between Clinic Visits/i)).toBeTruthy();

    expect(screen.getByTestId('section-next-steps')).toBeTruthy();
    expect(screen.getByText(/4\. What You Can Do Next/i)).toBeTruthy();

    // Check XGBoost 90% / 10% Transformer coverage disclosure
    expect(screen.getByTestId('section-coverage-disclosure')).toBeTruthy();
    expect(screen.getAllByText(/90% XGBoost/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/10% Clean Transformer/i)).toBeTruthy();
    expect(screen.getByText(/explain only the 90% XGBoost branch/i)).toBeTruthy();
  });

  it('renders parent-friendly feature names, units, and roundings properly', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        base_value: -0.5,
        contributions: [
          { feature: 'weight_kg', raw_value: 7.456, shap_contribution: 0.35 },
          { feature: 'length_height_cm', raw_value: 68.32, shap_contribution: -0.15 },
          { feature: 'weight_velocity_kg_per_day', raw_value: 0.015, shap_contribution: -0.25 },
          { feature: 'haz_velocity_per_day', raw_value: 0.02, shap_contribution: 0.18 },
          { feature: 'days_since_previous_visit', raw_value: 32, shap_contribution: 0.1 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'weight_kg', display_label: 'Current weight', direction: 'increased model-predicted risk', importance_rank: 1 },
        { feature: 'length_height_cm', display_label: 'Current length / height', direction: 'decreased model-predicted risk', importance_rank: 1 },
        { feature: 'weight_velocity_kg_per_day', display_label: 'Average daily weight change', direction: 'decreased model-predicted risk', importance_rank: 2 },
        { feature: 'haz_velocity_per_day', display_label: 'Change in length-for-age growth score', direction: 'increased model-predicted risk', importance_rank: 2 },
        { feature: 'days_since_previous_visit', display_label: 'Time since previous growth check', direction: 'increased model-predicted risk', importance_rank: 3 }
      ],
      disclaimer: "These features influenced the model-predicted risk. They do not establish clinical causality."
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('explanation-container')).toBeTruthy();
    });

    // Parent-friendly labels (STEP 2)
    expect(screen.getByText('Current weight')).toBeTruthy();
    expect(screen.getByText('Current length / height')).toBeTruthy();
    expect(screen.getByText('Average daily weight change')).toBeTruthy();
    expect(screen.getByText('Change in length-for-age growth score')).toBeTruthy();
    expect(screen.getByText('Time since previous growth check')).toBeTruthy();

    // Formatted recorded values with proper units and rounding (STEP 3)
    // Weight rounded to 2 decimals in kg
    expect(screen.getByText('7.46 kg')).toBeTruthy();
    // Length/height rounded to 1 decimal in cm
    expect(screen.getByText('68.3 cm')).toBeTruthy();
    // Daily weight change in grams/day
    expect(screen.getByText('+15 g/day')).toBeTruthy();
    // HAZ change as growth score change, not cm or kg
    expect(screen.getByText('+0.02 growth score change')).toBeTruthy();
    // Days rounded to whole days
    expect(screen.getByText('32 days')).toBeTruthy();

    // Direction indicators (STEP 4)
    expect(screen.getAllByText(/Shifted model score higher/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Shifted model score lower/i).length).toBeGreaterThan(0);
  });

  it('handles missing recorded values safely as "Not recorded"', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        contributions: [
          { feature: 'fever_recent', raw_value: null, shap_contribution: 0.1 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'fever_recent', display_label: 'Recent fever reported', direction: 'increased model-predicted risk', importance_rank: 1 }
      ],
      disclaimer: "These features influenced the model-predicted risk. They do not establish clinical causality."
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('explanation-container')).toBeTruthy();
    });

    expect(screen.getByText('Recent fever reported')).toBeTruthy();
    expect(screen.getByText('Not recorded')).toBeTruthy();
  });

  it('renders real SHAP inputs dynamically rather than hardcoded mock factors', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        contributions: [
          { feature: 'birth_length_cm', raw_value: 50.2, shap_contribution: -0.42 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'birth_length_cm', display_label: 'Length at birth', direction: 'decreased model-predicted risk', importance_rank: 1 }
      ],
      disclaimer: "These features influenced the model-predicted risk. They do not establish clinical causality."
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('explanation-container')).toBeTruthy();
    });

    expect(screen.getByText('Length at birth')).toBeTruthy();
    expect(screen.getByText('50.2 cm')).toBeTruthy();
    expect(screen.getByText(/Your child's length recorded at birth was taken into account by the model/i)).toBeTruthy();
  });

  it('toggles technical details table containing raw identifiers and SHAP attributions', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        base_value: -1.025,
        contributions: [
          { feature: 'verified_waz', raw_value: -1.85, transformed_value: -1.82, shap_contribution: 0.3541 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'verified_waz', display_label: 'Weight-for-age growth score', direction: 'increased model-predicted risk', importance_rank: 1 }
      ],
      disclaimer: "These features influenced the model-predicted risk. They do not establish clinical causality."
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('section-technical-details')).toBeTruthy();
    });

    // Before clicking, table is not visible
    expect(screen.queryByRole('table')).toBeNull();

    // Click to expand
    const toggleButton = screen.getByRole('button', { name: /Technical Details/i });
    fireEvent.click(toggleButton);

    // Now technical table with exact identifiers and attributions is visible
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('verified_waz')).toBeTruthy();
    expect(screen.getByText('-1.85')).toBeTruthy();
    expect(screen.getByText('-1.8200')).toBeTruthy();
    expect(screen.getByText('+0.3541')).toBeTruthy();
    expect(screen.getByText(/-1.0250/)).toBeTruthy();
  });

  it('complies with safety requirements: non-causal language and neutral next steps', async () => {
    (growthApi.getRiskExplanation as any).mockResolvedValue({
      technical_explanation: {
        contributions: [
          { feature: 'verified_waz', raw_value: -2.1, shap_contribution: 0.5 }
        ]
      },
      frontend_safe_explanation: [
        { feature: 'verified_waz', display_label: 'Weight-for-age growth score', direction: 'increased model-predicted risk', importance_rank: 1 }
      ],
      disclaimer: "These features influenced the model-predicted risk. They do not establish clinical causality."
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('explanation-container')).toBeTruthy();
    });

    // Safety checks: no causal language
    const containerText = screen.getByTestId('explanation-container').textContent || '';
    expect(containerText).not.toMatch(/caused your child to be at risk/i);
    expect(containerText).not.toMatch(/because your child is malnourished/i);
    expect(containerText).not.toMatch(/because your child is stunted/i);

    // Neutral next steps for Sri Lankan healthcare context
    expect(screen.getByText(/Attend Regular Clinic Visits/i)).toBeTruthy();
    expect(screen.getByText(/MOH \/ PHM clinic/i)).toBeTruthy();
    expect(screen.getByText(/Follow Your CHDR Booklet/i)).toBeTruthy();
    expect(screen.getByText(/Talk to Healthcare Workers/i)).toBeTruthy();
  });
});
