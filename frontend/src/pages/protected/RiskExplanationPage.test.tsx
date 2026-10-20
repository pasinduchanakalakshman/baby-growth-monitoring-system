import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RiskExplanationPage from './RiskExplanationPage';
import { growthApi } from '@/api/growth';
import { ApiClientError } from '@/api/client';
import type { RiskExplanation, Risk180Day } from '@/types/growth';
import fixtures from '@/test/fixtures/personalizedGrowthAssessments.json';

const auth = vi.hoisted(() => ({ user: { id: 1 }, isAuthenticated: true }));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/api/growth', () => ({ growthApi: { getRiskExplanation: vi.fn(), getLatestRisk: vi.fn() } }));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const tree = () => <QueryClientProvider client={queryClient}><MemoryRouter><RiskExplanationPage /></MemoryRouter></QueryClientProvider>;
const renderPage = () => render(tree());
const explanation = () => structuredClone(fixtures.childA.explanation) as RiskExplanation;
const risk = () => structuredClone(fixtures.childA.risk) as Risk180Day;
const forbidden = /XGBoost|Transformer|\bSHAP\b|\bAI\b|90%|10%|hybrid|log.odds|technical details|weighted contribution|transformed value|model score|Factor #|model branch/i;

beforeEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
  auth.user = { id: 1 };
  auth.isAuthenticated = true;
  vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(explanation());
  vi.mocked(growthApi.getLatestRisk).mockResolvedValue(risk());
});

describe('Mother-friendly growth explanation', () => {
  it('shows exactly four ordered sections and no visible or hidden technical details', async () => {
    const { container } = renderPage();
    await screen.findByTestId('explanation-container');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("Your Baby's Growth Outlook — Next 6 Months");
    expect(screen.getByText("An early growth screening assessment based on your baby's recorded information.")).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      "Your Baby's Growth Assessment", 'What Information Influenced This Assessment?', "Changes in Your Baby's Growth", 'What Should You Do Next?',
    ]);
    expect(container.textContent).not.toMatch(forbidden);
    expect(container.textContent).not.toContain('%');
    expect(container.querySelector('details, summary, table, [aria-expanded]')).toBeNull();
    for (const value of Object.values(fixtures.childA.explanation.model_combination)) {
      if (value !== 0.9 && value !== 0.1) expect(container.textContent).not.toContain(value.toFixed(6));
    }
    expect(screen.getByText(/highlighted details explain part of the screening assessment/)).toBeTruthy();
  });

  it('uses the real elevated result with non-diagnostic guidance and a one-visit message', async () => {
    renderPage();
    expect(await screen.findByText('Closer growth monitoring may be helpful')).toBeTruthy();
    expect(screen.getByText(/has triggered an early screening alert for possible growth difficulties during the next 180 days/)).toBeTruthy();
    expect(screen.getByText(/does not mean your baby will definitely develop a growth problem/)).toBeTruthy();
    expect(screen.getAllByText(/increased the screening score in the explained part/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/decreased the screening score in the explained part/).length).toBeGreaterThan(0);
    expect(screen.getByText('Please discuss this screening result with your Public Health Midwife or doctor.')).toBeTruthy();
    expect(screen.getByText(/We have one recorded growth check.*There are no earlier growth checks/)).toBeTruthy();
    expect(screen.getByText('Recorded growth checks: 1.')).toBeTruthy();
    expect(screen.queryByTestId('recorded-changes')).toBeNull();
  });

  it('uses the real below-threshold result and actual multi-visit changes', async () => {
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(fixtures.childB.explanation as RiskExplanation);
    vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childB.risk);
    renderPage();
    expect(await screen.findByText(/did not trigger an elevated screening alert for possible growth difficulties during the next 180 days/)).toBeTruthy();
    expect(screen.getByText(/does not guarantee that growth difficulties cannot occur/)).toBeTruthy();
    expect(screen.queryByText('Please discuss this screening result with your Public Health Midwife or doctor.')).toBeNull();
    expect(screen.getByText(/recorded growth checks help us understand how measurements have changed over time/)).toBeTruthy();
    expect(screen.getByText('Recorded growth checks: 2.')).toBeTruthy();
    const changes = screen.queryByTestId('recorded-changes');
    // Some assessments rank no physical change among their top factors: never invent one.
    if (changes) expect(changes.textContent).toMatch(/kg|cm/);
    else expect(screen.getByText(/does not support a reliable growth comparison/)).toBeTruthy();
    expect(screen.getByTestId('explanation-container').textContent).not.toMatch(/definitely healthy|no risk detected|diagnosed/i);
  });

  it.each(['missing', 'different', 'invalid', 'unknown', 'contradictory', 'unavailable', 'error'])('uses neutral wording for %s status', async scenario => {
    const value = risk();
    if (scenario === 'missing') delete value.screening_status;
    if (scenario === 'different') {
      vi.mocked(growthApi.getLatestRisk).mockResolvedValue(fixtures.childB.risk);
    } else if (scenario === 'error') {
      vi.mocked(growthApi.getLatestRisk).mockRejectedValue(new Error('Transformer failed'));
    } else {
      if (scenario === 'invalid') value.model_combination!.hybrid_score = NaN;
      if (scenario === 'unknown') value.screening_status = 'New status';
      if (scenario === 'contradictory') value.risk_flag = 0;
      if (scenario === 'unavailable') value.risk_available = false;
      vi.mocked(growthApi.getLatestRisk).mockResolvedValue(value);
    }
    renderPage();
    expect(await screen.findByText('Growth screening result unavailable')).toBeTruthy();
    expect(screen.getByText('We cannot show a confirmed growth screening result at the moment. Please try again later.')).toBeTruthy();
    expect(screen.getByText(/not linked to a confirmed screening result here/)).toBeTruthy();
    expect(screen.queryByText(/increased the screening score/)).toBeNull();
    expect(screen.queryByText(/decreased the screening score/)).toBeNull();
    expect(screen.queryByText('Please discuss this screening result with your Public Health Midwife or doctor.')).toBeNull();
    expect(screen.getByTestId('explanation-container').textContent).not.toMatch(forbidden);
    expect(screen.getByTestId('recorded-factors')).toBeTruthy();
  });

  it('shows only attributed, recorded factors, retaining accurate measurement units', async () => {
    const data = explanation();
    data.frontend_safe_explanation = [
      { feature: 'weight_kg', display_label: 'XGBoost weight_kg', direction: 'increased model-predicted risk', importance_rank: 1 },
      { feature: 'length_height_cm', display_label: 'Length', direction: 'decreased model-predicted risk', importance_rank: 2 },
      { feature: 'formula_feeding', display_label: 'Formula', direction: 'decreased model-predicted risk', importance_rank: 3 },
      { feature: 'fever_recent', display_label: 'Fever', direction: 'increased model-predicted risk', importance_rank: 3 },
      { feature: 'internal_feature', display_label: 'SHAP contribution', direction: 'increased', importance_rank: 1 },
    ];
    data.technical_explanation.contributions = [
      { feature: 'weight_kg', raw_value: 4.25, transformed_value: 999, shap_contribution: 123.456 },
      { feature: 'length_height_cm', raw_value: 54.32, transformed_value: 888, shap_contribution: -222.333 },
      { feature: 'formula_feeding', raw_value: false, transformed_value: 0, shap_contribution: -0.1 },
      { feature: 'fever_recent', raw_value: null, transformed_value: 1, shap_contribution: 0.1 },
    ];
    const before = structuredClone(data);
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(data);
    renderPage();
    await screen.findByTestId('recorded-factors');
    expect(screen.getByText('4.25 kg')).toBeTruthy();
    expect(screen.getByText('54.3 cm')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
    expect(screen.queryByText('Birth weight')).toBeNull();
    expect(screen.queryByText('Recent fever reported')).toBeNull();
    expect(screen.getByTestId('recorded-factors').textContent).not.toMatch(forbidden);
    expect(screen.getByTestId('recorded-factors').textContent).not.toMatch(/999|888|123\.456|222\.333/);
    expect(data).toEqual(before);
  });

  it('does not describe prior growth when only one visit exists, even if a change factor is supplied', async () => {
    const data = explanation();
    data.frontend_safe_explanation.unshift({ feature: 'weight_change_kg', display_label: 'Weight change', direction: 'decreased', importance_rank: 1 });
    data.technical_explanation.contributions.push({ feature: 'weight_change_kg', raw_value: 0.2, transformed_value: 1, shap_contribution: -0.1 });
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(data);
    renderPage();
    await screen.findByTestId('explanation-container');
    expect(screen.queryByText('+0.20 kg')).toBeNull();
    expect(screen.queryByTestId('recorded-changes')).toBeNull();
    expect(screen.getByText(/There are no earlier growth checks/)).toBeTruthy();
  });

  it('shows measured physical changes only for multi-visit attributed factors with valid raw values', async () => {
    const data = explanation();
    data.assessment!.recorded_visit_count = 2;
    data.frontend_safe_explanation = ['weight_change_kg', 'height_change_cm'].map((feature, i) => ({ feature, display_label: feature, direction: 'decreased', importance_rank: i+1 }));
    data.technical_explanation.contributions = [
      { feature: 'weight_change_kg', raw_value: -0.12, transformed_value: 0, shap_contribution: 0.1 },
      { feature: 'height_change_cm', raw_value: null, transformed_value: 4, shap_contribution: -0.1 },
    ];
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(data);
    renderPage();
    const changes = await screen.findByTestId('recorded-changes');
    expect(within(changes).getByText('-0.12 kg')).toBeTruthy();
    expect(within(changes).queryByText('Change in length / height')).toBeNull();
  });

  it('keeps all sections and honest empty-factor wording when explanations have no recorded factors', async () => {
    const data = explanation();
    data.frontend_safe_explanation = [];
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(data);
    renderPage();
    expect(await screen.findByText(/No recorded measurement details are available/)).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  });

  it('handles legacy data without visit metadata or a combination without guessing', async () => {
    const data = explanation();
    delete data.assessment;
    delete data.model_combination;
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(data);
    renderPage();
    expect(await screen.findByText(/number of recorded growth checks is not available/)).toBeTruthy();
    expect(screen.getByText('Growth screening result unavailable')).toBeTruthy();
    expect(growthApi.getLatestRisk).not.toHaveBeenCalled();
  });

  it.each(['zero', 'no-history-error'])('shows an empty state for %s', async scenario => {
    if (scenario === 'zero') {
      const data = explanation();
      data.assessment!.recorded_visit_count = 0;
      vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(data);
    } else vi.mocked(growthApi.getRiskExplanation).mockRejectedValue(new ApiClientError('No history available for explanation.', 400));
    renderPage();
    expect(await screen.findByText('No growth checks recorded yet')).toBeTruthy();
    expect(growthApi.getLatestRisk).not.toHaveBeenCalled();
  });

  it('shows loading and a neutral explanation error without echoing backend technical messages', async () => {
    let rejectRequest!: (error: Error) => void;
    vi.mocked(growthApi.getRiskExplanation).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeTruthy();
    await waitFor(() => expect(rejectRequest).toBeTypeOf('function'));
    rejectRequest(new Error('XGBoost SHAP failed'));
    expect(await screen.findByTestId('error-state')).toBeTruthy();
    expect(screen.getByTestId('error-state').textContent).not.toMatch(forbidden);
  });

  it('discards account A data while account B loads or fails', async () => {
    const view = renderPage();
    await screen.findByTestId('explanation-container');
    auth.user = { id: 2 };
    vi.mocked(growthApi.getRiskExplanation).mockRejectedValueOnce(new Error('unavailable'));
    view.rerender(tree());
    expect(screen.queryByTestId('explanation-container')).toBeNull();
    await screen.findByTestId('error-state');
    expect(screen.queryByTestId('recorded-factors')).toBeNull();
  });

  it('discards late status responses from the previous account', async () => {
    let finish!: (result: Risk180Day) => void;
    let signal: AbortSignal | undefined;
    vi.mocked(growthApi.getRiskExplanation).mockImplementationOnce(async value => { signal = value; return explanation(); });
    vi.mocked(growthApi.getLatestRisk).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = renderPage();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    auth.user = { id: 2 };
    vi.mocked(growthApi.getRiskExplanation).mockRejectedValueOnce(new Error('no assessment'));
    view.rerender(tree());
    expect(signal!.aborted).toBe(true);
    finish(risk());
    await screen.findByTestId('error-state');
    expect(screen.queryByTestId('explanation-container')).toBeNull();
  });

  it('does not request data for an unauthenticated account', () => {
    auth.isAuthenticated = false;
    renderPage();
    expect(growthApi.getRiskExplanation).not.toHaveBeenCalled();
    expect(growthApi.getLatestRisk).not.toHaveBeenCalled();
  });

  it('does not start a status request for an old account after a late explanation response', async () => {
    let finish!: (value: RiskExplanation) => void;
    let oldSignal: AbortSignal | undefined;
    vi.mocked(growthApi.getRiskExplanation).mockImplementationOnce(signal => {
      oldSignal = signal;
      return new Promise(resolve => { finish = resolve; });
    });
    const view = renderPage();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    auth.user = { id: 2 };
    vi.mocked(growthApi.getRiskExplanation).mockRejectedValueOnce(new Error('unavailable'));
    view.rerender(tree());
    expect(oldSignal!.aborted).toBe(true);
    finish(explanation());
    await screen.findByTestId('error-state');
    expect(growthApi.getLatestRisk).not.toHaveBeenCalled();
    expect(screen.queryByTestId('explanation-container')).toBeNull();
  });

  it('renders distinct recorded factor lists for independently owned children A and B', async () => {
    expect(fixtures.childA.user.id).not.toBe(fixtures.childB.user.id);
    expect(fixtures.childA.baby.id).not.toBe(fixtures.childB.baby.id);
    const view = renderPage();
    const first = await screen.findByTestId('recorded-factors');
    expect(first.textContent).toContain('3.30 kg');
    expect(first.textContent).toContain('Length at birth');
    const firstText = first.textContent;
    auth.user = { id: fixtures.childB.user.id };
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValueOnce(fixtures.childB.explanation as RiskExplanation);
    vi.mocked(growthApi.getLatestRisk).mockResolvedValueOnce(fixtures.childB.risk);
    view.rerender(tree());
    expect(screen.queryByTestId('recorded-factors')).toBeNull();
    const second = await screen.findByTestId('recorded-factors');
    expect(second.textContent).toContain('4.20 kg');
    expect(second.textContent).toContain('54.0 cm');
    expect(second.textContent).not.toContain('3.30 kg');
    expect(second.textContent).not.toContain('Length at birth');
    expect(second.textContent).not.toBe(firstText);
    expect(screen.getByTestId('recorded-changes').textContent).toContain('+4.0 cm');
  });

  it('uses neutral influence if attribution direction contradicts the signed contribution', async () => {
    const data = explanation();
    data.frontend_safe_explanation = [{ feature: 'weight_kg', display_label: 'Current weight', direction: 'increased model-predicted risk', importance_rank: 1 }];
    data.technical_explanation.contributions = [{ feature: 'weight_kg', raw_value: 3.3, transformed_value: 1, shap_contribution: -0.2 }];
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValue(data);
    renderPage();
    const factors = await screen.findByTestId('recorded-factors');
    expect(factors.textContent).toContain('This recorded measurement was considered in the explanation.');
    expect(factors.textContent).not.toMatch(/increased|decreased/);
  });

  it('keeps independently owned Child C neutral when its screening request is unavailable', async () => {
    auth.user = { id: fixtures.childC.user.id };
    expect(fixtures.childC.baby.id).not.toBe(fixtures.childA.baby.id);
    expect(fixtures.childC.baby.id).not.toBe(fixtures.childB.baby.id);
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValueOnce(fixtures.childC.explanation as RiskExplanation);
    vi.mocked(growthApi.getLatestRisk).mockRejectedValueOnce(new ApiClientError('Unavailable', 503));
    renderPage();
    expect(await screen.findByText('Growth screening result unavailable')).toBeTruthy();
    expect(screen.getByText(/not linked to a confirmed screening result here/)).toBeTruthy();
    expect(screen.getByText('Recorded growth checks: 3.')).toBeTruthy();
    expect(screen.queryByText(/increased the screening score|decreased the screening score/)).toBeNull();
    expect(screen.queryByText('Please discuss this screening result with your Public Health Midwife or doctor.')).toBeNull();
  });

  it('confirms a complete three-visit assessment and displays its actual count', async () => {
    auth.user = { id: fixtures.childC.user.id };
    vi.mocked(growthApi.getRiskExplanation).mockResolvedValueOnce(fixtures.childC.explanation as RiskExplanation);
    vi.mocked(growthApi.getLatestRisk).mockResolvedValueOnce(fixtures.childC.risk);
    renderPage();
    expect(await screen.findByText('Recorded growth checks: 3.')).toBeTruthy();
    expect(screen.getByText(/did not trigger an elevated screening alert.*Regular growth checks remain important/)).toBeTruthy();
    expect(screen.getByTestId('recorded-factors').textContent).toContain('5.10 kg');
    expect(screen.queryByText('Growth screening result unavailable')).toBeNull();
    expect(screen.getAllByText(/increased the screening score|decreased the screening score/).length).toBeGreaterThan(0);
  });
});
