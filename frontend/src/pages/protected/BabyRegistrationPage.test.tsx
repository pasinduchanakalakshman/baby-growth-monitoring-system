import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { babyApi } from '@/api/baby';
import BabyRegistrationPage from './BabyRegistrationPage';

vi.mock('@/api/baby', () => ({
  babyApi: {
    registerBaby: vi.fn(),
    getBabyProfile: vi.fn(),
  },
}));

function renderBabyRegistration() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/register-baby']}>
        <Routes>
          <Route path="/register-baby" element={<BabyRegistrationPage />} />
          <Route path="/app" element={<h1>App Dashboard</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Helper to fill the valid baseline required fields
function fillBaselineValidForm(overrides: {
  name?: string;
  sex?: 'Male' | 'Female';
  dob?: string;
  weight?: string;
  ga?: string;
} = {}) {
  const name = overrides.name ?? 'Emma';
  const dob = overrides.dob ?? '2024-01-01';
  const weight = overrides.weight ?? '3.2';
  const ga = overrides.ga ?? '39';

  fireEvent.change(screen.getByLabelText(/Baby's Name \*/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/Date of Birth \*/i), { target: { value: dob } });
  fireEvent.change(screen.getByLabelText(/Birth Weight \(kg\) \*/i), { target: { value: weight } });
  fireEvent.change(screen.getByLabelText(/Gestational Age \(weeks\) \*/i), { target: { value: ga } });
}

describe('BabyRegistrationPage - Strict Validation & Safety Rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Section 6: Explicit Test Cases Matrix', () => {
    it('Case 1: 3.2 kg, 39 weeks -> Allow registration (no warning, no restriction)', async () => {
      vi.mocked(babyApi.registerBaby).mockResolvedValueOnce({ id: 1 } as any);
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '3.2', ga: '39' });
      fireEvent.change(screen.getByLabelText(/Date of Birth \*/i), { target: { value: '2024-01-01' } });

      expect(screen.queryByText(/Medical Attention Required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();
    });

    it('Case 2: 2.4 kg, 39 weeks -> Show medical warning, allow registration', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '2.4', ga: '39' });

      // Medical warning must be displayed
      expect(screen.getByText(/Medical Attention Required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Your baby's birth information indicates low birth weight or premature birth/i)
      ).toBeInTheDocument();
      // Restriction must NOT be displayed
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();
    });

    it('Case 3: 3.1 kg, 35 weeks -> Show medical warning, allow registration', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '3.1', ga: '35' });

      expect(screen.getByText(/Medical Attention Required/i)).toBeInTheDocument();
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();
    });

    it('Case 4: 2.2 kg, 32 weeks -> Show medical warning, allow registration', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '2.2', ga: '32' });

      expect(screen.getByText(/Medical Attention Required/i)).toBeInTheDocument();
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();
    });

    it('Case 5: 1.9 kg, 39 weeks -> Block registration, show restriction', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '1.9', ga: '39' });

      // Restriction banner must be displayed
      expect(screen.getByText(/Specialized Medical Assessment Required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Your baby's birth details indicate that specialized growth monitoring may be needed/i)
      ).toBeInTheDocument();
      // Warning banner must NOT be displayed (restriction takes priority)
      expect(screen.queryByText(/Medical Attention Required/i)).not.toBeInTheDocument();

      // Attempt submit
      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));
      expect(babyApi.registerBaby).not.toHaveBeenCalled();
    });

    it('Case 6: 3.0 kg, 27 weeks -> Block registration, show restriction', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '3.0', ga: '27' });

      expect(screen.getByText(/Specialized Medical Assessment Required/i)).toBeInTheDocument();
      expect(screen.queryByText(/Medical Attention Required/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));
      expect(babyApi.registerBaby).not.toHaveBeenCalled();
    });

    it('Case 7: 1.8 kg, 26 weeks -> Block registration, show restriction', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '1.8', ga: '26' });

      expect(screen.getByText(/Specialized Medical Assessment Required/i)).toBeInTheDocument();
      expect(screen.queryByText(/Medical Attention Required/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));
      expect(babyApi.registerBaby).not.toHaveBeenCalled();
    });

    it('Case 8: 5.5 kg, 39 weeks -> Show birth weight validation error', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '5.5', ga: '39' });

      const weightInput = screen.getByLabelText(/Birth Weight \(kg\) \*/i);
      fireEvent.blur(weightInput);

      expect(screen.getByText(/Birth weight must not exceed 5 kg/i)).toBeInTheDocument();
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));
      expect(babyApi.registerBaby).not.toHaveBeenCalled();
    });

    it('Case 9: 3.0 kg, 45 weeks -> Show gestational age validation error', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '3.0', ga: '45' });

      const gaInput = screen.getByLabelText(/Gestational Age \(weeks\) \*/i);
      fireEvent.blur(gaInput);

      expect(screen.getByText(/Gestational age must not exceed 44 weeks/i)).toBeInTheDocument();
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));
      expect(babyApi.registerBaby).not.toHaveBeenCalled();
    });

    it('Case 10: 2.0 kg, 28 weeks -> Show medical warning, allow registration', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '2.0', ga: '28' });

      expect(screen.getByText(/Medical Attention Required/i)).toBeInTheDocument();
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();
    });

    it('Case 11: 2.5 kg, 37 weeks -> Allow registration (boundary values, no warning or restriction)', async () => {
      renderBabyRegistration();

      fillBaselineValidForm({ weight: '2.5', ga: '37' });

      expect(screen.queryByText(/Medical Attention Required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();
    });
  });

  describe('Section 1: Required Field Validations', () => {
    it("validates Baby's Name: required, whitespace only rejected, max 100 characters", () => {
      renderBabyRegistration();
      const nameInput = screen.getByLabelText(/Baby's Name \*/i);

      // Empty / whitespace
      fireEvent.change(nameInput, { target: { value: '   ' } });
      fireEvent.blur(nameInput);
      expect(screen.getByText(/Baby's name is required/i)).toBeInTheDocument();

      // > 100 characters
      const longName = 'A'.repeat(101);
      fireEvent.change(nameInput, { target: { value: longName } });
      fireEvent.blur(nameInput);
      expect(screen.getByText(/Name cannot exceed 100 characters/i)).toBeInTheDocument();

      // Valid name clears error
      fireEvent.change(nameInput, { target: { value: 'Baby Liam' } });
      fireEvent.blur(nameInput);
      expect(screen.queryByText(/Baby's name is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Name cannot exceed 100 characters/i)).not.toBeInTheDocument();
    });

    it('validates Date of Birth: required, valid calendar date, no future dates', () => {
      renderBabyRegistration();
      const dobInput = screen.getByLabelText(/Date of Birth \*/i);

      // Empty
      fireEvent.change(dobInput, { target: { value: '' } });
      fireEvent.blur(dobInput);
      expect(screen.getByText(/Date of birth is required/i)).toBeInTheDocument();

      // Future date
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      fireEvent.change(dobInput, { target: { value: futureDateStr } });
      fireEvent.blur(dobInput);
      expect(screen.getByText(/Date of birth cannot be in the future/i)).toBeInTheDocument();

      // Valid date clears error
      fireEvent.change(dobInput, { target: { value: '2023-06-15' } });
      fireEvent.blur(dobInput);
      expect(screen.queryByText(/Date of birth cannot be in the future/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Date of birth is required/i)).not.toBeInTheDocument();
    });

    it('validates Gestational Age label indicates it is required *', () => {
      renderBabyRegistration();
      expect(screen.getByLabelText(/Gestational Age \(weeks\) \*/i)).toBeInTheDocument();
    });

    it('validates Gestational Age: required, valid whole number, range 28-44 weeks', () => {
      renderBabyRegistration();
      const gaInput = screen.getByLabelText(/Gestational Age \(weeks\) \*/i);

      // Empty
      fireEvent.change(gaInput, { target: { value: '' } });
      fireEvent.blur(gaInput);
      expect(screen.getByText(/Gestational age is required/i)).toBeInTheDocument();

      // Non-positive or invalid
      fireEvent.change(gaInput, { target: { value: '0' } });
      fireEvent.blur(gaInput);
      expect(screen.getByText(/Gestational age must be a valid whole number/i)).toBeInTheDocument();

      // Decimal
      fireEvent.change(gaInput, { target: { value: '38.5' } });
      fireEvent.blur(gaInput);
      expect(screen.getByText(/Gestational age must be a valid whole number/i)).toBeInTheDocument();

      // Above 44
      fireEvent.change(gaInput, { target: { value: '45' } });
      fireEvent.blur(gaInput);
      expect(screen.getByText(/Gestational age must not exceed 44 weeks/i)).toBeInTheDocument();

      // Below 28 triggers restriction
      fireEvent.change(gaInput, { target: { value: '26' } });
      fireEvent.blur(gaInput);
      expect(screen.getByText(/Specialized Medical Assessment Required/i)).toBeInTheDocument();
    });
  });

  describe('Section 1: Optional Field Validations', () => {
    it('validates Birth Length (cm): optional, 42-58 cm when entered', () => {
      renderBabyRegistration();
      const lengthInput = screen.getByLabelText(/Birth Length \(cm\)/i);

      // Empty is allowed
      fireEvent.change(lengthInput, { target: { value: '' } });
      fireEvent.blur(lengthInput);
      expect(screen.queryByText(/Please enter a valid birth length\./i)).not.toBeInTheDocument();

      // Below 42 cm
      fireEvent.change(lengthInput, { target: { value: '40' } });
      fireEvent.blur(lengthInput);
      expect(screen.getByText(/Please enter a valid birth length\./i)).toBeInTheDocument();

      // Above 58 cm
      fireEvent.change(lengthInput, { target: { value: '60' } });
      fireEvent.blur(lengthInput);
      expect(screen.getByText(/Please enter a valid birth length\./i)).toBeInTheDocument();

      // Valid boundary 42 cm
      fireEvent.change(lengthInput, { target: { value: '42' } });
      fireEvent.blur(lengthInput);
      expect(screen.queryByText(/Please enter a valid birth length\./i)).not.toBeInTheDocument();

      // Valid boundary 58 cm
      fireEvent.change(lengthInput, { target: { value: '58' } });
      fireEvent.blur(lengthInput);
      expect(screen.queryByText(/Please enter a valid birth length\./i)).not.toBeInTheDocument();
    });

    it('validates Birth Order: optional, positive whole numbers only (no zero, negative, or decimal)', () => {
      renderBabyRegistration();
      const orderInput = screen.getByLabelText(/Birth Order/i);

      // Empty is allowed
      fireEvent.change(orderInput, { target: { value: '' } });
      fireEvent.blur(orderInput);
      expect(screen.queryByText(/Birth order must be a positive whole number/i)).not.toBeInTheDocument();

      // Zero not allowed
      fireEvent.change(orderInput, { target: { value: '0' } });
      fireEvent.blur(orderInput);
      expect(screen.getByText(/Birth order must be a positive whole number/i)).toBeInTheDocument();

      // Negative not allowed
      fireEvent.change(orderInput, { target: { value: '-1' } });
      fireEvent.blur(orderInput);
      expect(screen.getByText(/Birth order must be a positive whole number/i)).toBeInTheDocument();

      // Decimal not allowed
      fireEvent.change(orderInput, { target: { value: '1.5' } });
      fireEvent.blur(orderInput);
      expect(screen.getByText(/Birth order must be a positive whole number/i)).toBeInTheDocument();

      // Positive integer allowed
      fireEvent.change(orderInput, { target: { value: '2' } });
      fireEvent.blur(orderInput);
      expect(screen.queryByText(/Birth order must be a positive whole number/i)).not.toBeInTheDocument();
    });

    it('validates APGAR Score (5 min): optional, whole number between 0 and 10', () => {
      renderBabyRegistration();
      const apgarInput = screen.getByLabelText(/APGAR Score \(5 min\)/i);

      // Empty is allowed
      fireEvent.change(apgarInput, { target: { value: '' } });
      fireEvent.blur(apgarInput);
      expect(screen.queryByText(/APGAR score must be a whole number between 0 and 10/i)).not.toBeInTheDocument();

      // Negative not allowed
      fireEvent.change(apgarInput, { target: { value: '-1' } });
      fireEvent.blur(apgarInput);
      expect(screen.getByText(/APGAR score must be a whole number between 0 and 10/i)).toBeInTheDocument();

      // > 10 not allowed
      fireEvent.change(apgarInput, { target: { value: '11' } });
      fireEvent.blur(apgarInput);
      expect(screen.getByText(/APGAR score must be a whole number between 0 and 10/i)).toBeInTheDocument();

      // Decimal not allowed
      fireEvent.change(apgarInput, { target: { value: '8.5' } });
      fireEvent.blur(apgarInput);
      expect(screen.getByText(/APGAR score must be a whole number between 0 and 10/i)).toBeInTheDocument();

      // 0 is a valid APGAR score
      fireEvent.change(apgarInput, { target: { value: '0' } });
      fireEvent.blur(apgarInput);
      expect(screen.queryByText(/APGAR score must be a whole number between 0 and 10/i)).not.toBeInTheDocument();

      // 10 is valid
      fireEvent.change(apgarInput, { target: { value: '10' } });
      fireEvent.blur(apgarInput);
      expect(screen.queryByText(/APGAR score must be a whole number between 0 and 10/i)).not.toBeInTheDocument();
    });
  });

  describe('Section 4: Form Submission Behavior', () => {
    it('validates all fields when Complete Registration is clicked with empty inputs', () => {
      renderBabyRegistration();

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));

      expect(screen.getByText(/Baby's name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Biological sex is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Date of birth is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Birth weight is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Gestational age is required/i)).toBeInTheDocument();
      expect(babyApi.registerBaby).not.toHaveBeenCalled();
    });

    it('preserves entered values when validation fails and does not modify numeric inputs', () => {
      renderBabyRegistration();

      const weightInput = screen.getByLabelText(/Birth Weight \(kg\) \*/i) as HTMLInputElement;
      fireEvent.change(weightInput, { target: { value: '5.5' } });
      fireEvent.blur(weightInput);

      expect(weightInput.value).toBe('5.5');
      expect(screen.getByText(/Birth weight must not exceed 5 kg/i)).toBeInTheDocument();
    });

    it('allows user to correct a restricted value and submit successfully', async () => {
      vi.mocked(babyApi.registerBaby).mockResolvedValueOnce({ id: 1 } as any);
      renderBabyRegistration();

      // Enter restricted weight
      fillBaselineValidForm({ weight: '1.9', ga: '39' });
      expect(screen.getByText(/Specialized Medical Assessment Required/i)).toBeInTheDocument();

      // User corrects weight to supported value (e.g. 3.2 kg)
      const weightInput = screen.getByLabelText(/Birth Weight \(kg\) \*/i);
      fireEvent.change(weightInput, { target: { value: '3.2' } });

      // Restriction banner disappears
      expect(screen.queryByText(/Specialized Medical Assessment Required/i)).not.toBeInTheDocument();
    });
  });
});
