import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddMeasurementPage from './AddMeasurementPage';
import { useAuth } from '@/auth/AuthProvider';
import { babyApi } from '@/api/baby';
import { growthApi } from '@/api/growth';
import { ApiClientError } from '@/api/client';
import type { BabyProfile } from '@/types/baby';
import type { GrowthHistoryPoint } from '@/types/growth';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/baby', () => ({ babyApi: { getBabyProfile: vi.fn() } }));
vi.mock('@/api/growth', () => ({
  growthApi: { addGrowthMeasurement: vi.fn(), getGrowthHistory: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual('react-router-dom'), useNavigate: () => mockNavigate,
}));

const baby: BabyProfile = {
  id: 1, owner_id: 1, name: 'Baby A', sex: 'Female', date_of_birth: '2023-01-01', birth_weight_kg: 3,
};
const saved: GrowthHistoryPoint = { id: 1, baby_id: 1, visit_date: '2023-06-01', weight_kg: 4.5 };
const optionalFields = [
  'currently_breastfeeding', 'formula_feeding', 'solid_foods_started',
  'diarrhea_last_14_days', 'fever_last_14_days', 'cough_last_14_days',
] as const;

describe('AddMeasurementPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['baby.profile'], baby);
    vi.mocked(useAuth).mockReturnValue({ user: { id: 1, email: 'test@example.com', name: 'Test Mother' } } as ReturnType<typeof useAuth>);
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(baby);
    vi.mocked(growthApi.addGrowthMeasurement).mockResolvedValue(saved);
  });

  afterEach(() => { queryClient.clear(); });

  const renderComponent = () => render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><AddMeasurementPage /></BrowserRouter>
    </QueryClientProvider>,
  );
  const date = () => screen.getByLabelText(/Visit Date/i) as HTMLInputElement;
  const weight = () => screen.getByLabelText(/Weight/i) as HTMLInputElement;
  const height = () => screen.getByLabelText(/Length \/ Height/i) as HTMLInputElement;
  const form = () => screen.getByRole('button', { name: /Save Measurement|Saving/i }).closest('form')!;
  const enterValid = () => {
    fireEvent.change(date(), { target: { value: '2023-06-01' } });
    fireEvent.change(weight(), { target: { value: '4.5' } });
  };

  it('preserves the existing fields and optional unanswered questions', () => {
    const { container } = renderComponent();
    expect(screen.getByText('Add Growth Measurement')).toBeInTheDocument();
    expect(date()).toBeRequired();
    expect(weight()).toBeRequired();
    expect(height()).not.toBeRequired();
    expect(container.querySelectorAll('input')).toHaveLength(15);
    expect(screen.getAllByRole('radio')).toHaveLength(12);
    screen.getAllByRole('radio').forEach(radio => expect(radio).not.toBeChecked());
    expect(screen.queryByLabelText(/age_days|child_id/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows both required errors inline on submit and preserves other entries', () => {
    renderComponent();
    fireEvent.change(date(), { target: { value: '' } });
    fireEvent.change(height(), { target: { value: '65.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Measurement' }));
    expect(date()).toHaveAccessibleDescription('Please select a visit date.');
    expect(weight()).toHaveAccessibleDescription("Please enter your baby's weight.");
    expect(date()).toHaveClass('border-destructive');
    expect(weight()).toHaveAttribute('aria-invalid', 'true');
    expect(height()).toHaveValue(65.5);
    expect(growthApi.addGrowthMeasurement).not.toHaveBeenCalled();
  });

  it('validates on blur and clears only the corrected field error', () => {
    renderComponent();
    fireEvent.change(weight(), { target: { value: '0' } });
    expect(screen.queryByText('Please enter a valid weight.')).not.toBeInTheDocument();
    fireEvent.blur(weight());
    fireEvent.change(height(), { target: { value: '150' } });
    fireEvent.blur(height());
    expect(weight()).toHaveAccessibleDescription('Please enter a valid weight.');
    expect(weight()).toHaveValue(0);
    fireEvent.change(weight(), { target: { value: '4.5' } });
    expect(weight()).toHaveAttribute('aria-invalid', 'false');
    expect(weight()).not.toHaveClass('border-destructive');
    expect(height()).toHaveAccessibleDescription('Please enter a valid length or height.');
    fireEvent.change(height(), { target: { value: '' } });
    expect(height()).toHaveAttribute('aria-invalid', 'false');
  });

  it.each([
    ['2022-12-31', "Visit date cannot be before your baby's date of birth."],
    ['9999-12-31', 'Visit date cannot be in the future.'],
  ])('rejects invalid visit date %s on blur and submission', (value, message) => {
    renderComponent();
    enterValid();
    fireEvent.change(date(), { target: { value } });
    fireEvent.blur(date());
    expect(date()).toHaveAccessibleDescription(message);
    fireEvent.submit(form());
    expect(growthApi.addGrowthMeasurement).not.toHaveBeenCalled();
    fireEvent.change(date(), { target: { value: '2023-06-01' } });
    expect(date()).toHaveAttribute('aria-invalid', 'false');
  });

  it('reads confirmed duplicate dates from the current cache without fetching history', () => {
    renderComponent();
    enterValid();
    queryClient.setQueryData(['growth.history'], [saved]);
    fireEvent.submit(form());
    expect(date()).toHaveAccessibleDescription('A measurement already exists for this date.');
    expect(growthApi.addGrowthMeasurement).not.toHaveBeenCalled();
    expect(growthApi.getGrowthHistory).not.toHaveBeenCalled();
  });

  it.each([undefined, [], [{ ...saved, visit_date: '2024-06-01' }], [{ ...saved, baby_id: 2 }]])
    ('allows a valid historical date without a confirmed duplicate: %j', async history => {
      if (history) queryClient.setQueryData(['growth.history'], history);
      renderComponent();
      enterValid();
      fireEvent.submit(form());
      expect(await screen.findByText('Measurement saved.')).toBeInTheDocument();
      expect(growthApi.addGrowthMeasurement).toHaveBeenCalledOnce();
      expect(growthApi.getGrowthHistory).not.toHaveBeenCalled();
    });

  it.each(['0', '-2', '0.49', '40.5'])('blocks invalid weight %s at submission', value => {
    renderComponent();
    enterValid();
    fireEvent.change(weight(), { target: { value } });
    fireEvent.submit(form());
    expect(weight()).toHaveAccessibleDescription('Please enter a valid weight.');
    expect(growthApi.addGrowthMeasurement).not.toHaveBeenCalled();
  });

  it.each(['0', '-10', '29.99', '150'])('blocks invalid optional height %s at submission', value => {
    renderComponent();
    enterValid();
    fireEvent.change(height(), { target: { value } });
    fireEvent.submit(form());
    expect(height()).toHaveAccessibleDescription('Please enter a valid length or height.');
    expect(growthApi.addGrowthMeasurement).not.toHaveBeenCalled();
  });

  it.each(['visit_date', 'weight_kg', 'length_height_cm'] as const)
    ('blocks browser-sanitized bad input in %s, including optional height', field => {
      renderComponent();
      enterValid();
      const input = document.querySelector<HTMLInputElement>(`input[name="${field}"]`)!;
      fireEvent.change(input, { target: { value: '' } });
      Object.defineProperty(input.validity, 'badInput', { configurable: true, value: true });
      fireEvent.blur(input);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      fireEvent.submit(form());
      expect(growthApi.addGrowthMeasurement).not.toHaveBeenCalled();
      Object.defineProperty(input.validity, 'badInput', { configurable: true, value: false });
    });

  it.each([['0.5', '30'], ['40', '130'], ['4.56789', '65.56789']])
    ('accepts numeric boundaries and precise decimals (%s, %s)', async (weightValue, heightValue) => {
      renderComponent();
      enterValid();
      fireEvent.change(weight(), { target: { value: weightValue } });
      fireEvent.change(height(), { target: { value: heightValue } });
      expect(weight().value).toBe(weightValue);
      expect(height().value).toBe(heightValue);
      fireEvent.submit(form());
      await waitFor(() => expect(growthApi.addGrowthMeasurement).toHaveBeenCalledOnce());
      expect(vi.mocked(growthApi.addGrowthMeasurement).mock.calls[0][0]).toMatchObject({
        weight_kg: Number(weightValue), length_height_cm: Number(heightValue),
      });
    });

  it('preserves the exact payload fields and undefined optional values', async () => {
    renderComponent();
    enterValid();
    fireEvent.submit(form());
    expect(await screen.findByText('Measurement saved.')).toBeInTheDocument();
    expect(vi.mocked(growthApi.addGrowthMeasurement).mock.calls[0][0]).toEqual({
      visit_date: '2023-06-01', weight_kg: 4.5, length_height_cm: undefined,
      currently_breastfeeding: undefined, formula_feeding: undefined, solid_foods_started: undefined,
      diarrhea_last_14_days: undefined, fever_last_14_days: undefined, cough_last_14_days: undefined,
    });
  });

  it.each(['true', 'false'])('preserves every explicit Yes/No choice (%s) without age restrictions', async value => {
    renderComponent();
    enterValid();
    fireEvent.change(date(), { target: { value: baby.date_of_birth } });
    for (const field of optionalFields) {
      const input = document.querySelector<HTMLInputElement>(`input[name="${field}"][value="${value}"]`)!;
      fireEvent.click(input);
      fireEvent.blur(input);
    }
    fireEvent.submit(form());
    expect(await screen.findByText('Measurement saved.')).toBeInTheDocument();
    const payload = vi.mocked(growthApi.addGrowthMeasurement).mock.calls[0][0];
    for (const field of optionalFields) expect(payload[field]).toBe(value === 'true');
  });

  it('rejects an unexpected radio option and permits correction using an existing option', async () => {
    renderComponent();
    enterValid();
    const input = document.querySelector<HTMLInputElement>('input[name="formula_feeding"][value="true"]')!;
    input.value = 'unknown';
    fireEvent.click(input);
    expect(input).toHaveAccessibleDescription('Please select Yes or No.');
    fireEvent.submit(form());
    expect(growthApi.addGrowthMeasurement).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('input[name="formula_feeding"][value="false"]')!);
    fireEvent.submit(form());
    expect(await screen.findByText('Measurement saved.')).toBeInTheDocument();
  });

  it('blocks repeated submissions until the current request settles', async () => {
    let finish!: (value: GrowthHistoryPoint) => void;
    vi.mocked(growthApi.addGrowthMeasurement).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    renderComponent();
    enterValid();
    const currentForm = form();
    act(() => { fireEvent.submit(currentForm); fireEvent.submit(currentForm); });
    await waitFor(() => expect(growthApi.addGrowthMeasurement).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    fireEvent.submit(currentForm);
    expect(growthApi.addGrowthMeasurement).toHaveBeenCalledOnce();
    finish(saved);
    expect(await screen.findByText('Measurement saved.')).toBeInTheDocument();
  });

  it('preserves API errors and values, then permits retry after a failed request', async () => {
    vi.mocked(growthApi.addGrowthMeasurement).mockRejectedValueOnce(new ApiClientError('Error', 400, { detail: 'Existing backend validation' }));
    renderComponent();
    enterValid();
    fireEvent.submit(form());
    expect(await screen.findByText('Existing backend validation')).toBeInTheDocument();
    expect(date()).toHaveValue('2023-06-01');
    expect(weight()).toHaveValue(4.5);
    fireEvent.submit(form());
    expect(await screen.findByText('Measurement saved.')).toBeInTheDocument();
    expect(growthApi.addGrowthMeasurement).toHaveBeenCalledTimes(2);
  });

  it('preserves cache invalidation, navigation and the Add Another Measurement workflow', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderComponent();
    enterValid();
    fireEvent.click(document.querySelector('input[name="currently_breastfeeding"][value="false"]')!);
    fireEvent.submit(form());
    expect(await screen.findByText('Measurement saved.')).toBeInTheDocument();
    for (const key of ['growth.history', 'growth.overview', 'growth.forecast', 'risk.latest', 'risk.trajectory', 'risk.explanation']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    }
    fireEvent.click(screen.getByRole('button', { name: 'View History' }));
    expect(mockNavigate).toHaveBeenCalledWith('/growth/history');
    fireEvent.click(screen.getByRole('button', { name: 'Add Another Measurement' }));
    expect(weight()).toHaveValue(null);
    expect(height()).toHaveValue(null);
    expect(date()).toHaveValue('2023-06-01');
    expect(document.querySelector('input[name="currently_breastfeeding"][value="false"]')).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
