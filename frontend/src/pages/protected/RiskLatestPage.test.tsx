import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RiskLatestPage from './RiskLatestPage';
import { growthApi } from '@/api/growth';
import fixtures from '@/test/fixtures/personalizedGrowthAssessments.json';
import type { RiskExplanation, Risk180Day, GrowthHistoryPoint, Forecast30Day } from '@/types/growth';

vi.mock('recharts', async () => ({
  ...await vi.importActual('recharts'),
  ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) => React.cloneElement(children, { width: 360, height: 288 }),
}));

vi.mock('@/api/growth', () => ({
  growthApi: {
    getGrowthOverview: vi.fn(),
    getLatestRisk: vi.fn(),
    getModelInfo: vi.fn(),
    getRiskExplanation: vi.fn(),
    getGrowthHistory: vi.fn(),
    getGrowthForecast: vi.fn(),
  }
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const renderComponent = (initialEntries = ['/growth/risk']) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <RiskLatestPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const defaultModelInfo = {
  Risk: {
    model: 'XGBoost + Transformer Late Fusion Hybrid',
    horizon_days: 180,
    threshold: 0.06405469514
  },
  Forecast: {
    model: 'CatBoost',
    nominal_horizon_days: 30,
    training_target: 'weight_kg'
  },
  Disclaimers: ['Research support only.']
};

describe('Growth Risk & Insights (Combined Page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('shows no-data state when current_growth is missing', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: null
    });
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Add a growth measurement before viewing a risk assessment/i)).toBeTruthy();
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Growth Risk & Insights');
    expect(screen.getByText("Understand your baby's growth assessment and the information behind it.")).toBeTruthy();
  });

  it('shows unavailable-risk state if risk_available is false', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 5 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue({
      risk_available: false,
      reason: 'Model not applicable.'
    });
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('unavailable-risk-state')).toBeTruthy();
    });

    expect(screen.getByText(/Model not applicable/i)).toBeTruthy();
  });

  it('displays combined page with risk assessment and full explanation sections', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 3.3 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childA.risk as Risk180Day);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(fixtures.childA.explanation as RiskExplanation);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(fixtures.childA.history as GrowthHistoryPoint[]);
    vi.mocked(growthApi.getGrowthForecast).mockResolvedValue({
      forecast_available: true,
      estimated_future_weight_kg: 4.5,
      estimated_weight_change_kg: 0.3,
      estimated_future_waz: -0.4,
      nominal_horizon_days: 30,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    // 1. Page Header & Subtitle
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Growth Risk & Insights');
    expect(screen.getByText("Understand your baby's growth assessment and the information behind it.")).toBeTruthy();

    // 2. Risk Assessment Card
    expect(screen.getByTestId('risk-score-value').textContent).toBe('0.066');
    expect(screen.getByTestId('screening-status-badge').textContent).toBe('Elevated screening risk');
    const measurement = screen.getByRole('heading', { name: 'Latest measurement' }).parentElement!;
    expect(within(measurement).getByText('January 1, 2023')).toBeTruthy();
    expect(within(measurement).getByText('Used for this risk assessment')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Growth-Faltering Risk Score' })).toBeTruthy();
    expect(screen.queryByText(/180-Day Growth-Faltering Risk Score/i)).toBeNull();
    expect(screen.queryByText(/This is an experimental AI screening score/i)).toBeNull();
    expect(screen.queryByText(/Research screening threshold:/i)).toBeNull();
    expect(screen.queryByTestId('technical-details')).toBeNull();

    // 4. Second Section — Why This Risk Assessment?
    const explanationSection = screen.getByTestId('explanation-section');
    expect(explanationSection.id).toBe('why-this-risk-assessment');
    expect(within(explanationSection).getByText('Why This Risk Assessment?')).toBeTruthy();

    // Subsection A: Your Baby's Growth Assessment
    const screeningSummary = await screen.findByTestId('screening-summary');
    expect(screen.getByText("A. Your Baby's Growth Assessment")).toBeTruthy();
    expect(within(screeningSummary).getByText('Closer growth monitoring may be helpful')).toBeTruthy();

    const story = screen.getByTestId('integrated-growth-story');
    expect(within(story).getByText('Is my baby gaining weight?')).toBeTruthy();
    expect(within(story).getByText('Why is the AI concerned about my baby?')).toBeTruthy();
    expect(within(story).queryByText('What might this mean for future growth?')).toBeNull();
    expect(within(story).queryByText('What should I do next?')).toBeNull();
    expect(within(screeningSummary).queryByText(/next 180 days/i)).toBeNull();
    expect(screen.queryByText('Distinguishing Forecast from Screening:')).toBeNull();

    const forecastCard = screen.getByTestId('forecast-30day-card');
    expect(within(forecastCard).getByText('30-Day Short-Term Growth Forecast')).toBeTruthy();
    expect(within(forecastCard).getByText(/4.50 kg/)).toBeTruthy();

    // Subsection B: What Information Influenced This Assessment?
    expect(screen.queryByText("B. What Information Influenced This Assessment?")).toBeNull();
    expect(screen.queryByTestId('recorded-factors')).toBeNull();
    expect(screen.queryByText('Distinguishing AI Feature Contributions from Weight Loss')).toBeNull();

    // Subsection C: Changes in Your Baby's Growth
    expect(screen.getByText("C. Changes in Your Baby's Growth")).toBeTruthy();
    const weightCards = screen.getByTestId('weight-summary-cards');
    expect(within(weightCards).getByText('Cannot yet be determined')).toBeTruthy();
    expect(screen.getByTestId('waz-growth-comparison')).toBeTruthy();

    // What Should You Do Next?
    const nextSteps = screen.getByTestId('next-steps-section');
    expect(within(nextSteps).getByText('What Should You Do Next?')).toBeTruthy();
    expect(within(nextSteps).getByText(/Child Health Development Record \(CHDR\)/i)).toBeTruthy();
    expect(within(nextSteps).getByText(/Please discuss this screening result with your Public Health Midwife or doctor\./i)).toBeTruthy();
  });

  it('keeps risk history and the explanation available without the removed shortcut button', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 3.3 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childA.risk as Risk180Day);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(fixtures.childA.explanation as RiskExplanation);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(fixtures.childA.history as GrowthHistoryPoint[]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: /Why This Risk/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'View Risk History' })).toBeTruthy();
    expect(screen.getByTestId('explanation-section')).toBeTruthy();
  });

  it('keeps risk score visible when explanation data is unavailable', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 5.0 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue({
      risk_available: true,
      risk_probability: 0.12,
      risk_score: 0.12,
      risk_threshold: 0.064,
      risk_flag: 1,
      screening_status: 'Elevated screening risk',
      prediction_horizon_days: 180,
    });
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);
    vi.mocked(growthApi.getRiskExplanation).mockRejectedValue(new Error('Network error loading explanation'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    // Risk score remains confirmed and visible
    expect(screen.getByTestId('risk-score-value').textContent).toBe('0.120');
    expect(screen.getByTestId('screening-status-badge').textContent).toBe('Elevated screening risk');

    // Explanation displays unavailable state gracefully
    await waitFor(() => {
      expect(screen.getByTestId('explanation-unavailable')).toBeTruthy();
    });
    expect(screen.getByText('Growth explanation is currently unavailable')).toBeTruthy();
  });

  it('renders below screening threshold status correctly with encouraging yet cautious tone', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 2, name: 'Baby B' },
      current_growth: { visit_date: '2023-02-01', weight_kg: 4.2 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childB.risk as Risk180Day);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(fixtures.childB.explanation as RiskExplanation);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(fixtures.childB.history as GrowthHistoryPoint[]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    expect(screen.getByTestId('risk-score-value').textContent).toBe('0.032');
    expect(screen.getByTestId('screening-status-badge').textContent).toBe('Below screening threshold');

    const summary = await screen.findByTestId('screening-summary');
    expect(within(summary).getByText('Continue regular growth checks')).toBeTruthy();
    expect(within(summary).getByText(/did not trigger an elevated screening alert/i)).toBeTruthy();
    expect(within(summary).getByText(/does not guarantee that growth difficulties cannot occur/i)).toBeTruthy();

    // WAZ comparison
    const wazCard = screen.getByTestId('waz-growth-comparison');
    expect(within(wazCard).getByText('Tracking lower relative to age curve')).toBeTruthy();
  });

  it('displays multi-visit weight gain progression and SVG chart for Child B', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 2, name: 'Baby B' },
      current_growth: { visit_date: '2023-02-01', weight_kg: 4.2 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childB.risk as Risk180Day);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(fixtures.childB.explanation as RiskExplanation);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(fixtures.childB.history as GrowthHistoryPoint[]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    await screen.findByTestId('screening-summary');

    const weightCards = screen.getByTestId('weight-summary-cards');
    expect(within(weightCards).getByText('3.30 kg')).toBeTruthy();
    expect(within(weightCards).getByText('4.20 kg')).toBeTruthy();
    expect(within(weightCards).getByText('+0.90 kg')).toBeTruthy();

    const chart = screen.getByTestId('weight-history-chart');
    expect(within(chart).getByText('Weight over time')).toBeTruthy();
    expect(within(chart).getByText('2 checks recorded')).toBeTruthy();
  });

  it('automatically triggers smooth scroll when URL hash is #why-this-risk-assessment', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 3.3 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childA.risk as Risk180Day);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(fixtures.childA.explanation as RiskExplanation);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(fixtures.childA.history as GrowthHistoryPoint[]);

    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderComponent(['/growth/risk#why-this-risk-assessment']);

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });
  });

  it('keeps the remaining explanation available without the removed factor section when factors are missing', async () => {
    vi.mocked(growthApi.getGrowthOverview).mockResolvedValue({
      baby: { id: 1, name: 'Baby A' },
      current_growth: { visit_date: '2023-01-01', weight_kg: 3.3 }
    });
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childA.risk as Risk180Day);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue(defaultModelInfo);

    const emptyExplanation = structuredClone(fixtures.childA.explanation) as RiskExplanation;
    emptyExplanation.frontend_safe_explanation = [];
    emptyExplanation.technical_explanation.contributions = [];
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(emptyExplanation);
    vi.mocked(growthApi.getGrowthHistory).mockResolvedValue(fixtures.childA.history as GrowthHistoryPoint[]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('risk-available-state')).toBeTruthy();
    });

    await screen.findByTestId('screening-summary');
    expect(screen.queryByText('No specific contributing factors were identified in the available explanation.')).toBeNull();
    expect(screen.queryByTestId('recorded-factors')).toBeNull();
    expect(screen.getByTestId('integrated-growth-story')).toBeTruthy();
  });
});
