import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddMeasurementPage from './AddMeasurementPage';
import { useAuth } from '@/auth/AuthProvider';
import { babyApi } from '@/api/baby';
import { growthApi } from '@/api/growth';

// Mock dependencies
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/api/baby', () => ({
  babyApi: {
    getBabyProfile: vi.fn(),
  }
}));

vi.mock('@/api/growth', () => ({
  growthApi: {
    addGrowthMeasurement: vi.fn(),
  }
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AddMeasurementPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (useAuth as any).mockReturnValue({
      user: { id: 1, email: 'test@example.com', name: 'Test Mother' }
    });

    (babyApi.getBabyProfile as any).mockResolvedValue({
      id: 1, name: 'Baby A', date_of_birth: '2023-01-01'
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AddMeasurementPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('renders correctly', () => {
    renderComponent();
    expect(screen.getByText('Add Growth Measurement')).toBeTruthy();
    expect(screen.getByLabelText(/Visit Date/i)).toBeTruthy();
    expect(screen.getByLabelText(/Weight/i)).toBeTruthy();
    expect(screen.getByLabelText(/Length \/ Height/i)).toBeTruthy();
    expect(screen.queryByLabelText(/age_days/i)).not.toBeTruthy(); // No age_days input
    expect(screen.queryByLabelText(/child_id/i)).not.toBeTruthy(); // No child_id input
  });



  it('rejects visit date before date of birth', async () => {
    renderComponent();
    
    fireEvent.change(screen.getByLabelText(/Visit Date/i), { target: { value: '2022-12-31' } });
    fireEvent.change(screen.getByLabelText(/Weight/i), { target: { value: '5.5' } });
    await new Promise(resolve => setTimeout(resolve, 50)); // Wait for baby profile query
    fireEvent.click(screen.getByRole('button', { name: /Save Measurement/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Visit date cannot be before the baby's date of birth/i)).toBeTruthy();
    });
  });

  it('rejects future visit date', async () => {
    renderComponent();
    
    // Create a date in the future
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const dateStr = futureDate.toISOString().split('T')[0];
    
    fireEvent.change(screen.getByLabelText(/Visit Date/i), { target: { value: dateStr } });
    fireEvent.change(screen.getByLabelText(/Weight/i), { target: { value: '5.5' } });
    await new Promise(resolve => setTimeout(resolve, 50)); // Wait for baby profile query
    fireEvent.click(screen.getByRole('button', { name: /Save Measurement/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Visit date cannot be in the future/i)).toBeTruthy();
    });
  });

  it('submits successfully with valid data', async () => {
    (growthApi.addGrowthMeasurement as any).mockResolvedValueOnce({
      id: 1,
      visit_date: '2023-06-01',
      weight_kg: 7.5,
    });

    renderComponent();
    
    fireEvent.change(screen.getByLabelText(/Visit Date/i), { target: { value: '2023-06-01' } });
    fireEvent.change(screen.getByLabelText(/Weight/i), { target: { value: '7.5' } });
    fireEvent.change(screen.getByLabelText(/Length \/ Height/i), { target: { value: '' } }); // Missing height allowed
    
    fireEvent.click(screen.getByRole('button', { name: /Save Measurement/i }));
    
    await waitFor(() => {
      expect(growthApi.addGrowthMeasurement).toHaveBeenCalled();
      const callArgs = (growthApi.addGrowthMeasurement as any).mock.calls[0][0];
      expect(callArgs).toMatchObject({
        visit_date: '2023-06-01',
        weight_kg: 7.5,
      });
      expect(screen.getByText('Measurement saved.')).toBeTruthy();
    });
  });
});
