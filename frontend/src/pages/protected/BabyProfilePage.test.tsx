import { act, cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { babyApi } from '@/api/baby';
import type { BabyProfile } from '@/types/baby';
import BabyProfilePage from './BabyProfilePage';

vi.mock('@/api/baby', () => ({ babyApi: { getBabyProfile: vi.fn(), updateBabyProfile: vi.fn() } }));

const baby: BabyProfile = {
  id: 42, owner_id: 7, name: 'Amaya Perera', sex: 'Female', date_of_birth: '2025-07-21',
  birth_weight_kg: 3.01, birth_length_cm: 52.6, gestational_age_weeks: 39,
  birth_order: 2, delivery_type: 'Cesarean Section (C-Section)', apgar_score_5min: 9,
};

function renderProfile(cached?: BabyProfile) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } } });
  if (cached) client.setQueryData(['baby.profile'], cached);
  return render(<QueryClientProvider client={client}><BabyProfilePage /></QueryClientProvider>);
}

function detail(label: string) {
  return screen.getByText(label, { selector: 'dt' }).parentElement!.querySelector('dd')!;
}

describe('Baby Profile', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 10));
    vi.clearAllMocks();
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(baby);
  });

  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('presents the existing API profile with readable labels and units', async () => {
    renderProfile();
    await screen.findByRole('heading', { name: baby.name });
    expect(screen.getByRole('heading', { level: 1, name: 'Baby Profile' })).toBeInTheDocument();
    expect(screen.getByText("Your little one's information, all in one place.")).toBeInTheDocument();
    expect(screen.getByText(baby.sex)).toBeInTheDocument();
    expect(detail('Current Age')).toHaveTextContent('1 year, 3 months old');
    expect(detail('Date of Birth')).toHaveTextContent('21 Jul 2025');
    expect(detail('Birth Weight')).toHaveTextContent('3.01 kg');
    expect(detail('Birth Length')).toHaveTextContent('52.6 cm');
    expect(detail('Gestational Age')).toHaveTextContent('39 weeks');
    const additional = within(screen.getByRole('region', { name: 'Additional Birth Details' }));
    expect(additional.getByText('2')).toBeInTheDocument();
    expect(additional.getByText('9')).toBeInTheDocument();
    expect(additional.getByText(baby.delivery_type!)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).not.toBeInTheDocument();
    expect(screen.queryByText("Editing isn't available yet.")).not.toBeInTheDocument();
    expect(babyApi.getBabyProfile).toHaveBeenCalledOnce();
    expect(babyApi.updateBabyProfile).not.toHaveBeenCalled();
    expect(screen.queryByText(/Stage 16C|ML inference|UX display only|Birth Parameters|read-only/)).not.toBeInTheDocument();
  });

  it.each([
    ['2026-10-21', '0 days old'],
    ['2026-10-20', '1 day old'],
    ['2026-10-01', '20 days old'],
    ['2026-09-21', '1 month old'],
    ['2026-08-21', '2 months old'],
    ['2026-02-21', '8 months old'],
    ['2025-10-22', '11 months old'],
    ['2025-10-21', '1 year old'],
    ['2025-09-21', '1 year, 1 month old'],
    ['2024-04-21', '2 years, 6 months old'],
    ['2021-10-21', '5 years old'],
    ['2026-10-22', 'Not provided'],
    ['2026-02-30', 'Not provided'],
    ['invalid-date', 'Not provided'],
    ['', 'Not provided'],
  ])('calculates age for %s using calendar dates', (date_of_birth, expected) => {
    renderProfile({ ...baby, date_of_birth });
    expect(detail('Current Age').textContent).toBe(expected);
  });

  it.each([
    [new Date(2026, 1, 28, 12), '2026-01-31', '1 month old'],
    [new Date(2025, 1, 28, 12), '2024-02-29', '1 year old'],
    [new Date(2026, 2, 1, 0, 1), '2026-01-31', '1 month old'],
  ])('handles short months and leap-day birthdays at %s', (today, date_of_birth, expected) => {
    vi.setSystemTime(today);
    renderProfile({ ...baby, date_of_birth });
    expect(detail('Current Age').textContent).toBe(expected);
  });

  it('updates age across midnight without requesting or changing profile data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 59));
    renderProfile(baby);
    expect(detail('Current Age')).toHaveTextContent('1 year, 2 months old');
    act(() => { vi.advanceTimersByTime(1100); });
    expect(detail('Current Age')).toHaveTextContent('1 year, 3 months old');
    expect(detail('Date of Birth')).toHaveTextContent('21 Jul 2025');
    expect(babyApi.getBabyProfile).not.toHaveBeenCalled();
    expect(babyApi.updateBabyProfile).not.toHaveBeenCalled();
  });

  it('uses Not provided for missing, blank or non-finite optional values', () => {
    renderProfile({ ...baby, birth_length_cm: null, gestational_age_weeks: undefined, birth_order: NaN, delivery_type: '  ', apgar_score_5min: Infinity });
    for (const label of ['Birth Length', 'Gestational Age', 'Birth Order', 'Delivery Type', 'APGAR Score (5 min)']) {
      expect(detail(label).textContent).toBe('Not provided');
    }
    expect(screen.queryByText(/null|undefined|NaN|Infinity/)).not.toBeInTheDocument();
  });

  it('preserves an APGAR score of zero and full long profile text', () => {
    const name = 'Amaya'.repeat(20);
    const delivery = 'Assisted Vaginal Delivery (forceps or vacuum)';
    renderProfile({ ...baby, name, delivery_type: delivery, apgar_score_5min: 0 });
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(detail('Delivery Type').textContent).toBe(delivery);
    expect(detail('APGAR Score (5 min)').textContent).toBe('0');
  });

  it('announces loading without displaying invented profile values', () => {
    vi.mocked(babyApi.getBabyProfile).mockImplementation(() => new Promise(() => {}));
    renderProfile();
    expect(screen.getByRole('status')).toHaveTextContent("Loading your baby's profile");
    expect(screen.queryByText('Current Age')).not.toBeInTheDocument();
  });

  it.each([null, new Error('Unavailable')])('handles an unavailable profile (%s)', async result => {
    if (result instanceof Error) vi.mocked(babyApi.getBabyProfile).mockRejectedValue(result);
    else vi.mocked(babyApi.getBabyProfile).mockResolvedValue(null as unknown as BabyProfile);
    renderProfile();
    await screen.findByText("We couldn't load your baby's profile.");
    expect(screen.queryByText('Birth Information')).not.toBeInTheDocument();
  });
});
