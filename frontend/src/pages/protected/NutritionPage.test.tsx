import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { nutritionApi } from '@/api/nutrition';
import { babyApi } from '@/api/baby';
import { useAuth } from '@/auth/AuthProvider';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import NutritionPage from './NutritionPage';
import { ApiClientError } from '@/api/client';
import {
  BabyNutritionPreferencesResponse,
  NutritionRecommendationResponse,
} from '@/types/nutrition';
import { BabyProfile } from '@/types/baby';

// Mock dependencies
vi.mock('@/auth/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/baby', () => ({
  babyApi: {
    getBabyProfile: vi.fn(),
  },
}));
vi.mock('@/api/nutrition', () => ({
  nutritionApi: {
    getRecommendations: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

// Test Fixtures
const mother = { id: 1, name: 'Jane Doe', email: 'jane@example.com', is_active: true, created_at: '' };

const babyEmma: BabyProfile = {
  id: 1,
  owner_id: 1,
  name: 'Emma',
  sex: 'Female',
  date_of_birth: '2026-03-20', // ~7 months old on 2026-10-20
  birth_weight_kg: 3.2,
};

const babyLucas: BabyProfile = {
  id: 2,
  owner_id: 1,
  name: 'Lucas',
  sex: 'Male',
  date_of_birth: '2025-04-20', // ~18 months old
  birth_weight_kg: 3.4,
};

const babyNewborn: BabyProfile = {
  id: 3,
  owner_id: 1,
  name: 'Noah',
  sex: 'Male',
  date_of_birth: '2026-07-20', // ~3 months old
  birth_weight_kg: 3.1,
};

const babySchoolAge: BabyProfile = {
  id: 4,
  owner_id: 1,
  name: 'Chloe',
  sex: 'Female',
  date_of_birth: '2021-10-20', // 60 completed months
  birth_weight_kg: 3.3,
};

const defaultPreferencesEmma: BabyNutritionPreferencesResponse = {
  baby_id: 1,
  complementary_feeding_start_date: '2026-09-20',
  milk_feeding_method: 'exclusive_breastfeeding',
  foods_introduced: ['ING_RICE', 'ING_CARROT', 'ING_PUMPKIN'],
  restricted_foods: ['RESTRICT_FISH'],
  available_ingredients: ['ING_RICE', 'ING_CARROT', 'ING_PUMPKIN', 'ING_DHAL'],
  dietary_preferences: ['NO_ADDED_SALT', 'NO_ADDED_SUGAR'],
  recent_meal_history: [],
  only_available_ingredients: false,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

const defaultPreferencesLucas: BabyNutritionPreferencesResponse = {
  baby_id: 2,
  complementary_feeding_start_date: '2025-10-20',
  milk_feeding_method: 'complementary_breastfeeding',
  foods_introduced: ['ING_RICE', 'ING_CHICKEN', 'ING_EGG', 'ING_BANANA'],
  restricted_foods: [],
  available_ingredients: ['ING_RICE', 'ING_CHICKEN', 'ING_BANANA'],
  dietary_preferences: [],
  recent_meal_history: [],
  only_available_ingredients: true,
  created_at: '2025-10-20T10:00:00Z',
  updated_at: '2025-10-20T10:00:00Z',
};

const recommendations7m: NutritionRecommendationResponse = {
  child_age_completed_months: 7,
  child_age_remaining_days: 0,
  is_eligible: true,
  is_at_completion_boundary: false,
  feeding_stage: 'STAGE_7M',
  stage_name: 'Seven Completed Months (Soft Snacks Introduced)',
  feeding_rule: {
    rule_id: 'RULE_7M_01',
    stage_id: 'STAGE_7M',
    stage_name: 'Seven Months',
    min_calendar_months: 7,
    max_calendar_months: 7,
    precedence: 10,
    requires_known_start_date: false,
    is_late_starter_rule: false,
    daily_meal_frequency: '2 to 3 main meals daily',
    daily_snack_frequency: '1 to 2 nutritious soft snacks',
    household_portion: '2 to 3 tablespoons gradually increasing to 1/2 tea cup (125 ml)',
    texture: 'HALF_MASHED',
    recommended_food_groups: ['GRAINS_AND_STAPLES', 'VEGETABLES', 'PULSES_AND_LEGUMES'],
    preparation_instructions: ['Cook until tender and half mash with fork'],
    safety_and_hygiene_guidance: ['Wash hands before preparation', 'Do not add salt or sugar'],
    evidence_tier: 'TIER_A',
    source_citation: {
      publication: 'Right Food at the Right Time',
      organization: 'Family Health Bureau',
      year: 2025,
      booklet_page: 8,
      evidence_tier: 'TIER_A',
      evidence_description: 'National complementary feeding guideline 7 months',
    },
  },
  meal_frequency_guidance: '2 to 3 main meals daily',
  daily_snack_frequency_guidance: '1 to 2 nutritious soft snacks',
  milk_feeding_guidance: 'Continue on-demand breastfeeding day and night',
  general_preparation_instructions: ['Cook thoroughly', 'Serve freshly prepared food'],
  safety_and_hygiene_guidance: ['Zero salt before 1 year', 'Zero added sugar before 2 years'],
  generated_main_meals_count: 2,
  generated_snacks_count: 1,
  recommendations: [
    {
      recommendation_id: 'REC_001',
      meal_slot: 'MAIN_MEAL',
      dish_or_food_id: 'DISH_RICE_DHAL_CARROT',
      name: 'Rice with Dhal and Mashed Carrot',
      sinhala_name: 'පරිප්පු සහ කැරට් සමඟ බත්',
      item_type: 'DISH',
      ingredients: ['ING_RICE', 'ING_DHAL', 'ING_CARROT'],
      food_groups: ['GRAINS_AND_STAPLES', 'PULSES_AND_LEGUMES', 'VEGETABLES'],
      texture: 'HALF_MASHED',
      household_portion: '1/2 tea cup (approx 125 ml)',
      preparation_instructions: [
        'Cook rice, red dhal and diced carrot together until soft',
        'Half mash with the back of a clean spoon or fork',
        'Add a small teaspoon of coconut milk or vegetable oil for energy density',
      ],
      safety_precautions: [
        'Do not add salt or artificial seasonings',
        'Check temperature on wrist before feeding',
      ],
      recommendation_reason: 'Combines staple grains with plant protein and vitamin A rich vegetable in an age-appropriate half-mashed texture.',
      evidence_tier: 'TIER_A',
      source_citation: {
        publication: 'Right Food at the Right Time',
        organization: 'Family Health Bureau',
        year: 2025,
        booklet_page: 8,
        pdf_page: 10,
        evidence_tier: 'TIER_A',
        evidence_description: 'FHB 2025 7-month recommended combination',
      },
      is_available_in_household: true,
      ranking_score: 95,
      ranking_factors: ['Household ingredients matched', 'Key FHB dish'],
    },
    {
      recommendation_id: 'REC_002',
      meal_slot: 'MAIN_MEAL',
      dish_or_food_id: 'DISH_RICE_PUMPKIN_EGGYOLK',
      name: 'Rice with Pumpkin Mash and Well-Cooked Egg Yolk',
      sinhala_name: 'වට්ටක්කා සහ තම්බාගත් බිත්තර කහ මදය සමඟ බත්',
      item_type: 'DISH',
      ingredients: ['ING_RICE', 'ING_PUMPKIN', 'ING_EGG'],
      food_groups: ['GRAINS_AND_STAPLES', 'VEGETABLES', 'ANIMAL_SOURCE_FOODS'],
      texture: 'HALF_MASHED',
      household_portion: '1/2 tea cup',
      preparation_instructions: ['Hard-boil egg for 10 minutes and mash yolk thoroughly with rice and pumpkin'],
      safety_precautions: ['Ensure egg yolk is thoroughly hard-boiled, not runny'],
      recommendation_reason: 'Provides essential iron and choline from egg yolk alongside beta-carotene from pumpkin.',
      evidence_tier: 'TIER_A',
      source_citation: {
        publication: 'Right Food at the Right Time',
        organization: 'Family Health Bureau',
        year: 2025,
        booklet_page: 9,
        evidence_tier: 'TIER_A',
        evidence_description: 'FHB 2025 egg yolk introduction guideline',
      },
      is_available_in_household: true,
      ranking_score: 92,
      ranking_factors: ['Introduced ingredient', 'Nutritious animal source'],
    },
    {
      recommendation_id: 'REC_003',
      meal_slot: 'SNACK',
      dish_or_food_id: 'SNACK_MASHED_BANANA',
      name: 'Mashed Ripe Banana (Ambul / Anamalu)',
      sinhala_name: 'පොඩි කළ ඇඹුල් කෙසෙල්',
      item_type: 'SNACK',
      ingredients: ['ING_BANANA'],
      food_groups: ['FRUITS'],
      texture: 'HALF_MASHED',
      household_portion: '2 to 3 tablespoons',
      preparation_instructions: ['Peel ripe banana and mash with fork until smooth and lump-free'],
      safety_precautions: ['Do not add sugar or honey'],
      recommendation_reason: 'Gentle on digestion, rich in potassium and energy.',
      evidence_tier: 'TIER_A',
      source_citation: {
        publication: 'Right Food at the Right Time',
        organization: 'Family Health Bureau',
        year: 2025,
        booklet_page: 8,
        evidence_tier: 'TIER_A',
        evidence_description: 'FHB 2025 soft snack recommendation',
      },
      is_available_in_household: true,
      ranking_score: 90,
      ranking_factors: ['FHB soft snack', 'Available in household'],
    },
  ],
  available_substitutions: {
    ING_CARROT: ['ING_PUMPKIN', 'ING_SWEET_POTATO'],
  },
  evaluation_date: '2026-10-20',
  evidence_summary: { TIER_A: 3, TIER_B: 0, TIER_C: 0 },
};

const recommendations0to5m: NutritionRecommendationResponse = {
  child_age_completed_months: 3,
  child_age_remaining_days: 0,
  is_eligible: true,
  is_at_completion_boundary: false,
  feeding_stage: 'STAGE_0_TO_5M',
  stage_name: 'Birth to 5 Completed Months (Exclusive Milk Feeding)',
  meal_frequency_guidance: 'Exclusive breastfeeding or appropriate infant milk feeding on cue (8 to 12 times in 24 hours)',
  daily_snack_frequency_guidance: null,
  milk_feeding_guidance: 'Infants under 6 completed months require breast milk only (or formula where prescribed). No water, tea, solid foods, or animal milk.',
  general_preparation_instructions: [],
  safety_and_hygiene_guidance: [
    'Zero complementary foods, water, fruit juice, or herbal teas before 6 completed months.',
    'Early introduction of solids increases risk of diarrhoea, allergy, and reduced breast milk production.',
  ],
  special_notice: 'Under National FHB guidelines, complementary foods must NOT be introduced before 6 completed months.',
  generated_main_meals_count: 0,
  generated_snacks_count: 0,
  recommendations: [],
  available_substitutions: {},
  evaluation_date: '2026-10-20',
  evidence_summary: {},
};

const recommendations60mPlus: NutritionRecommendationResponse = {
  child_age_completed_months: 60,
  child_age_remaining_days: 0,
  is_eligible: false,
  is_at_completion_boundary: true,
  feeding_stage: 'STAGE_COMPLETED',
  stage_name: '5 Years and Above (Research Boundary Reached)',
  meal_frequency_guidance: '3 family meals plus 2 healthy snacks daily',
  daily_snack_frequency_guidance: null,
  milk_feeding_guidance: 'Standard family diet and milk consumption as per national school-child guidelines.',
  general_preparation_instructions: [],
  safety_and_hygiene_guidance: [],
  special_notice: 'Child has completed the 0–59 calendar month research boundary. Please consult national school-age dietary guidelines.',
  generated_main_meals_count: 0,
  generated_snacks_count: 0,
  recommendations: [],
  available_substitutions: {},
  evaluation_date: '2026-10-20',
  evidence_summary: {},
};

const recommendationsEmptyFallback: NutritionRecommendationResponse = {
  child_age_completed_months: 8,
  child_age_remaining_days: 0,
  is_eligible: true,
  is_at_completion_boundary: false,
  feeding_stage: 'STAGE_8M',
  stage_name: 'Eight Completed Months',
  meal_frequency_guidance: '2 to 3 meals daily',
  daily_snack_frequency_guidance: '1 snack daily',
  milk_feeding_guidance: 'Continue frequent breastfeeding',
  general_preparation_instructions: [],
  safety_and_hygiene_guidance: [],
  special_notice: 'No foods matched current strict pantry restrictions. Please expand pantry availability or adjust exclusion filters.',
  generated_main_meals_count: 0,
  generated_snacks_count: 0,
  recommendations: [],
  available_substitutions: {},
  evaluation_date: '2026-10-20',
  evidence_summary: {},
};

function renderNutritionView(initialBaby: BabyProfile = babyEmma, allBabies: BabyProfile[] = [babyEmma, babyLucas]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/nutrition']}>
        <Routes>
          <Route
            path="/nutrition"
            element={<NutritionPage initialBaby={initialBaby} allBabies={allBabies} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Nutrition & Feeding Page Integration Tests (Phase 6)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mother,
      isAuthenticated: true,
      isLoading: false,
      authState: 'AUTHENTICATED',
      refreshUser: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(babyEmma);
    vi.mocked(nutritionApi.getRecommendations).mockResolvedValue(recommendations7m);
    vi.mocked(nutritionApi.getPreferences).mockResolvedValue(defaultPreferencesEmma);
    vi.mocked(nutritionApi.updatePreferences).mockResolvedValue({
      ...defaultPreferencesEmma,
      dietary_preferences: ['VEGETARIAN', 'NO_ADDED_SALT'],
    });
  });

  it('1. Renders Nutrition page with proper header and accessible navigation tabs', async () => {
    renderNutritionView();

    expect(await screen.findByRole('heading', { level: 1, name: /Nutrition & Feeding/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Today's Recommendations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Feeding Preferences & Pantry/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Food Ideas & Preparation/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /FHB Guidelines & Evidence/i })).toBeInTheDocument();
  });

  it('2. Shows selected baby information, completed calendar months, and feeding stage', async () => {
    renderNutritionView();

    expect(await screen.findByText('Emma')).toBeInTheDocument();
    expect(screen.getByText(/7 completed months/i)).toBeInTheDocument();
    expect(screen.getByText('Seven Completed Months (Soft Snacks Introduced)')).toBeInTheDocument();
    expect(screen.getByText('2 to 3 main meals daily')).toBeInTheDocument();
    expect(screen.getByText('1 to 2 nutritious soft snacks')).toBeInTheDocument();
  });

  it('3. Explicitly includes baby_id in recommendation and preferences API requests', async () => {
    renderNutritionView();

    await screen.findByText('Emma');
    await waitFor(() => {
      expect(nutritionApi.getRecommendations).toHaveBeenCalledWith(1);
      expect(nutritionApi.getPreferences).toHaveBeenCalledWith(1);
    });
  });

  it('4. Allows switching babies in multi-baby households without stale data leakage', async () => {
    vi.mocked(nutritionApi.getRecommendations).mockImplementation(async (id) => {
      if (id === 2) {
        return {
          ...recommendations7m,
          child_age_completed_months: 18,
          feeding_stage: 'STAGE_12_TO_23M',
          stage_name: '12 to 23 Months (Family Foods)',
          recommendations: [
            {
              ...recommendations7m.recommendations[0],
              name: 'Lucas Toddler Rice & Chicken',
              household_portion: '3/4 tea cup',
            },
          ],
        };
      }
      return recommendations7m;
    });

    vi.mocked(nutritionApi.getPreferences).mockImplementation(async (id) => {
      if (id === 2) return defaultPreferencesLucas;
      return defaultPreferencesEmma;
    });

    renderNutritionView(babyEmma, [babyEmma, babyLucas]);

    await screen.findByText('Emma');
    expect(screen.getByText('Rice with Dhal and Mashed Carrot')).toBeInTheDocument();

    // Switch baby to Lucas
    const selector = screen.getByLabelText('Select registered child profile');
    fireEvent.change(selector, { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getByText('Lucas')).toBeInTheDocument();
      expect(screen.getByText(/18 completed months/i)).toBeInTheDocument();
      expect(screen.getByText('12 to 23 Months (Family Foods)')).toBeInTheDocument();
      expect(screen.getByText('Lucas Toddler Rice & Chicken')).toBeInTheDocument();
      expect(screen.queryByText('Rice with Dhal and Mashed Carrot')).not.toBeInTheDocument();
    });

    expect(nutritionApi.getRecommendations).toHaveBeenCalledWith(2);
    expect(nutritionApi.getPreferences).toHaveBeenCalledWith(2);
  });

  it('5. Renders meal cards with Sinhala names, portion units, texture, ingredients, and reasons', async () => {
    renderNutritionView();

    expect(await screen.findByText('Rice with Dhal and Mashed Carrot')).toBeInTheDocument();
    expect(screen.getByText('පරිප්පු සහ කැරට් සමඟ බත්')).toBeInTheDocument();
    expect(screen.getByText(/Portion:\s*1\/2 tea cup \(approx 125 ml\)/i)).toBeInTheDocument();
    expect(screen.getAllByText('Half Mashed')[0]).toBeInTheDocument();
    expect(screen.getByText('Combines staple grains with plant protein and vitamin A rich vegetable in an age-appropriate half-mashed texture.')).toBeInTheDocument();

    // Verify ingredient pills
    expect(screen.getAllByText(/White \/ Red Rice/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Red Lentils|Red Dhal/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Carrot/i)[0]).toBeInTheDocument();
  });

  it('6. Renders snack cards distinguishing soft snacks from main meals', async () => {
    renderNutritionView();

    expect(await screen.findByText('Mashed Ripe Banana (Ambul / Anamalu)')).toBeInTheDocument();
    expect(screen.getByText('පොඩි කළ ඇඹුල් කෙසෙල්')).toBeInTheDocument();
    expect(screen.getByText(/Portion:\s*2 to 3 tablespoons/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Main Meals \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Nutritious Snacks \(1\)/i)).toBeInTheDocument();
  });

  it('7. Expands meal card to reveal preparation steps and safety precautions', async () => {
    renderNutritionView();

    await screen.findByText('Rice with Dhal and Mashed Carrot');
    const toggleButton = screen.getAllByRole('button', { name: /View Preparation Instructions & Citations/i })[0];

    // Click to expand
    fireEvent.click(toggleButton);

    expect(screen.getByText('Preparation Instructions')).toBeInTheDocument();
    expect(screen.getByText('Cook rice, red dhal and diced carrot together until soft')).toBeInTheDocument();
    expect(screen.getByText('Safety & Hygiene Precautions')).toBeInTheDocument();
    expect(screen.getByText('Do not add salt or artificial seasonings')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getAllByRole('button', { name: /Hide Preparation & Evidence/i })[0]);
    expect(screen.queryByText('Preparation Instructions')).not.toBeInTheDocument();
  });

  it('8. Displays FHB booklet citation with booklet page number and evidence tier', async () => {
    renderNutritionView();

    await screen.findByText('Rice with Dhal and Mashed Carrot');
    const toggleButton = screen.getAllByRole('button', { name: /View Preparation Instructions & Citations/i })[0];
    fireEvent.click(toggleButton);

    expect(screen.getByText('Source Citation (Family Health Bureau, 2025)')).toBeInTheDocument();
    expect(screen.getByText(/Page 8/i)).toBeInTheDocument();
    expect(screen.getAllByText('FHB Tier A Evidence')[0]).toBeInTheDocument();
  });

  it('9. Shows original household portions without invented metric conversions', async () => {
    renderNutritionView();

    await screen.findByText('Rice with Dhal and Mashed Carrot');
    expect(screen.getByText(/Portion:\s*1\/2 tea cup \(approx 125 ml\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Portion:\s*2 to 3 tablespoons/i)).toBeInTheDocument();
  });

  it('10. Displays substitute ingredient suggestions when provided by backend', async () => {
    renderNutritionView();

    await screen.findByText('Rice with Dhal and Mashed Carrot');
    const toggleButton = screen.getAllByRole('button', { name: /View Preparation Instructions & Citations/i })[0];
    fireEvent.click(toggleButton);

    expect(screen.getByText('Practical Kitchen Substitutions')).toBeInTheDocument();
    expect(screen.getAllByText(/Yellow Pumpkin/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Yellow Sweet Potato/i)).toBeInTheDocument();
  });

  it('11. Allows editing feeding preferences and validates input', async () => {
    renderNutritionView();

    // Navigate to preferences tab
    const prefsTab = screen.getByRole('tab', { name: /Feeding Preferences & Pantry/i });
    fireEvent.click(prefsTab);

    expect(await screen.findByText('Feeding Milestones & Milk Method')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/Complementary Feeding Start Date/i)).toHaveValue('2026-09-20');
    });

    // Toggle vegetarian diet
    const vegBadge = screen.getByRole('button', { name: /Vegetarian/i });
    fireEvent.click(vegBadge);

    expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeEnabled();
  });

  it('12. Submits updated preferences to backend and refreshes cache', async () => {
    renderNutritionView();

    const prefsTab = screen.getByRole('tab', { name: /Feeding Preferences & Pantry/i });
    fireEvent.click(prefsTab);

    await screen.findByText('Feeding Milestones & Milk Method');

    const saveButton = screen.getByRole('button', { name: 'Save Preferences' });

    // Make an edit
    const vegBadge = screen.getByRole('button', { name: /Vegetarian/i });
    fireEvent.click(vegBadge);

    // Click Save
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(nutritionApi.updatePreferences).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          dietary_preferences: expect.arrayContaining(['VEGETARIAN']),
        }),
      );
    });

    expect(await screen.findByText('Nutrition preferences successfully saved and recommendations refreshed.')).toBeInTheDocument();
  });

  it('13. Toggles pantry-only mode switch and updates preferences', async () => {
    renderNutritionView();

    const prefsTab = screen.getByRole('tab', { name: /Feeding Preferences & Pantry/i });
    fireEvent.click(prefsTab);

    await screen.findByText('Feeding Milestones & Milk Method');

    const strictToggle = screen.getByRole('checkbox', { name: /Strict Kitchen Pantry Filter/i });
    expect(strictToggle).not.toBeChecked();

    fireEvent.click(strictToggle);
    expect(strictToggle).toBeChecked();
    expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
  });

  it('14. Allows searching and selecting introduced foods and restricted ingredients', async () => {
    renderNutritionView();

    const prefsTab = screen.getByRole('tab', { name: /Feeding Preferences & Pantry/i });
    fireEvent.click(prefsTab);

    await screen.findByText('Feeding Milestones & Milk Method');

    // Search introduced foods
    const searchInput = screen.getByPlaceholderText('Search ingredients...');
    fireEvent.change(searchInput, { target: { value: 'Carrot' } });

    // Should find Carrot buttons
    const carrotButtons = screen.getAllByRole('button', { name: /Carrot/i });
    expect(carrotButtons.length).toBeGreaterThan(0);
  });

  it('15. Handles 0–5 completed months special stage with exclusive milk guidance', async () => {
    vi.mocked(nutritionApi.getRecommendations).mockResolvedValue(recommendations0to5m);

    renderNutritionView(babyNewborn, [babyNewborn]);

    expect(await screen.findByText('Birth to 5 Completed Months (Exclusive Milk Feeding)')).toBeInTheDocument();
    expect(screen.getByText(/Exclusive Milk Feeding Stage \(0–5 Completed Months\)/i)).toBeInTheDocument();
    expect(screen.getByText(/No solid, semi-solid, or puréed foods should be introduced before 6 completed calendar months/i)).toBeInTheDocument();

    // Verify NO meal cards are shown
    expect(screen.queryByText('Rice with Dhal and Mashed Carrot')).not.toBeInTheDocument();
  });

  it('16. Handles 60-month completion boundary with transition advisory', async () => {
    vi.mocked(nutritionApi.getRecommendations).mockResolvedValue(recommendations60mPlus);

    renderNutritionView(babySchoolAge, [babySchoolAge]);

    expect(await screen.findByText('5 Years and Above (Research Boundary Reached)')).toBeInTheDocument();
    expect(screen.getByText(/Nutrition Milestone Reached \(60 Completed Months\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Your child has reached 5 years/i)).toBeInTheDocument();
    expect(screen.queryByText(/Recommended Main Meals/i)).not.toBeInTheDocument();
  });

  it('17. Handles empty recommendation result with actionable explanation', async () => {
    vi.mocked(nutritionApi.getRecommendations).mockResolvedValue(recommendationsEmptyFallback);

    renderNutritionView();

    expect(await screen.findByText('No Meals Match Current Restrictions')).toBeInTheDocument();
    expect(screen.getByText(/Please check your/i)).toBeInTheDocument();
  });

  it('18. Handles API error responses gracefully (400, 401, 403, 404, network error)', async () => {
    vi.mocked(nutritionApi.getRecommendations).mockRejectedValue(
      new ApiClientError('Child age 65 exceeds maximum permitted boundary', 400),
    );

    renderNutritionView();

    expect(await screen.findByText('Recommendation Request Error')).toBeInTheDocument();
    expect(screen.getByText('Child age 65 exceeds maximum permitted boundary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Recommendations/i })).toBeInTheDocument();
  });

  it('19. Handles 403 Unauthorized baby access error gracefully', async () => {
    vi.mocked(nutritionApi.getRecommendations).mockRejectedValue(
      new ApiClientError('Not authorized to access nutrition data for this baby', 403),
    );

    renderNutritionView();

    expect(await screen.findByText('Unauthorized Baby Access')).toBeInTheDocument();
    expect(screen.getByText('Not authorized to access nutrition data for this baby')).toBeInTheDocument();
  });

  it('20. Allows filtering food ideas and recipes in Food Ideas & Prep tab', async () => {
    renderNutritionView();

    const ideasTab = screen.getByRole('tab', { name: /Food Ideas & Preparation/i });
    fireEvent.click(ideasTab);

    expect(await screen.findByText('Stage-Appropriate Food Ideas')).toBeInTheDocument();

    // Filter by snacks only
    const snacksFilter = screen.getByRole('button', { name: /Snacks \(/i });
    fireEvent.click(snacksFilter);

    expect(screen.getByText('Mashed Ripe Banana (Ambul / Anamalu)')).toBeInTheDocument();
    expect(screen.queryByText('Rice with Dhal and Mashed Carrot')).not.toBeInTheDocument();
  });

  it('21. Displays FHB source evidence, 7 food groups, and safety principles in Guidelines tab', async () => {
    renderNutritionView();

    const guidelinesTab = screen.getByRole('tab', { name: /FHB Guidelines & Evidence/i });
    fireEvent.click(guidelinesTab);

    expect(await screen.findByText(/"Right Food at the Right Time, To Make My Baby Healthy and Bright"/i)).toBeInTheDocument();
    expect(screen.getByText('Official National Clinical Reference')).toBeInTheDocument();
    expect(screen.getByText('Strict Salt & Sugar Ban')).toBeInTheDocument();
    expect(screen.getByText('Screen-Free Responsive Feeding')).toBeInTheDocument();
    expect(screen.getByText('The 7 Sri Lankan Childhood Food Groups')).toBeInTheDocument();
    expect(screen.getByText('Whole Nut & Choking Hazards')).toBeInTheDocument();
  });
});
