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
    ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) => React.cloneElement(children, { width: 800, height: 320 }),
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

  it('shows only recorded visit dates without adding extra months', async () => {
    (growthApi.getRiskTrajectory as any).mockResolvedValue([
      { visit_date: '2023-01-01', risk_probability: 0.10 },
      { visit_date: '2023-02-01', risk_probability: 0.15 }
    ]);
    (growthApi.getModelInfo as any).mockResolvedValue({
      Risk: { threshold: 0.50 }
    });

    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('trajectory-chart-container')).toBeTruthy();
    });

    expect(screen.getByRole('heading', { name: 'Growth-Faltering Risk Score Trajectory' })).toBeTruthy();
    expect(screen.getByText('Threshold (0.500)')).toBeTruthy();
    expect(screen.queryByText(/Research Threshold/i)).toBeNull();
    expect(screen.queryByText(/experimental|180-day|Each point represents/i)).toBeNull();
    expect(screen.getByText('Monitoring information. This is not a medical diagnosis.')).toBeTruthy();
    expect([...container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(label => label.textContent))
      .toEqual(['January 1, 2023', 'February 1, 2023']);
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(2);
  });

  it('retains older recorded assessments and their values without adding calendar labels', async () => {
    const recorded = [
      { visit_date: '2023-02-01', risk_probability: 0.15 },
      { visit_date: '2022-04-01', risk_probability: 0.10 },
    ];
    const before = structuredClone(recorded);
    vi.mocked(growthApi.getRiskTrajectory).mockResolvedValue(recorded);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue({ Risk: { threshold: 0.06405469514 } } as any);
    const { container } = renderComponent();
    await screen.findByTestId('trajectory-chart-container');
    expect([...container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(label => label.textContent))
      .toEqual(['April 1, 2022', 'February 1, 2023']);
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(2);
    expect(screen.getByText('Threshold (0.064)')).toBeTruthy();
    expect(recorded).toEqual(before);
    expect(growthApi.getRiskTrajectory).toHaveBeenCalledTimes(1);
  });

  it.each([0, null])('shows only a valid supplied threshold, including zero: %s', async threshold => {
    vi.mocked(growthApi.getRiskTrajectory).mockResolvedValue([{ visit_date: '2023-02-01', risk_probability: 0.15 }]);
    vi.mocked(growthApi.getModelInfo).mockResolvedValue({ Risk: { threshold } } as any);
    const { container } = renderComponent();
    await screen.findByTestId('trajectory-chart-container');
    expect(container.querySelectorAll('.recharts-reference-line-line')).toHaveLength(threshold === 0 ? 1 : 0);
    expect(screen.queryByText('Threshold (0.000)') !== null).toBe(threshold === 0);
  });
});
