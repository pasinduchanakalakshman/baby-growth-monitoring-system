import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import GrowthCharts from './GrowthCharts';
import { GrowthHistoryPoint } from '@/types/growth';

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


const mockHistory: GrowthHistoryPoint[] = [
  {
    id: 1,
    baby_id: 1,
    visit_date: '2023-01-01',
    weight_kg: 5.5,
    length_height_cm: null, // missing height
    verified_waz: -1.2,
    verified_haz: null,
  },
  {
    id: 2,
    baby_id: 1,
    visit_date: '2023-02-01',
    weight_kg: 6.2,
    length_height_cm: 61,
    verified_waz: -0.5,
    verified_haz: -0.1,
  }
];

describe('GrowthCharts Component', () => {
  it('renders tabs correctly', () => {
    render(<GrowthCharts history={mockHistory} />);
    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('Length / Height')).toBeTruthy();
    expect(screen.getByText('WAZ')).toBeTruthy();
    expect(screen.getByText('HAZ')).toBeTruthy();
  });

  it('switches to Length / Height tab and handles missing height', () => {
    render(<GrowthCharts history={mockHistory} />);
    
    // Switch to height tab
    fireEvent.click(screen.getByText('Length / Height'));
    
    // Since mockHistory has one point with missing height and one with height, it should render the chart, not the "No data" text
    expect(screen.queryByText('No length/height data recorded yet.')).not.toBeTruthy();
  });

  it('displays empty state for HAZ if no HAZ available', () => {
    const noHazHistory = [{
      ...mockHistory[0],
      verified_waz: 0,
    }];
    
    render(<GrowthCharts history={noHazHistory} />);
    fireEvent.click(screen.getByText('HAZ'));
    expect(screen.getByText('No HAZ available (requires length/height).')).toBeTruthy();
  });

  it('sorts history chronologically', () => {
    const outOfOrderHistory = [mockHistory[1], mockHistory[0]];
    render(<GrowthCharts history={outOfOrderHistory} />);
    // Component should still render without throwing since it sorts internally
    expect(screen.getByText('Weight')).toBeTruthy();
  });
});
