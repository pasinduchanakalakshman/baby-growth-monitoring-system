import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { nutritionApi } from '@/api/nutrition';
import { babyApi } from '@/api/baby';
import { useAuth } from '@/auth/AuthProvider';
import NutritionPage from '@/pages/protected/NutritionPage';
import {
  DailyMealPlanResponse,
  WeeklyMealPlanResponse,
  MealRecommendationItem,
  PlannedMealSlot,
  WeeklyGroceryItem,
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
    getDailyPlan: vi.fn(),
    getWeeklyPlan: vi.fn(),
    validateSubstitute: vi.fn(),
  },
}));

// Test Fixtures
const mother = { id: 1, name: 'Jane Doe', email: 'jane@example.com', is_active: true, created_at: '' };

const babyEmma: BabyProfile = {
  id: 1,
  owner_id: 1,
  name: 'Emma',
  sex: 'Female',
  date_of_birth: '2026-03-20', // ~7 months old
  birth_weight_kg: 3.2,
};

const babyNewborn: BabyProfile = {
  id: 3,
  owner_id: 1,
  name: 'Noah',
  sex: 'Male',
  date_of_birth: '2026-08-20', // ~2 months old
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

const mealItemRiceFish: MealRecommendationItem = {
  recommendation_id: 'REC_DISH_COARSE_MASH_7M_FISH',
  meal_slot: 'MAIN_MEAL',
  dish_or_food_id: 'DISH_COARSE_MASH_7M_FISH',
  name: 'Coarsely Mashed Rice with Sea Fish, Dhal & Sarana',
  sinhala_name: 'මාළු, පරිප්පු, සාරණ සමඟ කැකුළු බත්',
  item_type: 'DISH',
  ingredients: ['ING_RICE_WHITE', 'ING_FISH_SEA', 'ING_DHAL', 'ING_SARANA', 'ING_COCONUT_MILK'],
  food_groups: ['GRAINS_AND_STAPLES', 'ANIMAL_SOURCE_FOODS', 'PULSES_AND_LEGUMES', 'VEGETABLES'],
  texture: 'COARSELY_MASHED',
  household_portion: '1/2 tea cup at a time, 2 to 3 times a day + 2 to 3 teaspoons fruit',
  preparation_instructions: [
    'Cook white rice and dhal soft with thick coconut milk.',
    'Steam sea fish and debone meticulously.',
    'Cook sarana leaves until tender, chop fine.',
    'Coarsely mash all components together with a clean fork or spoon.',
  ],
  safety_precautions: [
    'Debone fish carefully.',
    'No salt or sugar.',
  ],
  recommendation_reason: 'Rich in animal protein, bioavailable iron, and essential fatty acids.',
  evidence_tier: 'TIER_A',
  source_citation: {
    source_id: 'FHB_2025_CF',
    booklet_title: 'Right Food at the Right Time, To Make My Baby Healthy and Bright',
    section: 'Section 4.3',
    page_or_figure: 'Page 9',
    evidence_tier: 'TIER_A',
  },
  is_available_in_household: true,
  ranking_score: 95,
  ranking_factors: ['Age matched', 'Pantry available'],
};

const mealItemVegetarianDuo: MealRecommendationItem = {
  recommendation_id: 'REC_DISH_VEGETARIAN_PULSE_DUO_MEAL',
  meal_slot: 'MAIN_MEAL',
  dish_or_food_id: 'DISH_VEGETARIAN_PULSE_DUO_MEAL',
  name: 'High-Protein Vegetarian Meal: Rice with Dhal, Chickpeas & Pumpkin',
  sinhala_name: 'පරිප්පු, කඩල සහ වට්ටක්කා සමඟ බත්',
  item_type: 'DISH',
  ingredients: ['ING_RICE_WHITE', 'ING_DHAL', 'ING_CHICKPEAS', 'ING_PUMPKIN', 'ING_COCONUT_MILK'],
  food_groups: ['GRAINS_AND_STAPLES', 'PULSES_AND_LEGUMES', 'VEGETABLES'],
  texture: 'COARSELY_MASHED',
  household_portion: '1/2 to 3/4 tea cup according to age stage',
  preparation_instructions: [
    'Boil dhal and soaked chickpeas until very soft.',
    'Cook pumpkin tender with thick coconut milk.',
    'Combine with soft rice and mash coarsely.',
  ],
  safety_precautions: [
    'Ensure chickpeas are mashed thoroughly to prevent choking.',
    'No salt before 1 year.',
  ],
  recommendation_reason: 'Nutritious plant-protein meal combining lentils, chickpeas, and pumpkin in a coarsely mashed texture.',
  evidence_tier: 'TIER_B',
  source_citation: {
    source_id: 'FHB_2025_CF',
    booklet_title: 'Right Food at the Right Time, To Make My Baby Healthy and Bright',
    section: 'Section 4.3',
    page_or_figure: 'Page 9',
    evidence_tier: 'TIER_B',
  },
  is_available_in_household: false,
  ranking_score: 88,
  ranking_factors: ['Age matched'],
};

const snackItemScrapedBanana: MealRecommendationItem = {
  recommendation_id: 'REC_SNACK_SCRAPED_BANANA_7M',
  meal_slot: 'MID_MORNING_SNACK',
  dish_or_food_id: 'SNACK_SCRAPED_BANANA_7M',
  name: 'Fresh Scraped Ripe Banana',
  sinhala_name: 'ගාගත් ඉදුණු කෙසෙල්',
  item_type: 'SNACK',
  ingredients: ['ING_BANANA'],
  food_groups: ['FRUITS'],
  texture: 'COARSELY_MASHED',
  household_portion: 'About 4 teaspoons freshly scraped fruit (FHB verbatim: about 4 teaspoons as tolerated)',
  preparation_instructions: [
    'Peel a fresh ripe banana.',
    'Scrape thin, soft shavings along the fruit with a clean spoon.',
    'Feed immediately with a spoon between main meals.',
  ],
  safety_precautions: [
    'Ensure banana is thoroughly ripe and soft.',
    'Feed with spoon; do not give whole pieces before finger-food readiness.',
  ],
  recommendation_reason: '7 months + 1 week fresh scraped fruit snack between meals.',
  evidence_tier: 'TIER_A',
  source_citation: {
    source_id: 'FHB_2025_CF',
    booklet_title: 'Right Food at the Right Time, To Make My Baby Healthy and Bright',
    section: 'Section 4.5',
    page_or_figure: 'Page 10',
    evidence_tier: 'TIER_A',
  },
  is_available_in_household: false,
  ranking_score: 92,
  ranking_factors: ['Fresh fruit', 'Age matched'],
};

const mockGroceryChecklist: WeeklyGroceryItem[] = [
  {
    ingredient_id: 'ING_RICE_WHITE',
    name: 'White Raw Rice / Samba',
    sinhala_name: 'සුදු කැකුළු / සම්බා',
    food_group: 'GRAINS_AND_STAPLES',
    is_available_in_household: true,
    days_used: ['2026-10-21', '2026-10-22'],
    meal_names: ['Coarsely Mashed Rice with Sea Fish, Dhal & Sarana'],
    total_meal_appearances: 2,
  },
  {
    ingredient_id: 'ING_FISH_SEA',
    name: 'Sea Fish',
    sinhala_name: 'මාළු',
    food_group: 'ANIMAL_SOURCE_FOODS',
    is_available_in_household: true,
    days_used: ['2026-10-21'],
    meal_names: ['Coarsely Mashed Rice with Sea Fish, Dhal & Sarana'],
    total_meal_appearances: 1,
  },
  {
    ingredient_id: 'ING_DHAL',
    name: 'Red Lentils (Dhal)',
    sinhala_name: 'පරිප්පු',
    food_group: 'PULSES_AND_LEGUMES',
    is_available_in_household: false,
    days_used: ['2026-10-21'],
    meal_names: ['High-Protein Vegetarian Meal: Rice with Dhal, Chickpeas & Pumpkin'],
    total_meal_appearances: 1,
  },
  {
    ingredient_id: 'ING_BANANA',
    name: 'Fresh Banana',
    sinhala_name: 'කෙසෙල්',
    food_group: 'FRUITS',
    is_available_in_household: false,
    days_used: ['2026-10-21'],
    meal_names: ['Fresh Scraped Ripe Banana'],
    total_meal_appearances: 1,
  },
];

const mockDailyPlanEmma: DailyMealPlanResponse = {
  baby_id: 1,
  plan_date: '2026-10-21',
  day_of_week: 'Wednesday',
  child_age_completed_months: 7,
  child_age_remaining_days: 1,
  is_eligible: true,
  is_under_six_months: false,
  is_at_completion_boundary: false,
  feeding_stage: 'STAGE_7_TO_8M',
  stage_name: '7 Months (Thick Puree Transition)',
  meal_frequency_guidance: '2 main meals per day',
  daily_snack_frequency_guidance: '1 nutritious snack between meals',
  milk_feeding_guidance: 'Continue frequent on-demand breastfeeding.',
  planned_meals: [
    {
      slot_number: 1,
      slot_label: 'Main Meal 1 (Mid-Morning)',
      slot_type: 'MAIN_MEAL',
      meal_item: mealItemRiceFish,
      is_unfilled: false,
      unfilled_reason: null,
      eligible_substitutes: ['DISH_VEGETARIAN_PULSE_DUO_MEAL'],
    },
    {
      slot_number: 2,
      slot_label: 'Main Meal 2 (Late Afternoon)',
      slot_type: 'MAIN_MEAL',
      meal_item: mealItemVegetarianDuo,
      is_unfilled: false,
      unfilled_reason: null,
      eligible_substitutes: [],
    },
  ],
  planned_snacks: [
    {
      slot_number: 1,
      slot_label: 'Nutritious Snack (Between Meals)',
      slot_type: 'MID_MORNING_SNACK',
      meal_item: snackItemScrapedBanana,
      is_unfilled: false,
      unfilled_reason: null,
      eligible_substitutes: [],
    },
  ],
  general_preparation_instructions: [
    'Cook food thoroughly until soft enough to mash with a fork.',
    'Do not add salt, sugar, honey, or artificial flavorings.',
  ],
  safety_and_hygiene_guidance: [
    'Wash hands thoroughly before food preparation and feeding.',
    'Test temperature on inner wrist before offering to baby.',
  ],
  special_notice: null,
  evidence_summary: { TIER_A: 2, TIER_B: 1 },
  source_citation: {
    source_id: 'FHB_2025_CF',
    booklet_title: 'Right Food at the Right Time, To Make My Baby Healthy and Bright',
    section: 'Section 4.3',
    page_or_figure: 'Page 9',
    evidence_tier: 'TIER_A',
  },
};

const mockWeeklyPlanEmma: WeeklyMealPlanResponse = {
  baby_id: 1,
  start_date: '2026-10-21',
  end_date: '2026-10-27',
  days: [
    mockDailyPlanEmma,
    { ...mockDailyPlanEmma, plan_date: '2026-10-22', day_of_week: 'Thursday', child_age_remaining_days: 2 },
    { ...mockDailyPlanEmma, plan_date: '2026-10-23', day_of_week: 'Friday', child_age_remaining_days: 3 },
    { ...mockDailyPlanEmma, plan_date: '2026-10-24', day_of_week: 'Saturday', child_age_remaining_days: 4 },
    { ...mockDailyPlanEmma, plan_date: '2026-10-25', day_of_week: 'Sunday', child_age_remaining_days: 5 },
    { ...mockDailyPlanEmma, plan_date: '2026-10-26', day_of_week: 'Monday', child_age_remaining_days: 6 },
    { ...mockDailyPlanEmma, plan_date: '2026-10-27', day_of_week: 'Tuesday', child_age_remaining_days: 7 },
  ],
  weekly_grocery_checklist: mockGroceryChecklist,
  stage_transitions: ['Child advances from Day 6 to Day 7 of complementary feeding.'],
  variety_notes: ['Varied dishes rotated across consecutive main meals.'],
  special_notices: [],
  source_attribution: "Family Health Bureau, Ministry of Health, Sri Lanka (2025). 'Right Food at the Right Time, To Make My Baby Healthy and Bright'",
};

const mockDailyPlanNewborn: DailyMealPlanResponse = {
  baby_id: 3,
  plan_date: '2026-10-21',
  day_of_week: 'Wednesday',
  child_age_completed_months: 2,
  child_age_remaining_days: 1,
  is_eligible: true,
  is_under_six_months: true,
  is_at_completion_boundary: false,
  feeding_stage: 'STAGE_0_TO_6M',
  stage_name: '0–5 Completed Months (Exclusive Milk Feeding)',
  meal_frequency_guidance: 'Exclusive breastfeeding on demand (minimum 8–12 times per 24 hours)',
  daily_snack_frequency_guidance: null,
  milk_feeding_guidance: 'FHB guidance strongly recommends exclusive breastfeeding. Do not introduce complementary foods, water, or other liquids before 6 completed months.',
  planned_meals: [],
  planned_snacks: [],
  general_preparation_instructions: [],
  safety_and_hygiene_guidance: ['Maintain exclusive breastfeeding.'],
  special_notice: null,
  evidence_summary: {},
  source_citation: null,
};

const mockDailyPlanSchoolAge: DailyMealPlanResponse = {
  baby_id: 4,
  plan_date: '2026-10-21',
  day_of_week: 'Wednesday',
  child_age_completed_months: 60,
  child_age_remaining_days: 0,
  is_eligible: false,
  is_under_six_months: false,
  is_at_completion_boundary: true,
  feeding_stage: 'STAGE_COMPLETED',
  stage_name: '60 Months Boundary Reached',
  meal_frequency_guidance: 'School-age family meals and healthy dietary guidelines',
  daily_snack_frequency_guidance: null,
  milk_feeding_guidance: 'Family dietary guidelines apply.',
  planned_meals: [],
  planned_snacks: [],
  general_preparation_instructions: [],
  safety_and_hygiene_guidance: [],
  special_notice: 'Your child has completed 60 calendar months (5 years). The early childhood monitoring boundary is complete.',
  evidence_summary: {},
  source_citation: null,
};

function renderNutritionPage(initialBaby: BabyProfile = babyEmma, allBabies: BabyProfile[] = [babyEmma]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
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
    </QueryClientProvider>
  );
}

describe('Phase 7 Nutrition Planner Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: mother,
      isAuthenticated: true,
      isLoading: false,
    });
    (babyApi.getBabyProfile as any).mockResolvedValue(babyEmma);
    (nutritionApi.getPreferences as any).mockResolvedValue({
      baby_id: 1,
      complementary_feeding_start_date: '2026-09-20',
      milk_feeding_method: 'exclusive_breastfeeding',
      foods_introduced: ['ING_RICE_WHITE', 'ING_FISH_SEA', 'ING_DHAL'],
      restricted_foods: [],
      available_ingredients: ['ING_RICE_WHITE', 'ING_FISH_SEA'],
      dietary_preferences: [],
      recent_meal_history: [],
      only_available_ingredients: false,
      created_at: '',
      updated_at: '',
    });
    (nutritionApi.getRecommendations as any).mockResolvedValue({
      baby_id: 1,
      child_age_completed_months: 7,
      child_age_remaining_days: 1,
      stage_name: '7 Months',
      recommendations: [],
      available_substitutions: {},
      fhb_evidence_citations: [],
      safety_alerts: [],
    });
    (nutritionApi.getDailyPlan as any).mockResolvedValue(mockDailyPlanEmma);
    (nutritionApi.getWeeklyPlan as any).mockResolvedValue(mockWeeklyPlanEmma);
  });

  it('1. Displays Daily Planner and 7-Day Weekly Plan tabs in the navigation bar', async () => {
    renderNutritionPage();

    expect(screen.getByRole('tab', { name: /Daily Planner/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /7-Day Weekly Plan/i })).toBeInTheDocument();
  });

  it('2. Switches to Daily Planner tab and renders date navigation bar', async () => {
    renderNutritionPage();

    const dailyTab = screen.getByRole('tab', { name: /Daily Planner/i });
    fireEvent.click(dailyTab);

    await waitFor(() => {
      expect(screen.getByText(/Planned Calendar Date/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Today/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    });
  });

  it('3. Renders daily meal slots with accurate FHB portion, texture, and Tier A labels', async () => {
    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /Daily Planner/i }));

    await waitFor(() => {
      expect(screen.getByText(/Coarsely Mashed Rice with Sea Fish, Dhal & Sarana/i)).toBeInTheDocument();
      expect(screen.getByText(/මාළු, පරිප්පු, සාරණ සමඟ කැකුළු බත්/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Tier A/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Main Meal 1 \(Mid-Morning\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Main Meal 2 \(Late Afternoon\)/i)).toBeInTheDocument();
    });
  });

  it('4. Renders nutritious snacks section for the planned date', async () => {
    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /Daily Planner/i }));

    await waitFor(() => {
      expect(screen.getByText(/Fresh Scraped Ripe Banana/i)).toBeInTheDocument();
      expect(screen.getByText(/ගාගත් ඉදුණු කෙසෙල්/i)).toBeInTheDocument();
    });
  });

  it('5. Allows caregiver to open substitution modal and inspect eligible alternatives', async () => {
    (nutritionApi.validateSubstitute as any).mockResolvedValue({
      is_valid: true,
      validation_message: 'Dish satisfies all nutritional and safety prerequisites.',
      replacement_item: mealItemVegetarianDuo,
    });

    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /Daily Planner/i }));

    await waitFor(() => {
      expect(screen.getByText(/Coarsely Mashed Rice with Sea Fish, Dhal & Sarana/i)).toBeInTheDocument();
    });

    const changeBtn = screen.getByRole('button', { name: /Change Meal/i });
    fireEvent.click(changeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Substitute Meal/i)).toBeInTheDocument();
      expect(screen.getByText(/Vegetarian Pulse Duo Meal/i)).toBeInTheDocument();
    });

    // Select candidate alternative
    const altOption = screen.getByText(/Vegetarian Pulse Duo Meal/i);
    fireEvent.click(altOption);

    // Click confirm substitute button
    const confirmBtn = screen.getByRole('button', { name: /Apply Substitute/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(nutritionApi.validateSubstitute).toHaveBeenCalledWith(1, {
        plan_date: expect.any(String),
        original_food_id: 'DISH_COARSE_MASH_7M_FISH',
        replacement_food_id: 'DISH_VEGETARIAN_PULSE_DUO_MEAL',
      });
    });
  });

  it('6. Switches to 7-Day Weekly Plan tab and renders 7-day calendar pills', async () => {
    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /7-Day Weekly Plan/i }));

    await waitFor(() => {
      expect(screen.getByText(/7-Day Weekly Meal Planning Matrix/i)).toBeInTheDocument();
      expect(screen.getByText(/This Week/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Week/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const dayPills = screen.getAllByRole('button').filter(
        (btn) => btn.textContent && btn.textContent.includes('7m')
      );
      expect(dayPills.length).toBe(7);
    });
  });

  it('7. Displays developmental milestone transition notices across the week', async () => {
    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /7-Day Weekly Plan/i }));

    await waitFor(() => {
      expect(screen.getByText(/Developmental Milestone Transitions This Week/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Child advances from Day 6 to Day 7 of complementary feeding/i)
      ).toBeInTheDocument();
    });
  });

  it('8. Renders weekly grocery checklist with category grouping and pantry status', async () => {
    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /7-Day Weekly Plan/i }));

    await waitFor(() => {
      expect(screen.getByText(/Weekly Ingredient Checklist/i)).toBeInTheDocument();
      expect(screen.getByText(/Grains & Staples/i)).toBeInTheDocument();
      expect(screen.getByText(/Animal-Source Foods/i)).toBeInTheDocument();
      expect(screen.getByText(/Pulses & Legumes/i)).toBeInTheDocument();
      expect(screen.getByText(/Fresh Fruits/i)).toBeInTheDocument();
      expect(screen.getByText(/White Raw Rice \/ Samba/i)).toBeInTheDocument();
      expect(screen.getByText(/Fresh Banana/i)).toBeInTheDocument();
    });
  });

  it('9. Allows filtering grocery checklist by missing ingredients only', async () => {
    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /7-Day Weekly Plan/i }));

    await waitFor(() => {
      expect(screen.getByText(/Weekly Ingredient Checklist/i)).toBeInTheDocument();
    });

    const needToBuyFilter = screen.getByRole('button', { name: /To Buy/i });
    fireEvent.click(needToBuyFilter);

    // Rice is in pantry, so should not appear under "Need to Buy"
    expect(screen.queryByText(/White Raw Rice \/ Samba/i)).not.toBeInTheDocument();
    // Fresh Banana is missing, so should remain visible
    expect(screen.getByText(/Fresh Banana/i)).toBeInTheDocument();
  });

  it('10. Renders milk-feeding guidance and zero solid slots for children aged 0–5 months', async () => {
    (nutritionApi.getDailyPlan as any).mockResolvedValue(mockDailyPlanNewborn);
    renderNutritionPage(babyNewborn, [babyNewborn]);

    fireEvent.click(screen.getByRole('tab', { name: /Daily Planner/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Exclusive Milk Feeding Stage/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/require only breast milk/i)
      ).toBeInTheDocument();
    });

    // Confirm no complementary meal slots are shown
    expect(screen.queryByText(/Main Meal 1/i)).not.toBeInTheDocument();
  });

  it('11. Renders project completion milestone notice for children at 60 completed months', async () => {
    (nutritionApi.getDailyPlan as any).mockResolvedValue(mockDailyPlanSchoolAge);
    renderNutritionPage(babySchoolAge, [babySchoolAge]);

    fireEvent.click(screen.getByRole('tab', { name: /Daily Planner/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Child Growth & Nutrition Scope Complete/i)
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/Your child has completed 60 calendar months \(5 years\)/i).length
      ).toBeGreaterThan(0);
    });

    // Confirm no new complementary meal slots are generated
    expect(screen.queryByText(/Main Meal 1/i)).not.toBeInTheDocument();
  });

  it('12. Handles unfilled slot when no eligible dish satisfies dietary restrictions', async () => {
    const planWithUnfilled: DailyMealPlanResponse = {
      ...mockDailyPlanEmma,
      planned_meals: [
        {
          slot_number: 1,
          slot_label: 'Main Meal 1',
          slot_type: 'MAIN_MEAL',
          meal_item: null,
          is_unfilled: true,
          unfilled_reason: 'No dishes satisfy severe allergy restrictions and pantry constraints.',
          eligible_substitutes: [],
        },
      ],
    };

    (nutritionApi.getDailyPlan as any).mockResolvedValue(planWithUnfilled);
    renderNutritionPage();

    fireEvent.click(screen.getByRole('tab', { name: /Daily Planner/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unfilled Meal Slot/i)).toBeInTheDocument();
      expect(
        screen.getByText(/No dishes satisfy severe allergy restrictions and pantry constraints/i)
      ).toBeInTheDocument();
    });
  });
});
