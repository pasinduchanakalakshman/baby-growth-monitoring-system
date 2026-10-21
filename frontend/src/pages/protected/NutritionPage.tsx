import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  CalendarDays,
  CookingPot,
  Heart,
  Info,
  Loader2,
  RefreshCw,
  Sliders,
  Utensils,
} from 'lucide-react';
import { babyApi } from '@/api/baby';
import { nutritionApi } from '@/api/nutrition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/shared/PageHeader';
import { BabyNutritionOverview } from '@/features/nutrition/components/BabyNutritionOverview';
import { MealRecommendationCard } from '@/features/nutrition/components/MealRecommendationCard';
import { PreferencesEditor } from '@/features/nutrition/components/PreferencesEditor';
import { SpecialStageNotice } from '@/features/nutrition/components/SpecialStageNotice';
import { FoodIdeasCatalog } from '@/features/nutrition/components/FoodIdeasCatalog';
import { NutritionGuidanceSection } from '@/features/nutrition/components/NutritionGuidanceSection';
import { DailyMealPlannerView } from '@/features/nutrition/components/DailyMealPlannerView';
import { WeeklyMealPlannerView } from '@/features/nutrition/components/WeeklyMealPlannerView';
import { MilkFeedingStageView } from '@/features/nutrition/components/MilkFeedingStageView';
import { BabyNutritionPreferencesUpdate, MilkFeedingMethod } from '@/types/nutrition';
import { BabyProfile } from '@/types/baby';

type NutritionTab = 'recommendations' | 'daily-plan' | 'weekly-plan' | 'preferences' | 'ideas' | 'guidance';

interface NutritionPageProps {
  initialBaby?: BabyProfile;
  allBabies?: BabyProfile[];
}

export default function NutritionPage({ initialBaby, allBabies = [] }: NutritionPageProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<NutritionTab>('recommendations');

  // Query authenticated parent's baby profile if not provided via props
  const babyProfileQuery = useQuery({
    queryKey: ['baby.profile'],
    queryFn: babyApi.getBabyProfile,
    enabled: !initialBaby,
    staleTime: 5 * 60 * 1000,
  });

  const defaultBaby = initialBaby || babyProfileQuery.data || null;

  // Selected baby state (for multi-baby switching)
  const [selectedBabyIdState, setSelectedBabyIdState] = useState<number | null>(null);
  const selectedBabyId = selectedBabyIdState ?? defaultBaby?.id ?? null;
  const activeBaby = allBabies.find((b) => b.id === selectedBabyId) ?? defaultBaby;

  // Query personalized nutrition recommendations for selected baby
  const recommendationsQuery = useQuery({
    queryKey: ['nutrition.recommendations', selectedBabyId],
    queryFn: () => {
      if (!selectedBabyId) throw new Error('No baby ID available');
      return nutritionApi.getRecommendations(selectedBabyId);
    },
    enabled: !!selectedBabyId,
    staleTime: 2 * 60 * 1000,
  });

  // Query nutrition preferences for selected baby
  const preferencesQuery = useQuery({
    queryKey: ['nutrition.preferences', selectedBabyId],
    queryFn: () => {
      if (!selectedBabyId) throw new Error('No baby ID available');
      return nutritionApi.getPreferences(selectedBabyId);
    },
    enabled: !!selectedBabyId,
    staleTime: 2 * 60 * 1000,
  });

  // Mutation to update preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: (payload: BabyNutritionPreferencesUpdate) => {
      if (!selectedBabyId) throw new Error('No baby ID selected');
      return nutritionApi.updatePreferences(selectedBabyId, payload);
    },
    onSuccess: (savedPrefs) => {
      // Invalidate queries so recommendations update immediately
      queryClient.setQueryData(['nutrition.preferences', selectedBabyId], savedPrefs);
      void queryClient.invalidateQueries({ queryKey: ['nutrition.recommendations', selectedBabyId] });
    },
  });

  // Handle switching baby
  const handleSelectBaby = (newBabyId: number) => {
    setSelectedBabyIdState(newBabyId);
    setActiveTab('recommendations');
  };

  const handleUpdateMilkFeedingMethod = async (method: MilkFeedingMethod) => {
    if (!selectedBabyId) return;
    await updatePreferencesMutation.mutateAsync({
      milk_feeding_method: method,
    });
  };

  // Loading state for initial profile
  if (babyProfileQuery.isLoading && !activeBaby) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Nutrition & Feeding Guidance"
          description="Personalized Sri Lankan feeding recommendations and dietary preferences for your child."
        />
        <div className="flex h-64 items-center justify-center flex-col gap-3 text-muted-foreground">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-xs">Loading registered child profile...</p>
        </div>
      </div>
    );
  }

  // Error state for baby profile
  if ((babyProfileQuery.isError || !activeBaby) && !initialBaby) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Nutrition & Feeding Guidance"
          description="Personalized Sri Lankan feeding recommendations and dietary preferences for your child."
        />
        <Alert variant="destructive" className="rounded-xl">
          <Info className="size-4" />
          <AlertTitle>Baby Profile Not Found</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            <p>Could not load a registered baby profile. Please make sure your baby is registered first.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void babyProfileQuery.refetch()}
              className="mt-3 text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const recommendations = recommendationsQuery.data ?? null;
  const preferences = preferencesQuery.data ?? null;
  const isRecommendationsLoading = recommendationsQuery.isLoading;
  const isRecommendationsError = recommendationsQuery.isError;

  // Exact age boundary resolution strictly based on backend child_age_completed_months
  const completedMonths = recommendations?.child_age_completed_months ?? 0;
  const isUnderSixMonths = recommendations !== null && completedMonths < 6;
  const isAtCompletionBoundary =
    recommendations !== null && (recommendations.is_at_completion_boundary || completedMonths >= 60);
  const isComplementaryEligible =
    recommendations !== null && completedMonths >= 6 && !isAtCompletionBoundary;

  // Split meals and snacks (for eligible complementary stage)
  const mainMeals = recommendations?.recommendations.filter((i) => i.meal_slot !== 'SNACK') ?? [];
  const snacks = recommendations?.recommendations.filter((i) => i.meal_slot === 'SNACK') ?? [];

  return (
    <div className="space-y-6 min-w-0">
      {/* Page Header */}
      <PageHeader
        title="Nutrition & Feeding Guidance"
        description="Personalized Sri Lankan complementary feeding recommendations and dietary preferences tailored to your child's developmental stage."
      />

      {/* Overview & Stage Card */}
      <BabyNutritionOverview
        baby={activeBaby}
        allBabies={allBabies}
        selectedBabyId={selectedBabyId!}
        onSelectBaby={handleSelectBaby}
        recommendations={recommendations}
        loading={isRecommendationsLoading}
      />

      {/* API Error Notification */}
      {isRecommendationsError && (
        <Alert variant="destructive" className="rounded-xl">
          <Info className="size-4" />
          <AlertTitle>
            {(recommendationsQuery.error as any)?.status === 403
              ? 'Unauthorized Baby Access'
              : (recommendationsQuery.error as any)?.status === 404
              ? 'Baby Record Not Found'
              : (recommendationsQuery.error as any)?.status === 400
              ? 'Recommendation Request Error'
              : 'Unable to Load Recommendations'}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            <p>
              {(recommendationsQuery.error as any)?.message ||
                'An error occurred while fetching personalized nutrition recommendations.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void recommendationsQuery.refetch()}
              className="mt-3 text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Retry Recommendations
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {isRecommendationsLoading && !recommendations && (
        <div className="space-y-4 pt-2">
          <div className="h-6 w-36 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-muted/60 rounded-xl animate-pulse" />
            <div className="h-48 bg-muted/60 rounded-xl animate-pulse" />
          </div>
        </div>
      )}

      {/* 1. AGE 0–5 COMPLETED MONTHS: Simplified Caregiver-Friendly Milk-Feeding View */}
      {isUnderSixMonths && (
        <MilkFeedingStageView
          baby={activeBaby}
          recommendations={recommendations}
          preferences={preferences}
          onUpdateMilkFeedingMethod={handleUpdateMilkFeedingMethod}
          isUpdatingPreferences={updatePreferencesMutation.isPending}
        />
      )}

      {/* 2. AGE 60 COMPLETED MONTHS AND OLDER: Research Milestone Completion Notice */}
      {isAtCompletionBoundary && (
        <SpecialStageNotice recommendations={recommendations} />
      )}

      {/* 3. AGE 6–59 COMPLETED MONTHS: Full Complementary Feeding Interface */}
      {isComplementaryEligible && (
        <div className="space-y-6">
          {/* Accessible Tabs Navigation */}
          <div className="border-b border-border/80">
            <nav
              role="tablist"
              className="flex space-x-1 sm:space-x-3 overflow-x-auto no-scrollbar py-1"
              aria-label="Nutrition navigation tabs"
            >
              <button
                type="button"
                role="tab"
                id="tab-recommendations"
                aria-controls="panel-recommendations"
                aria-selected={activeTab === 'recommendations'}
                onClick={() => setActiveTab('recommendations')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'recommendations'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Utensils className="size-3.5" aria-hidden="true" />
                Today's Recommendations
                {recommendations && recommendations.recommendations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-2xs px-1.5 py-0">
                    {recommendations.recommendations.length}
                  </Badge>
                )}
              </button>

              <button
                type="button"
                role="tab"
                id="tab-daily-plan"
                aria-controls="panel-daily-plan"
                aria-selected={activeTab === 'daily-plan'}
                onClick={() => setActiveTab('daily-plan')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'daily-plan'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Calendar className="size-3.5" aria-hidden="true" />
                Daily Planner
              </button>

              <button
                type="button"
                role="tab"
                id="tab-weekly-plan"
                aria-controls="panel-weekly-plan"
                aria-selected={activeTab === 'weekly-plan'}
                onClick={() => setActiveTab('weekly-plan')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'weekly-plan'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <CalendarDays className="size-3.5" aria-hidden="true" />
                7-Day Weekly Plan
              </button>

              <button
                type="button"
                role="tab"
                id="tab-preferences"
                aria-controls="panel-preferences"
                aria-selected={activeTab === 'preferences'}
                onClick={() => setActiveTab('preferences')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'preferences'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Sliders className="size-3.5" aria-hidden="true" />
                Feeding Preferences &amp; Pantry
              </button>

              <button
                type="button"
                role="tab"
                id="tab-ideas"
                aria-controls="panel-ideas"
                aria-selected={activeTab === 'ideas'}
                onClick={() => setActiveTab('ideas')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'ideas'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <CookingPot className="size-3.5" aria-hidden="true" />
                Food Ideas &amp; Preparation
              </button>

              <button
                type="button"
                role="tab"
                id="tab-guidance"
                aria-controls="panel-guidance"
                aria-selected={activeTab === 'guidance'}
                onClick={() => setActiveTab('guidance')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'guidance'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <BookOpen className="size-3.5" aria-hidden="true" />
                Feeding &amp; Safety Guidance
              </button>
            </nav>
          </div>

          {/* Tab 1: Today's Recommendations */}
          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              {/* Special Stage Notice (Fallback notice when zero meals match) */}
              {recommendations && recommendations.recommendations.length === 0 && (
                <SpecialStageNotice recommendations={recommendations} />
              )}

              {/* Main Meals Section */}
              {recommendations && mainMeals.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Utensils className="size-4 text-emerald-600" aria-hidden="true" />
                        Recommended Main Meals ({mainMeals.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Nutritious staple combinations providing proteins, minerals, and vitamins.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-2xs text-muted-foreground">
                      Planned for Today
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mainMeals.map((item) => (
                      <MealRecommendationCard
                        key={item.recommendation_id}
                        item={item}
                        substitutionsMap={recommendations.available_substitutions}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Snacks Section */}
              {recommendations && snacks.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Heart className="size-4 text-rose-500" aria-hidden="true" />
                        Nutritious Snacks ({snacks.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Healthy snacks between main meals (fresh scraped fruit or soft mash).
                      </p>
                    </div>
                    <Badge variant="outline" className="text-2xs text-muted-foreground">
                      Between Meals
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {snacks.map((item) => (
                      <MealRecommendationCard
                        key={item.recommendation_id}
                        item={item}
                        substitutionsMap={recommendations.available_substitutions}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Daily Meal Planner */}
          {activeTab === 'daily-plan' && (
            <DailyMealPlannerView
              babyId={selectedBabyId}
              babyDob={activeBaby?.date_of_birth || ''}
            />
          )}

          {/* Tab: 7-Day Weekly Plan */}
          {activeTab === 'weekly-plan' && (
            <WeeklyMealPlannerView
              babyId={selectedBabyId}
              babyDob={activeBaby?.date_of_birth || ''}
            />
          )}

          {/* Tab 2: Feeding Preferences & Pantry */}
          {activeTab === 'preferences' && (
            <PreferencesEditor
              baby={activeBaby}
              preferences={preferences}
              onSave={async (payload) => {
                await updatePreferencesMutation.mutateAsync(payload);
              }}
              saving={updatePreferencesMutation.isPending}
            />
          )}

          {/* Tab 3: Food Ideas & Preparation */}
          {activeTab === 'ideas' && (
            <FoodIdeasCatalog recommendations={recommendations} />
          )}

          {/* Tab 4: Feeding & Safety Guidance */}
          {activeTab === 'guidance' && (
            <NutritionGuidanceSection />
          )}
        </div>
      )}
    </div>
  );
}
