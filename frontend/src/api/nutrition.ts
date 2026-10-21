import { apiClient } from './client';
import {
  BabyNutritionPreferencesResponse,
  BabyNutritionPreferencesUpdate,
  NutritionRecommendationResponse,
} from '@/types/nutrition';

export const nutritionApi = {
  /**
   * Retrieves personalized nutrition recommendations for an authorized baby.
   * Always explicitly provides baby_id query parameter.
   */
  getRecommendations: (babyId: number, evaluationDate?: string) => {
    let endpoint = `/nutrition/recommendations?baby_id=${encodeURIComponent(babyId)}`;
    if (evaluationDate) {
      endpoint += `&evaluation_date=${encodeURIComponent(evaluationDate)}`;
    }
    return apiClient.get<NutritionRecommendationResponse>(endpoint);
  },

  /**
   * Retrieves stored nutrition preferences for an authorized baby.
   * Always explicitly provides baby_id query parameter.
   */
  getPreferences: (babyId: number) => {
    return apiClient.get<BabyNutritionPreferencesResponse>(
      `/nutrition/preferences?baby_id=${encodeURIComponent(babyId)}`
    );
  },

  /**
   * Updates nutrition preferences for an authorized baby.
   * Always explicitly provides baby_id query parameter.
   */
  updatePreferences: (babyId: number, payload: BabyNutritionPreferencesUpdate) => {
    return apiClient.put<BabyNutritionPreferencesResponse>(
      `/nutrition/preferences?baby_id=${encodeURIComponent(babyId)}`,
      payload
    );
  },

  /**
   * Generates a deterministic daily meal plan for an authorized baby.
   */
  getDailyPlan: (babyId: number, planDate?: string) => {
    let endpoint = `/nutrition/plans/daily?baby_id=${encodeURIComponent(babyId)}`;
    if (planDate) {
      endpoint += `&date=${encodeURIComponent(planDate)}`;
    }
    return apiClient.get<DailyMealPlanResponse>(endpoint);
  },

  /**
   * Generates a deterministic 7-day weekly meal plan for an authorized baby.
   */
  getWeeklyPlan: (babyId: number, startDate?: string) => {
    let endpoint = `/nutrition/plans/weekly?baby_id=${encodeURIComponent(babyId)}`;
    if (startDate) {
      endpoint += `&start_date=${encodeURIComponent(startDate)}`;
    }
    return apiClient.get<WeeklyMealPlanResponse>(endpoint);
  },

  /**
   * Revalidates a proposed meal/snack substitution on the backend.
   */
  validateSubstitute: (babyId: number, payload: SubstituteValidationRequest) => {
    return apiClient.post<SubstituteValidationResponse>(
      `/nutrition/plans/substitute-check?baby_id=${encodeURIComponent(babyId)}`,
      payload
    );
  },
};

