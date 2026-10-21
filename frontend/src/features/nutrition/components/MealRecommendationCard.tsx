import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  CookingPot,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FOOD_GROUP_CONFIG,
  FOOD_TEXTURE_LABELS,
  getIngredientLabel,
  sanitizeParentGuidance,
} from '@/features/nutrition/nutritionMetadata';
import { MealRecommendationItem } from '@/types/nutrition';

interface MealRecommendationCardProps {
  item: MealRecommendationItem;
  substitutionsMap?: Record<string, string[]>;
}

export function MealRecommendationCard({ item, substitutionsMap = {} }: MealRecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const textureInfo = FOOD_TEXTURE_LABELS[item.texture] ?? {
    label: item.texture.replace(/_/g, ' '),
    description: 'Age-appropriate consistency',
  };

  const isSnack = item.meal_slot === 'SNACK' || item.item_type === 'SNACK';

  // Gather available substitutions for any ingredient in this dish
  const relevantSubs: { primaryId: string; primaryLabel: string; alternatives: string[] }[] = [];
  for (const ingId of item.ingredients) {
    const alts = substitutionsMap[ingId];
    if (alts && alts.length > 0) {
      relevantSubs.push({
        primaryId: ingId,
        primaryLabel: getIngredientLabel(ingId),
        alternatives: alts.map(altId => getIngredientLabel(altId)),
      });
    }
  }

  return (
    <Card className="border-border/60 shadow-2xs hover:shadow-xs transition-shadow duration-200 overflow-hidden bg-card">
      <CardContent className="p-5 space-y-4">
        {/* Top Header: Meal Slot, Sinhala Name, Evidence Badge */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={isSnack ? 'outline' : 'default'}
                className={
                  isSnack
                    ? 'border-amber-400 text-amber-700 bg-amber-50 font-semibold text-xs'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs'
                }
              >
                {item.meal_slot.replace(/_/g, ' ')}
              </Badge>

              <Badge variant="outline" className="text-xs text-muted-foreground border-border/80">
                {textureInfo.label}
              </Badge>

              {item.is_available_in_household && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-2xs flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3 text-emerald-600 inline" aria-hidden="true" />
                  Pantry On-Hand
                </Badge>
              )}
            </div>

            <h3 className="text-lg font-bold text-foreground leading-tight pt-0.5">
              {item.name}
            </h3>

            {item.sinhala_name && (
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                {item.sinhala_name}
              </p>
            )}
          </div>
        </div>

        {/* Portion and Developmental Rationale */}
        <div className="rounded-xl bg-secondary/40 p-3.5 space-y-2 border border-border/40 text-xs text-foreground">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Clock className="size-3.5 text-primary shrink-0" aria-hidden="true" />
            <span>Portion: {sanitizeParentGuidance(item.household_portion)}</span>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            <Sparkles className="size-3 text-amber-500 inline mr-1" aria-hidden="true" />
            {sanitizeParentGuidance(item.recommendation_reason)}
          </p>
        </div>

        {/* Ingredients & Food Groups */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ingredients ({item.ingredients.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {item.ingredients.map((ingId) => {
              return (
                <span
                  key={ingId}
                  className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-foreground border border-border/50"
                >
                  <CircleDot className="size-2 text-primary" aria-hidden="true" />
                  {getIngredientLabel(ingId)}
                </span>
              );
            })}
          </div>

          {/* Food group badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.food_groups.map((fg) => {
              const cfg = FOOD_GROUP_CONFIG[fg] ?? {
                label: fg.replace(/_/g, ' '),
                color: 'text-foreground',
                bg: 'bg-muted border-border',
              };
              return (
                <span
                  key={fg}
                  className={`inline-block rounded-sm border px-2 py-0.5 text-2xs font-medium ${cfg.bg} ${cfg.color}`}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Expandable Preparation, Safety & Citations */}
        {isExpanded && (
          <div className="space-y-4 pt-3 border-t border-border/60 animate-in fade-in-50 duration-200">
            {/* Preparation Steps */}
            {item.preparation_instructions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <CookingPot className="size-3.5 text-emerald-600" aria-hidden="true" />
                  Preparation Instructions
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground pl-1">
                  {item.preparation_instructions.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Safety & Hygiene Precautions */}
            {item.safety_precautions.length > 0 && (
              <div className="space-y-2 rounded-lg bg-amber-50/70 border border-amber-200/80 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800/40">
                <h4 className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                  Safety & Hygiene Precautions
                </h4>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  {item.safety_precautions.map((safe, idx) => (
                    <li key={idx}>{safe}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Practical Substitutions if available */}
            {relevantSubs.length > 0 && (
              <div className="space-y-2 rounded-lg bg-sky-50/60 border border-sky-200/70 p-3 text-xs text-sky-950 dark:bg-sky-950/20 dark:text-sky-200 dark:border-sky-800/40">
                <h4 className="font-bold flex items-center gap-1.5 text-sky-800 dark:text-sky-300">
                  <Repeat className="size-3.5 text-sky-600 shrink-0" aria-hidden="true" />
                  Practical Kitchen Substitutions
                </h4>
                <div className="space-y-1.5">
                  {relevantSubs.map((sub, idx) => (
                    <div key={idx} className="text-xs leading-relaxed">
                      <strong>If you don't have {sub.primaryLabel}:</strong> Try substituting with{' '}
                      <span className="font-medium text-sky-900 dark:text-sky-100">
                        {sub.alternatives.join(', ')}
                      </span>.
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toggle Expansion Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-xs text-btn-primary hover:text-btn-primary-hover hover:bg-btn-primary/10 min-h-9 gap-1.5"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              Hide Preparation & Guidance <ChevronUp className="size-4" aria-hidden="true" />
            </>
          ) : (
            <>
              View Preparation & Safety Instructions <ChevronDown className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
