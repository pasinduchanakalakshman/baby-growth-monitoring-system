import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Utensils,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { nutritionApi } from '@/api/nutrition';
import {
  DailyMealPlanResponse,
  MealRecommendationItem,
  PlannedMealSlot,
  WeeklyMealPlanResponse,
} from '@/types/nutrition';
import { FOOD_TEXTURE_LABELS, sanitizeParentGuidance } from '@/features/nutrition/nutritionMetadata';
import {
  addDaysToDate,
  formatDayPill,
  formatMonthDayYear,
  formatWeekRange,
  getTodayDateString,
  subDaysFromDate,
} from '@/features/nutrition/plannerDateUtils';
import { GroceryChecklistSection } from './GroceryChecklistSection';
import { MealSubstitutionModal } from './MealSubstitutionModal';

interface WeeklyMealPlannerViewProps {
  babyId: number | null;
  babyDob: string;
}

export function WeeklyMealPlannerView({ babyId, babyDob }: WeeklyMealPlannerViewProps) {
  const [startDate, setStartDate] = useState<string>(() => {
    return getTodayDateString();
  });

  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [showGroceryList, setShowGroceryList] = useState<boolean>(true);
  const [activeSlotForSub, setActiveSlotForSub] = useState<PlannedMealSlot | null>(null);
  const [localSubstitutions, setLocalSubstitutions] = useState<Record<string, MealRecommendationItem>>({});

  const weeklyPlanQuery = useQuery({
    queryKey: ['nutrition.plans.weekly', babyId, startDate],
    queryFn: () => {
      if (!babyId) throw new Error('No baby ID available');
      return nutritionApi.getWeeklyPlan(babyId, startDate);
    },
    enabled: !!babyId,
    staleTime: 5 * 60 * 1000,
  });

  const weekly = weeklyPlanQuery.data ?? null;
  const isLoading = weeklyPlanQuery.isLoading;
  const isError = weeklyPlanQuery.isError;

  const handlePrevWeek = () => {
    setStartDate(subDaysFromDate(startDate, 7));
    setSelectedDayIndex(0);
    setLocalSubstitutions({});
  };

  const handleNextWeek = () => {
    setStartDate(addDaysToDate(startDate, 7));
    setSelectedDayIndex(0);
    setLocalSubstitutions({});
  };

  const handleThisWeek = () => {
    setStartDate(getTodayDateString());
    setSelectedDayIndex(0);
    setLocalSubstitutions({});
  };

  const activeDayPlan: DailyMealPlanResponse | null =
    weekly?.days && weekly.days.length > selectedDayIndex ? weekly.days[selectedDayIndex] : null;

  const handleApplySubstitute = (slotNumber: number, replacementItem: MealRecommendationItem) => {
    if (!activeDayPlan) return;
    const key = `${activeDayPlan.plan_date}_slot_${slotNumber}`;
    setLocalSubstitutions((prev) => ({
      ...prev,
      [key]: replacementItem,
    }));
  };

  const formattedWeekRange = weekly
    ? formatWeekRange(weekly.start_date, weekly.end_date)
    : '7 Consecutive Days';

  if (!babyId) {
    return (
      <Card className="border-border/80 shadow-2xs rounded-2xl bg-card p-8 text-center">
        <Info className="size-8 mx-auto text-muted-foreground mb-2" />
        <h3 className="text-sm font-semibold text-foreground">No Baby Selected</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Please select or register a baby profile to view the personalized 7-day meal planner.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week Navigator */}
      <Card className="border-border/80 shadow-2xs rounded-2xl bg-card">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-700/10 text-emerald-800 dark:text-emerald-300">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                7-Day Weekly Meal Planning Matrix
              </p>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {formattedWeekRange}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevWeek}
              className="text-xs h-8 px-2.5 rounded-lg gap-1 cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Previous Week</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleThisWeek}
              className="text-xs h-8 px-3 rounded-lg font-semibold cursor-pointer"
            >
              This Week
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextWeek}
              className="text-xs h-8 px-2.5 rounded-lg gap-1 cursor-pointer"
              title="Next Week"
            >
              <span className="hidden sm:inline">Next Week</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs">Computing deterministic 7-day rotation plan with independent daily age resolution...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load weekly plan</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            An error occurred retrieving the weekly meal plan.
            <Button
              variant="outline"
              size="sm"
              onClick={() => void weeklyPlanQuery.refetch()}
              className="mt-3 text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {weekly && (
        <div className="space-y-6">
          {/* Milestone Transitions Alert */}
          {weekly.stage_transitions.length > 0 && (
            <Alert className="rounded-2xl border-purple-300 bg-purple-50/70 dark:bg-purple-950/20 text-purple-950 dark:text-purple-200">
              <TrendingUp className="size-4 text-purple-600" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">
                Developmental Milestone Transitions This Week
              </AlertTitle>
              <AlertDescription className="text-xs mt-1 space-y-1">
                {weekly.stage_transitions.map((trans: string, idx: number) => (
                  <p key={idx} className="font-medium">• {trans}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* 7-Day Calendar Pill Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {weekly.days.map((day: DailyMealPlanResponse, idx: number) => {
              const { dayName, dayDate } = formatDayPill(day.plan_date);
              const isSelected = selectedDayIndex === idx;

              return (
                <button
                  key={day.plan_date}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-1 cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-600/30 shadow-xs'
                      : 'border-border/70 hover:border-border hover:bg-muted/40 bg-card'
                  }`}
                >
                  <span className={`text-2xs font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                    {dayName}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {dayDate}
                  </span>

                  <Badge
                    variant="outline"
                    className={`text-3xs px-1.5 py-0 mt-1 border-border/80 ${
                      day.is_under_six_months
                        ? 'border-blue-300 text-blue-700 bg-blue-50/50'
                        : day.is_at_completion_boundary
                        ? 'border-purple-300 text-purple-700 bg-purple-50/50'
                        : 'border-emerald-300 text-emerald-800'
                    }`}
                  >
                    {day.is_under_six_months
                      ? '0–5m Milk'
                      : day.is_at_completion_boundary
                      ? '5y Done'
                      : `${day.child_age_completed_months}m`}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Active Day Detail Card */}
          {activeDayPlan && (
            <Card className="border-border/80 shadow-xs rounded-2xl bg-card overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-700 text-white font-semibold text-xs">
                        {activeDayPlan.day_of_week}, {formatMonthDayYear(activeDayPlan.plan_date)}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-800">
                        {activeDayPlan.stage_name} ({activeDayPlan.child_age_completed_months}m + {activeDayPlan.child_age_remaining_days}d)
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-1.5">
                      {activeDayPlan.meal_frequency_guidance}
                      {activeDayPlan.daily_snack_frequency_guidance && ` • ${activeDayPlan.daily_snack_frequency_guidance}`}
                    </CardDescription>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowGroceryList(!showGroceryList)}
                    className="text-xs h-8 px-3 rounded-xl gap-1.5 border-border/80"
                  >
                    <ShoppingBag className="size-3.5 text-primary" />
                    {showGroceryList ? 'Hide Grocery List' : 'Show Weekly Grocery List'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-6">
                {activeDayPlan.is_under_six_months ? (
                  <Alert className="rounded-xl border-blue-300 bg-blue-50/60 text-blue-900 text-xs">
                    <Info className="size-4 text-blue-700" />
                    <AlertDescription>
                      Child is {activeDayPlan.child_age_completed_months} completed months on this date.
                      National health guidance recommends exclusive milk feeding without complementary foods.
                    </AlertDescription>
                  </Alert>
                ) : activeDayPlan.is_at_completion_boundary ? (
                  <Alert className="rounded-xl border-purple-300 bg-purple-50/60 text-purple-900 text-xs">
                    <Info className="size-4 text-purple-700" />
                    <AlertDescription>
                      Child has completed the 60-month monitoring scope on this date. Transitions to school-age guidance.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* Main Meals */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Utensils className="size-4 text-primary" />
                        Main Meals
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {(activeDayPlan.planned_meals || []).map((slot) => {
                          const subKey = `${activeDayPlan.plan_date}_slot_${slot.slot_number}`;
                          const effectiveItem = localSubstitutions[subKey] || slot.meal_item;

                          return (
                            <WeeklyDaySlotItem
                              key={`dslot-${slot.slot_number}`}
                              slot={slot}
                              item={effectiveItem}
                              onOpenSubstitute={() => setActiveSlotForSub(slot)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Snacks */}
                    {(activeDayPlan.planned_snacks || []).length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <CookingPot className="size-4 text-amber-600" />
                          Nutritious Snacks
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {(activeDayPlan.planned_snacks || []).map((slot) => {
                            const subKey = `${activeDayPlan.plan_date}_slot_${slot.slot_number}`;
                            const effectiveItem = localSubstitutions[subKey] || slot.meal_item;

                            return (
                              <WeeklyDaySlotItem
                                key={`dsnack-${slot.slot_number}`}
                                slot={slot}
                                item={effectiveItem}
                                onOpenSubstitute={() => setActiveSlotForSub(slot)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Weekly Grocery Checklist Section */}
          {showGroceryList && weekly.weekly_grocery_checklist.length > 0 && (
            <GroceryChecklistSection
              items={weekly.weekly_grocery_checklist}
              title={`Weekly Household Ingredient Checklist (${formattedWeekRange})`}
              description="Aggregated ingredients needed across all 7 planned days (reflects the baseline unmodified weekly meal plan). Filter by on-hand status for easy kitchen planning."
            />
          )}

          {/* Variety & Rotation Strategy Notes */}
          {weekly.variety_notes.length > 0 && (
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-emerald-600" />
                Explainable Deterministic Rotation
              </span>
              {weekly.variety_notes.map((note: string, idx: number) => (
                <p key={idx}>{note}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Substitution Modal */}
      {activeDayPlan && (
        <MealSubstitutionModal
          isOpen={!!activeSlotForSub}
          onClose={() => setActiveSlotForSub(null)}
          slot={activeSlotForSub}
          planDate={activeDayPlan.plan_date}
          babyId={babyId}
          onApplySubstitute={handleApplySubstitute}
        />
      )}
    </div>
  );
}

interface WeeklyDaySlotItemProps {
  slot: PlannedMealSlot;
  item?: MealRecommendationItem | null;
  onOpenSubstitute: () => void;
}

function WeeklyDaySlotItem({ slot, item, onOpenSubstitute }: WeeklyDaySlotItemProps) {
  if (slot.is_unfilled || !item) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/30 text-xs space-y-2">
        <Badge variant="outline" className="text-3xs border-amber-400 text-amber-800">
          {slot.slot_label}
        </Badge>
        <p className="font-medium text-foreground">Unfilled Slot</p>
        <p className="text-3xs text-muted-foreground">{slot.unfilled_reason}</p>
      </div>
    );
  }

  const textureInfo = FOOD_TEXTURE_LABELS[item.texture] ?? {
    label: item.texture.replace(/_/g, ' '),
    description: '',
  };

  return (
    <div className="p-4 rounded-xl border border-border/70 bg-card hover:border-border transition-colors flex flex-col justify-between space-y-2.5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <Badge variant="outline" className="text-3xs font-semibold border-primary/30 text-primary">
            {slot.slot_label}
          </Badge>
          <Badge variant="secondary" className="text-3xs">
            {textureInfo.label}
          </Badge>
        </div>

        <h5 className="font-bold text-sm text-foreground leading-snug">
          {item.name}
        </h5>

        {item.sinhala_name && (
          <p className="text-2xs text-emerald-800 dark:text-emerald-400 font-medium">
            {item.sinhala_name}
          </p>
        )}

        <div className="pt-1 text-2xs text-muted-foreground">
          <strong className="text-foreground">Portion:</strong> {sanitizeParentGuidance(item.household_portion)}
        </div>
      </div>

      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
        {item.is_available_in_household ? (
          <span className="text-3xs text-emerald-700 flex items-center gap-1 font-medium">
            <CheckCircle2 className="size-3" /> In Pantry
          </span>
        ) : (
          <span className="text-3xs text-muted-foreground">Market Items</span>
        )}

        {slot.eligible_substitutes.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenSubstitute}
            className="text-3xs h-6 px-2 rounded-lg text-primary hover:text-primary hover:bg-primary/5"
          >
            Change
          </Button>
        )}
      </div>
    </div>
  );
}
