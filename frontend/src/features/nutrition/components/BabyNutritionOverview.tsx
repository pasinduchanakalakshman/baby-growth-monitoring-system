import React from 'react';
import { Baby, Calendar, Clock, Heart, Info, Milk, Sparkles, Utensils } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NutritionRecommendationResponse } from '@/types/nutrition';
import { BabyProfile } from '@/types/baby';

interface BabyNutritionOverviewProps {
  baby: BabyProfile | null;
  allBabies?: BabyProfile[];
  selectedBabyId: number;
  onSelectBaby: (babyId: number) => void;
  recommendations: NutritionRecommendationResponse | null;
  loading: boolean;
}

export function BabyNutritionOverview({
  baby,
  allBabies = [],
  selectedBabyId,
  onSelectBaby,
  recommendations,
  loading,
}: BabyNutritionOverviewProps) {
  if (loading && !recommendations) {
    return (
      <Card className="border-border/60 shadow-sm bg-gradient-to-br from-primary/5 via-background to-secondary/30">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-4 w-72 bg-muted rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="h-20 bg-muted/60 rounded-xl" />
              <div className="h-20 bg-muted/60 rounded-xl" />
              <div className="h-20 bg-muted/60 rounded-xl" />
              <div className="h-20 bg-muted/60 rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedMonths = recommendations?.child_age_completed_months ?? 0;
  const remainingDays = recommendations?.child_age_remaining_days ?? 0;
  const stageName = recommendations?.stage_name ?? 'Determining Feeding Stage...';
  const mealFrequency = recommendations?.meal_frequency_guidance ?? 'Loading meal frequency guidance...';
  const snackFrequency = recommendations?.daily_snack_frequency_guidance;
  const milkGuidance = recommendations?.milk_feeding_guidance ?? 'Continue breastfeeding on demand.';
  const portionGuidance = recommendations?.feeding_rule?.household_portion ?? 'Age-appropriate portion according to child appetite.';

  const babiesList = allBabies.length > 0 ? allBabies : baby ? [baby] : [];

  return (
    <Card className="border-border/60 shadow-sm bg-gradient-to-br from-primary/5 via-background to-emerald-50/20 overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Top bar: Baby identification & Baby Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Baby className="size-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">
                  {baby?.name ?? 'Registered Baby'}
                </h2>
                <Badge variant="outline" className="border-primary/30 text-primary font-medium">
                  {completedMonths} completed months {remainingDays > 0 ? `+ ${remainingDays} days` : ''}
                </Badge>
                {baby?.sex && (
                  <Badge variant="secondary" className="text-xs">
                    {baby.sex}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar className="size-3.5 inline" aria-hidden="true" />
                DOB: {baby?.date_of_birth ?? 'Recorded'} &bull; Evaluated on {recommendations?.evaluation_date ?? 'Today'} (Asia/Colombo)
              </p>
            </div>
          </div>

          {/* Multi-Baby Switcher when parent has multiple babies */}
          {babiesList.length > 1 && (
            <div className="flex items-center gap-2 min-w-[200px]">
              <label htmlFor="baby-selector" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Select Child:
              </label>
              <select
                id="baby-selector"
                aria-label="Select registered child profile"
                value={String(selectedBabyId)}
                onChange={(e) => onSelectBaby(Number(e.target.value))}
                className="h-9 w-full text-xs rounded-md border border-input bg-background px-3 py-1 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                {babiesList.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name} (ID: {b.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Feeding Stage Banner */}
        <div className="rounded-xl p-4 bg-background/80 border border-primary/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Current Developmental Stage
            </span>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500 inline" aria-hidden="true" />
              {stageName}
            </h3>
            {completedMonths >= 6 && recommendations?.feeding_rule?.stage_id && (
              <p className="text-xs text-muted-foreground">
                Target Texture: <strong className="text-foreground">{recommendations.feeding_rule.texture.replace(/_/g, ' ')}</strong> &bull; Rule Precedence: {recommendations.feeding_rule.precedence}
              </p>
            )}
            {completedMonths < 6 && (
              <p className="text-xs text-muted-foreground">
                Feeding Mode: <strong className="text-foreground">Exclusive Milk (Liquid)</strong> &bull; Zero solids or purées before 6 completed months
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 text-xs">
              FHB 2025 Guideline Aligned
            </Badge>
          </div>
        </div>

        {/* Feeding Overview Stats Grid */}
        {completedMonths < 6 ? (
          /* Under 6 Completed Months: Milk-Feeding Overview Cards */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            {/* Card 1: 100% Milk Feeding */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Nutrition Source</span>
                <Milk className="size-4 text-purple-600" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug">100% Milk Feeding</p>
              <p className="text-xs text-muted-foreground">Exclusive breast milk or doctor-guided formula</p>
            </div>

            {/* Card 2: Feeding Rhythm */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Feeding Frequency</span>
                <Heart className="size-4 text-rose-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug">On demand, day &amp; night</p>
              <p className="text-xs text-muted-foreground">At least 8 to 12 feeds in 24 hours</p>
            </div>

            {/* Card 3: Milestone Timeline */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Complementary Milestone</span>
                <Clock className="size-4 text-amber-600" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug">Starts at 6 Completed Months</p>
              <p className="text-xs text-muted-foreground">Zero solids or extra water before 6 months</p>
            </div>
          </div>
        ) : (
          /* Complementary Feeding Stats Grid (6-59 Completed Months) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            {/* Meals */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Main Meals</span>
                <Utensils className="size-4 text-emerald-600" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug">{mealFrequency}</p>
              <p className="text-xs text-muted-foreground">Planned for child appetite</p>
            </div>

            {/* Snacks */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Nutritious Snacks</span>
                <Heart className="size-4 text-rose-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug">
                {snackFrequency ?? 'Not applicable at this stage'}
              </p>
              <p className="text-xs text-muted-foreground">
                {completedMonths < 7 ? 'Snacks start at 7m + 1 week' : 'Fresh fruit & soft snacks'}
              </p>
            </div>

            {/* Portions */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Portion Guidance</span>
                <Clock className="size-4 text-amber-600" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2" title={portionGuidance}>
                {portionGuidance}
              </p>
              <p className="text-xs text-muted-foreground">Standard Sri Lankan tea cup</p>
            </div>

            {/* Milk Guidance */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">Milk &amp; Fluids</span>
                <Milk className="size-4 text-purple-600" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2" title={milkGuidance}>
                {milkGuidance}
              </p>
              <p className="text-xs text-muted-foreground">Breastfeed after / between meals</p>
            </div>
          </div>
        )}

        {/* Responsive Feeding Advisory */}
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
          <Info className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="text-foreground">FHB Responsive Feeding Principle:</strong>{' '}
            {completedMonths < 6
              ? 'Feed on cue with patience and love. Never force a feed. Sit facing your baby, maintain gentle eye contact, and avoid all screen distractions during feeding sessions.'
              : 'Feed with patience and love. Never force a baby to finish food. Sit facing the baby, maintain eye contact, and avoid all screen distractions during feeding sessions.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
