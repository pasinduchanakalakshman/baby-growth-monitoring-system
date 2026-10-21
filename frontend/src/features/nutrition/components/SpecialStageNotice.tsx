import React from 'react';
import { AlertCircle, Baby, CheckCircle, GraduationCap, Info, Milk, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { NutritionRecommendationResponse } from '@/types/nutrition';

interface SpecialStageNoticeProps {
  recommendations: NutritionRecommendationResponse;
}

export function SpecialStageNotice({ recommendations }: SpecialStageNoticeProps) {
  const {
    child_age_completed_months,
    is_at_completion_boundary,
    is_eligible,
    special_notice,
    milk_feeding_guidance,
    general_preparation_instructions,
    safety_and_hygiene_guidance,
  } = recommendations;

  // 1. Children 0–5 completed months (Exclusive Breastfeeding / Infant Milk Feeding)
  if (child_age_completed_months < 6) {
    return (
      <div className="space-y-4">
        <Alert className="border-purple-200 bg-purple-50/60 dark:bg-purple-950/20 text-purple-950 dark:text-purple-200 rounded-xl">
          <Milk className="size-5 text-purple-600" aria-hidden="true" />
          <AlertTitle className="text-base font-bold text-purple-900 dark:text-purple-300">
            Exclusive Milk Feeding Stage (0–5 Completed Months)
          </AlertTitle>
          <AlertDescription className="text-xs leading-relaxed space-y-2 mt-2">
            <p>
              According to Sri Lankan Family Health Bureau guidelines, infants under 6 completed calendar months should be fed exclusively on milk (breast milk on demand, day and night, at least 8 to 12 times in 24 hours).
            </p>
            <p className="font-semibold text-purple-900 dark:text-purple-200">
              No solid, semi-solid, or puréed foods should be introduced before 6 completed calendar months.
            </p>
          </AlertDescription>
        </Alert>

        <Card className="border-border/60 shadow-2xs bg-card">
          <CardContent className="p-5 space-y-3.5">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Info className="size-4 text-primary" aria-hidden="true" />
              Guidance for this Stage
            </h4>
            <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>{milk_feeding_guidance}</p>
              {safety_and_hygiene_guidance.length > 0 && (
                <ul className="list-disc list-inside space-y-1 pl-1 pt-1">
                  {safety_and_hygiene_guidance.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Children 60 completed months and older (Research Completion Boundary)
  if (is_at_completion_boundary || child_age_completed_months >= 60) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/30 rounded-xl shadow-xs">
        <CardContent className="p-6 text-center space-y-4 max-w-2xl mx-auto">
          <div className="mx-auto size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <GraduationCap className="size-8" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-foreground">
              Nutrition Milestone Reached (60 Completed Months)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your child has reached 5 years (60 completed calendar months). This component covers early childhood complementary feeding and young child nutrition (0–59 months).
            </p>
          </div>
          <div className="rounded-lg bg-card border border-border/60 p-4 text-xs text-muted-foreground text-left space-y-2">
            <p className="font-semibold text-foreground">
              {special_notice ?? 'Transition to Family Health Bureau school-age child nutrition guidelines.'}
            </p>
            <p>
              Continue providing diverse meals with all family food groups (cereals, pulses, animal proteins, vegetables, green leaves, fruits, and dairy), ensuring adequate physical activity and continuing hygienic home cooking without excess sugar, salt, or ultra-processed snacks.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 3. Empty Recommendations Fallback Notice
  if (recommendations.recommendations.length === 0) {
    return (
      <Alert className="border-amber-200 bg-amber-50/70 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 rounded-xl">
        <AlertCircle className="size-5 text-amber-600" aria-hidden="true" />
        <AlertTitle className="text-base font-bold text-amber-900 dark:text-amber-300">
          No Meals Match Current Restrictions
        </AlertTitle>
        <AlertDescription className="text-xs leading-relaxed space-y-2 mt-2">
          <p>
            {special_notice ?? 'No meals could be safely generated matching all selected ingredient restrictions or availability constraints.'}
          </p>
          <p>
            Please check your <strong>Feeding Preferences</strong> tab to adjust excluded ingredients, relax the strict kitchen pantry filter, or add available household ingredients.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
