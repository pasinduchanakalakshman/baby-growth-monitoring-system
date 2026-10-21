import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Heart,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Utensils,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { nutritionApi } from '@/api/nutrition';
import {
  MealRecommendationItem,
  PlannedMealSlot,
} from '@/types/nutrition';
import { FOOD_TEXTURE_LABELS, sanitizeParentGuidance } from '@/features/nutrition/nutritionMetadata';
import {
  addDaysToDate,
  formatHeaderDate,
  getTodayDateString,
  subDaysFromDate,
} from '@/features/nutrition/plannerDateUtils';
import { MealSubstitutionModal } from './MealSubstitutionModal';

interface DailyMealPlannerViewProps {
  babyId: number | null;
  babyDob: string;
}

export function DailyMealPlannerView({ babyId, babyDob: _babyDob }: DailyMealPlannerViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getTodayDateString();
  });

  const [activeSlotForSub, setActiveSlotForSub] = useState<PlannedMealSlot | null>(null);
  const [localSubstitutions, setLocalSubstitutions] = useState<Record<number, MealRecommendationItem>>({});

  const dailyPlanQuery = useQuery({
    queryKey: ['nutrition.plans.daily', babyId, selectedDate],
    queryFn: () => {
      if (!babyId) throw new Error('No baby ID available');
      return nutritionApi.getDailyPlan(babyId, selectedDate);
    },
    enabled: !!babyId,
    staleTime: 5 * 60 * 1000,
  });

  const plan = dailyPlanQuery.data ?? null;
  const isLoading = dailyPlanQuery.isLoading;
  const isError = dailyPlanQuery.isError;

  const handlePrevDay = () => {
    setSelectedDate(subDaysFromDate(selectedDate, 1));
    setLocalSubstitutions({});
  };

  const handleNextDay = () => {
    setSelectedDate(addDaysToDate(selectedDate, 1));
    setLocalSubstitutions({});
  };

  const handleToday = () => {
    setSelectedDate(getTodayDateString());
    setLocalSubstitutions({});
  };

  const handleApplySubstitute = (slotNumber: number, replacementItem: MealRecommendationItem) => {
    setLocalSubstitutions((prev) => ({
      ...prev,
      [slotNumber]: replacementItem,
    }));
  };

  const formattedHeaderDate = formatHeaderDate(selectedDate);

  if (!babyId) {
    return (
      <Card className="border-border/80 shadow-2xs rounded-2xl bg-card p-8 text-center">
        <Info className="size-8 mx-auto text-muted-foreground mb-2" />
        <h3 className="text-sm font-semibold text-foreground">No Baby Selected</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Please select or register a baby profile to view the personalized daily meal planner.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Navigation Bar */}
      <Card className="border-border/80 shadow-2xs rounded-2xl bg-card">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                Planned Calendar Date
              </p>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {formattedHeaderDate}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevDay}
              className="text-xs h-8 px-2.5 rounded-lg gap-1 cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="text-xs h-8 px-3 rounded-lg font-semibold cursor-pointer"
            >
              Today
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextDay}
              className="text-xs h-8 px-2.5 rounded-lg gap-1 cursor-pointer"
              title="Next Day"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs">Generating age-appropriate meal plan...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load daily plan</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            An error occurred retrieving the daily meal plan for this date.
            <Button
              variant="outline"
              size="sm"
              onClick={() => void dailyPlanQuery.refetch()}
              className="mt-3 text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Plan Details */}
      {plan && (
        <div className="space-y-6">
          {/* Header Stage & Guideline Summary Banner */}
          <Card className="border-emerald-200/80 bg-linear-to-r from-emerald-50/50 via-teal-50/20 to-transparent dark:from-emerald-950/20 dark:border-emerald-800/40 rounded-2xl shadow-2xs">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs">
                      {plan.stage_name}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-800 dark:text-emerald-300">
                      Age: {plan.child_age_completed_months} completed months ({plan.child_age_remaining_days} days)
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-foreground pt-1">
                    Daily Feeding Schedule & Portion Rules
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 rounded-xl bg-white/70 dark:bg-card/70 border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Utensils className="size-3.5 text-emerald-700" />
                    Meal Frequency & Guidance
                  </span>
                  <p className="text-muted-foreground">{plan.meal_frequency_guidance}</p>
                  {plan.daily_snack_frequency_guidance && (
                    <p className="text-amber-800 dark:text-amber-400 pt-0.5">
                      <strong>Snacks:</strong> {plan.daily_snack_frequency_guidance}
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white/70 dark:bg-card/70 border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Heart className="size-3.5 text-pink-600" />
                    Milk Feeding Guidance
                  </span>
                  <p className="text-muted-foreground">{plan.milk_feeding_guidance}</p>
                </div>
              </div>

              {plan.special_notice && (
                <Alert className="rounded-xl border-amber-300 bg-amber-50/70 text-amber-900 text-xs py-2 mt-2">
                  <Info className="size-4 text-amber-700" />
                  <AlertDescription>{plan.special_notice}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Under 6 Months: Exclusive Milk Banner */}
          {plan.is_under_six_months && (
            <Alert className="rounded-2xl border-blue-300 bg-blue-50/70 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200 p-5">
              <Heart className="size-5 text-blue-600" />
              <AlertTitle className="text-sm font-bold">Exclusive Milk Feeding Stage (0–5 Months)</AlertTitle>
              <AlertDescription className="text-xs mt-1.5 space-y-2">
                <p>
                  According to Sri Lankan national health guidelines, babies under 6 completed months
                  require only breast milk (or infant formula if prescribed).
                </p>
                <p>
                  Complementary foods, water, juices, and solid food slots are strictly not introduced until the
                  baby reaches exactly 6 completed calendar months.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* 60 Months Completion Boundary Banner */}
          {plan.is_at_completion_boundary && (
            <Alert className="rounded-2xl border-purple-300 bg-purple-50/70 dark:bg-purple-950/20 text-purple-950 dark:text-purple-200 p-5">
              <Award className="size-5 text-purple-600" />
              <AlertTitle className="text-sm font-bold">Child Growth & Nutrition Scope Complete</AlertTitle>
              <AlertDescription className="text-xs mt-1.5 space-y-2">
                <p>
                  Your child has completed 60 calendar months (5 years). The early childhood monitoring boundary
                  is complete. Please refer to school-age dietary guidelines from the Ministry of Health.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Main Meals Section */}
          {!plan.is_under_six_months && !plan.is_at_completion_boundary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Utensils className="size-4 text-primary" />
                  Planned Main Meals ({(plan.planned_meals || []).length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(plan.planned_meals || []).map((slot: PlannedMealSlot) => {
                  const effectiveItem = localSubstitutions[slot.slot_number] || slot.meal_item;
                  return (
                    <PlannedSlotCard
                      key={`meal-slot-${slot.slot_number}`}
                      slot={slot}
                      item={effectiveItem}
                      onOpenSubstitute={() => setActiveSlotForSub(slot)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Snacks Section */}
          {!plan.is_under_six_months && !plan.is_at_completion_boundary && (plan.planned_snacks || []).length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CookingPot className="size-4 text-amber-600" />
                  Planned Nutritious Snacks ({(plan.planned_snacks || []).length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(plan.planned_snacks || []).map((slot: PlannedMealSlot) => {
                  const effectiveItem = localSubstitutions[slot.slot_number] || slot.meal_item;
                  return (
                    <PlannedSlotCard
                      key={`snack-slot-${slot.slot_number}`}
                      slot={slot}
                      item={effectiveItem}
                      onOpenSubstitute={() => setActiveSlotForSub(slot)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Stage Preparation & Safety Instructions */}
          {(((plan.general_preparation_instructions || []).length > 0) || ((plan.safety_and_hygiene_guidance || []).length > 0)) && (
            <Card className="border-border/70 rounded-2xl shadow-2xs bg-muted/15">
              <CardContent className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {(plan.general_preparation_instructions || []).length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <CookingPot className="size-4 text-primary" />
                      Preparation Guidelines for this Stage
                    </span>
                    <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
                      {plan.general_preparation_instructions.map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {plan.safety_and_hygiene_guidance.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
                      <ShieldAlert className="size-4 text-amber-600" />
                      Safety, Salt & Sugar Prohibitions
                    </span>
                    <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
                      {plan.safety_and_hygiene_guidance.map((note: string, idx: number) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Substitution Modal */}
      <MealSubstitutionModal
        isOpen={!!activeSlotForSub}
        onClose={() => setActiveSlotForSub(null)}
        slot={activeSlotForSub}
        planDate={selectedDate}
        babyId={babyId}
        onApplySubstitute={handleApplySubstitute}
      />
    </div>
  );
}

interface PlannedSlotCardProps {
  slot: PlannedMealSlot;
  item?: MealRecommendationItem | null;
  onOpenSubstitute: () => void;
}

function PlannedSlotCard({ slot, item, onOpenSubstitute }: PlannedSlotCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (slot.is_unfilled || !item) {
    return (
      <Card className="border-dashed border-amber-300 bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl p-5 flex flex-col justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="text-2xs border-amber-400 text-amber-800">
            {slot.slot_label}
          </Badge>
          <h4 className="font-bold text-sm text-foreground">Unfilled Meal Slot</h4>
          <p className="text-xs text-muted-foreground">
            {slot.unfilled_reason || 'No eligible dish in catalogue satisfies active dietary preferences or pantry restrictions.'}
          </p>
        </div>
        {slot.eligible_substitutes.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenSubstitute}
            className="mt-4 text-xs self-start gap-1.5"
          >
            <RefreshCw className="size-3" />
            Pick Substitute ({slot.eligible_substitutes.length})
          </Button>
        )}
      </Card>
    );
  }

  const textureInfo = FOOD_TEXTURE_LABELS[item.texture] ?? {
    label: item.texture.replace(/_/g, ' '),
    description: '',
  };

  return (
    <Card className="border-border/80 shadow-xs hover:shadow-sm transition-all duration-200 rounded-2xl flex flex-col justify-between bg-card overflow-hidden">
      <CardContent className="p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Badge variant="outline" className="text-2xs font-bold border-primary/40 text-primary bg-primary/5">
              {slot.slot_label}
            </Badge>
            <h4 className="text-base font-bold text-foreground leading-snug pt-0.5">
              {item.name}
            </h4>
          </div>
        </div>

        {/* Portion and Texture Badges */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <Badge variant="secondary" className="text-2xs font-medium">
            {textureInfo.label}
          </Badge>
          {item.is_available_in_household && (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-3xs">
              <CheckCircle2 className="size-3 mr-1 inline" />
              In Pantry
            </Badge>
          )}
        </div>

        {/* Household Portion Highlight */}
        <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
          <span className="font-semibold text-foreground block">Household Portion:</span>
          <span className="text-muted-foreground">{sanitizeParentGuidance(item.household_portion)}</span>
        </div>

        {/* Reason / Developmental Rationale */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {sanitizeParentGuidance(item.recommendation_reason)}
        </p>

        {/* Expanded Recipe & Safety Instructions */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border/60 text-xs">
            {item.preparation_instructions.length > 0 && (
              <div>
                <span className="font-semibold text-foreground block mb-1">Preparation:</span>
                <ol className="list-decimal pl-4 space-y-1 text-muted-foreground text-2xs">
                  {item.preparation_instructions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {item.safety_precautions.length > 0 && (
              <div className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-2xs space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <ShieldAlert className="size-3" /> Safety:
                </span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {item.safety_precautions.map((safe, idx) => (
                    <li key={idx}>{safe}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="text-2xs h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            {expanded ? 'Show Less' : 'View Instructions'}
          </Button>

          {slot.eligible_substitutes.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenSubstitute}
              className="text-2xs h-7 px-2.5 rounded-lg gap-1 border-border/80 hover:border-btn-primary hover:text-btn-primary cursor-pointer"
            >
              <RefreshCw className="size-3 text-btn-primary" />
              Change Meal
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
