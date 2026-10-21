import React, { useState } from 'react';
import {
  CheckCircle2,
  Filter,
  Package,
  ShoppingBag,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WeeklyGroceryItem, FoodGroup } from '@/types/nutrition';
import { FOOD_GROUP_CONFIG } from '@/features/nutrition/nutritionMetadata';

interface GroceryChecklistSectionProps {
  items: WeeklyGroceryItem[];
  title?: string;
  description?: string;
}

export function GroceryChecklistSection({
  items,
  title = 'Weekly Household Ingredient Checklist',
  description = 'Consolidated pantry and market ingredients needed across planned meals without fabricated gram estimates.',
}: GroceryChecklistSectionProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'need' | 'on_hand'>('all');

  // Filter items based on availability filter
  const filteredItems = items.filter((item) => {
    if (filterMode === 'need') return !item.is_available_in_household;
    if (filterMode === 'on_hand') return item.is_available_in_household;
    return true;
  });

  // Group items by food group
  const groupedItems = filteredItems.reduce<Record<string, WeeklyGroceryItem[]>>((acc, item) => {
    const groupKey = item.food_group || 'OTHER';
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {});

  const totalCount = items.length;
  const onHandCount = items.filter((i) => i.is_available_in_household).length;
  const needCount = totalCount - onHandCount;

  return (
    <Card className="border-border/80 shadow-xs rounded-2xl overflow-hidden bg-card">
      <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <ShoppingBag className="size-4" />
              <span>Pantry & Shopping Guidance</span>
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground mt-1">
              {title}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {description}
            </CardDescription>
          </div>

          {/* Quick summary chips */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-border/80 py-1">
              Total: {totalCount}
            </Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs py-1">
              On-Hand: {onHandCount}
            </Badge>
            <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-xs py-1">
              Need: {needCount}
            </Badge>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 pt-3">
          <Button
            size="sm"
            variant={filterMode === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterMode('all')}
            className="text-xs h-7 px-3 rounded-lg"
          >
            All Ingredients ({items.length})
          </Button>
          <Button
            size="sm"
            variant={filterMode === 'need' ? 'default' : 'outline'}
            onClick={() => setFilterMode('need')}
            className={`text-xs h-7 px-3 rounded-lg ${
              filterMode === 'need' ? 'bg-amber-700 hover:bg-amber-800 text-white' : ''
            }`}
          >
            <ShoppingCart className="size-3 mr-1" />
            To Buy / Not In Pantry ({needCount})
          </Button>
          <Button
            size="sm"
            variant={filterMode === 'on_hand' ? 'default' : 'outline'}
            onClick={() => setFilterMode('on_hand')}
            className={`text-xs h-7 px-3 rounded-lg ${
              filterMode === 'on_hand' ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : ''
            }`}
          >
            <CheckCircle2 className="size-3 mr-1" />
            Already On-Hand ({onHandCount})
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            <Package className="size-8 mx-auto mb-2 opacity-50" />
            <p>No ingredients match the selected filter.</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([groupKey, groupItems]) => {
            const groupConfig = FOOD_GROUP_CONFIG[groupKey as FoodGroup] || {
              label: groupKey.replace(/_/g, ' '),
              sinhala: '',
              badgeClass: 'bg-muted text-foreground',
            };

            return (
              <div key={groupKey} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/40 pb-1.5">
                  <Badge variant="outline" className={`text-2xs font-bold ${groupConfig.badgeClass}`}>
                    {groupConfig.label}
                  </Badge>
                  {groupConfig.sinhala && (
                    <span className="text-xs text-muted-foreground">({groupConfig.sinhala})</span>
                  )}
                  <span className="text-2xs text-muted-foreground ml-auto">
                    {groupItems.length} {groupItems.length === 1 ? 'ingredient' : 'ingredients'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {groupItems.map((item) => (
                    <div
                      key={item.ingredient_id}
                      className={`p-3 rounded-xl border text-xs transition-colors flex flex-col justify-between ${
                        item.is_available_in_household
                          ? 'border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/10'
                          : 'border-border/70 bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-semibold text-foreground text-xs leading-tight">
                            {item.name}
                          </span>
                          {item.is_available_in_household ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-3xs px-1.5 py-0 border-emerald-300 shrink-0">
                              On-Hand
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50/60 dark:bg-amber-950/20 text-3xs px-1.5 py-0 shrink-0">
                              To Buy
                            </Badge>
                          )}
                        </div>

                        {item.sinhala_name && (
                          <p className="text-2xs text-emerald-800 dark:text-emerald-400 font-medium">
                            {item.sinhala_name}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-3xs text-muted-foreground">
                        <span>Used in {item.total_meal_appearances} {item.total_meal_appearances === 1 ? 'meal' : 'meals'}</span>
                        <span title={item.meal_names.join(', ')} className="truncate max-w-[120px] text-right">
                          {item.meal_names[0]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
