import React, { useState } from 'react';
import {
  CookingPot,
  Info,
  Search,
  Utensils,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MealRecommendationCard } from '@/features/nutrition/components/MealRecommendationCard';
import { NutritionRecommendationResponse } from '@/types/nutrition';

interface FoodIdeasCatalogProps {
  recommendations: NutritionRecommendationResponse | null;
}

export function FoodIdeasCatalog({ recommendations }: FoodIdeasCatalogProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'MAIN_MEAL' | 'SNACK'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  if (!recommendations || recommendations.recommendations.length === 0) {
    return (
      <Card className="border-border/60 shadow-2xs p-8 text-center bg-card">
        <div className="max-w-md mx-auto space-y-3">
          <Utensils className="size-10 text-muted-foreground/50 mx-auto" aria-hidden="true" />
          <h3 className="text-base font-bold text-foreground">No Food Ideas Available</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Food ideas are derived directly from the backend recommendation engine for your child's age stage. Once meals are generated, they will be catalogued here with preparation details.
          </p>
        </div>
      </Card>
    );
  }

  const allItems = recommendations.recommendations;

  // Filter items
  const filteredItems = allItems.filter((item) => {
    // Type filter
    if (filterType === 'MAIN_MEAL' && item.meal_slot === 'SNACK') return false;
    if (filterType === 'SNACK' && item.meal_slot !== 'SNACK') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSinhala = item.sinhala_name?.toLowerCase().includes(q) ?? false;
      const matchReason = item.recommendation_reason.toLowerCase().includes(q);
      const matchIngredients = item.ingredients.some((ing) => ing.toLowerCase().includes(q));
      if (!matchName && !matchSinhala && !matchReason && !matchIngredients) return false;
    }

    return true;
  });

  const mainMealsCount = allItems.filter((i) => i.meal_slot !== 'SNACK').length;
  const snacksCount = allItems.filter((i) => i.meal_slot === 'SNACK').length;

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CookingPot className="size-5 text-emerald-600" aria-hidden="true" />
            Stage-Appropriate Food Ideas
          </h3>
          <p className="text-xs text-muted-foreground">
            Carefully curated dishes and snacks matched to your child's age and texture stage.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Foods ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('MAIN_MEAL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'MAIN_MEAL'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Main Meals ({mainMealsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('SNACK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'SNACK'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Snacks ({snacksCount})
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search by food name or ingredient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 text-xs h-9"
        />
      </div>

      {/* Food Cards Grid */}
      {filteredItems.length === 0 ? (
        <Card className="border-border/60 shadow-2xs p-6 text-center bg-card">
          <p className="text-xs text-muted-foreground">
            No food ideas found matching "{searchQuery}".
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <MealRecommendationCard
              key={item.recommendation_id}
              item={item}
              substitutionsMap={recommendations.available_substitutions}
            />
          ))}
        </div>
      )}

      {/* Guidance Notice */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground flex items-start gap-3">
        <Info className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-foreground">Authentic Sri Lankan Nutrition:</strong> All food combinations reflect traditional Sri Lankan home cooking (white and red samba rice, coconut milk, dhal, drumstick leaves, gotukola, sprats, and ripe fruits) formulated to provide dietary diversity and prevent childhood nutritional anemia without artificial supplements.
        </p>
      </div>
    </div>
  );
}
