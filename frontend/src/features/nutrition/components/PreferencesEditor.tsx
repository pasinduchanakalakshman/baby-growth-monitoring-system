import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DIETARY_PREFERENCE_OPTIONS,
  INGREDIENTS_CATALOG,
  MILK_FEEDING_METHODS,
  RESTRICTION_GROUPS,
  getRestrictionGroupLabel,
} from '@/features/nutrition/nutritionMetadata';
import { BabyNutritionPreferencesResponse, BabyNutritionPreferencesUpdate, MilkFeedingMethod } from '@/types/nutrition';
import { BabyProfile } from '@/types/baby';

interface PreferencesEditorProps {
  baby: BabyProfile | null;
  preferences: BabyNutritionPreferencesResponse | null;
  onSave: (payload: BabyNutritionPreferencesUpdate) => Promise<void>;
  saving: boolean;
}

export function PreferencesEditor({ baby, preferences, onSave, saving }: PreferencesEditorProps) {
  // Form state
  const [cfStartDate, setCfStartDate] = useState<string>('');
  const [milkMethod, setMilkMethod] = useState<string>('');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [restrictedFoods, setRestrictedFoods] = useState<string[]>([]);
  const [foodsIntroduced, setFoodsIntroduced] = useState<string[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Search filter states for long ingredient lists
  const [ingSearch, setIngSearch] = useState<string>('');
  const [availSearch, setAvailSearch] = useState<string>('');
  const [restrictSearch, setRestrictSearch] = useState<string>('');

  // UI state
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Track previous baby ID to clear status message only when switching baby
  const prevBabyIdRef = React.useRef<number | null>(baby?.id ?? null);

  // Populate state when preferences load or change
  useEffect(() => {
    if (baby?.id !== prevBabyIdRef.current) {
      prevBabyIdRef.current = baby?.id ?? null;
      setStatusMessage(null);
    }
    if (preferences) {
      setCfStartDate(preferences.complementary_feeding_start_date ?? '');
      setMilkMethod(preferences.milk_feeding_method ?? '');
      setDietaryPrefs(preferences.dietary_preferences ?? []);
      setRestrictedFoods(preferences.restricted_foods ?? []);
      setFoodsIntroduced(preferences.foods_introduced ?? []);
      setAvailableIngredients(preferences.available_ingredients ?? []);
      setOnlyAvailable(preferences.only_available_ingredients ?? false);
      setHasChanges(false);
    }
  }, [preferences, baby?.id]);

  // Track user edits
  const markChanged = () => {
    setHasChanges(true);
    setStatusMessage(null);
  };

  // Toggle helper
  const toggleArrayItem = (list: string[], item: string, setter: (val: string[]) => void) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
    markChanged();
  };

  // Quick Select / Clear Helpers
  const selectAllIngredientsForAvailable = () => {
    setAvailableIngredients(INGREDIENTS_CATALOG.map((i) => i.id));
    markChanged();
  };

  const clearAvailable = () => {
    setAvailableIngredients([]);
    markChanged();
  };

  // Submit Handler with Client-Side Validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // Validation: Date checks
    const todayStr = new Date().toISOString().split('T')[0];
    if (cfStartDate && cfStartDate > todayStr) {
      setStatusMessage({
        type: 'error',
        text: 'Complementary feeding start date cannot be in the future.',
      });
      return;
    }

    if (cfStartDate && baby?.date_of_birth && cfStartDate < baby.date_of_birth) {
      setStatusMessage({
        type: 'error',
        text: `Complementary feeding start date cannot be before baby's date of birth (${baby.date_of_birth}).`,
      });
      return;
    }

    const payload: BabyNutritionPreferencesUpdate = {
      complementary_feeding_start_date: cfStartDate ? cfStartDate : null,
      milk_feeding_method: milkMethod ? (milkMethod as MilkFeedingMethod) : null,
      dietary_preferences: dietaryPrefs,
      restricted_foods: restrictedFoods,
      foods_introduced: foodsIntroduced,
      available_ingredients: availableIngredients,
      only_available_ingredients: onlyAvailable,
    };

    try {
      await onSave(payload);
      setStatusMessage({
        type: 'success',
        text: 'Nutrition preferences successfully saved and recommendations refreshed.',
      });
      setHasChanges(false);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to save nutrition preferences. Please try again.',
      });
    }
  };

  // Filtered lists based on search
  const filteredForIntroduced = INGREDIENTS_CATALOG.filter(
    (i) =>
      i.name.toLowerCase().includes(ingSearch.toLowerCase()) ||
      i.sinhalaName.toLowerCase().includes(ingSearch.toLowerCase()) ||
      i.id.toLowerCase().includes(ingSearch.toLowerCase())
  );

  const filteredForAvailable = INGREDIENTS_CATALOG.filter(
    (i) =>
      i.name.toLowerCase().includes(availSearch.toLowerCase()) ||
      i.sinhalaName.toLowerCase().includes(availSearch.toLowerCase()) ||
      i.id.toLowerCase().includes(availSearch.toLowerCase())
  );

  const filteredRestrictions = RESTRICTION_GROUPS.filter(
    (rg) =>
      rg.name.toLowerCase().includes(restrictSearch.toLowerCase()) ||
      rg.description.toLowerCase().includes(restrictSearch.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Feedback Alert */}
      {statusMessage && (
        <Alert
          className={
            statusMessage.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:bg-rose-950/20 dark:text-rose-200'
          }
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertCircle className="size-4 text-rose-600" aria-hidden="true" />
          )}
          <AlertTitle className="text-sm font-bold">
            {statusMessage.type === 'success' ? 'Preferences Saved' : 'Validation Error'}
          </AlertTitle>
          <AlertDescription className="text-xs">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Section 1: Inception & Milk Feeding */}
      <Card className="border-border/60 shadow-2xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="size-4 text-primary" aria-hidden="true" />
            Feeding Milestones & Milk Method
          </CardTitle>
          <CardDescription className="text-xs">
            Recorded history for complementary feeding progression and dairy guidance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-start-date" className="text-xs font-semibold text-foreground">
                Complementary Feeding Start Date
              </Label>
              <Input
                id="cf-start-date"
                type="date"
                value={cfStartDate}
                onChange={(e) => {
                  setCfStartDate(e.target.value);
                  markChanged();
                }}
                min={baby?.date_of_birth}
                max={todayIso}
                className="text-xs h-9"
              />
              <p className="text-2xs text-muted-foreground">
                Date solid or semi-solid foods began. Leave blank if not yet started.
              </p>
            </div>

            {/* Milk Feeding Method */}
            <div className="space-y-1.5">
              <Label htmlFor="milk-method-select" className="text-xs font-semibold text-foreground">
                Primary Milk-Feeding Method
              </Label>
              <Select
                value={milkMethod}
                onValueChange={(val) => {
                  setMilkMethod(val);
                  markChanged();
                }}
              >
                <SelectTrigger id="milk-method-select" className="text-xs h-9">
                  <SelectValue placeholder="Select milk feeding method..." />
                </SelectTrigger>
                <SelectContent>
                  {MILK_FEEDING_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Informs breastfeeding continuation and dairy introduction rules.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Dietary Preferences */}
      <Card className="border-border/60 shadow-2xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600" aria-hidden="true" />
            Dietary Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Cultural or ethical household diet selections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DIETARY_PREFERENCE_OPTIONS.map((opt) => {
              const active = dietaryPrefs.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => toggleArrayItem(dietaryPrefs, opt.value, setDietaryPrefs)}
                  className={`p-3 rounded-xl border text-left transition-all text-xs flex items-start gap-3 cursor-pointer ${
                    active
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200'
                      : 'border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground'
                  }`}
                  aria-pressed={active}
                >
                  <div
                    className={`size-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                      active ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-muted-foreground/40'
                    }`}
                  >
                    {active && <Check className="size-3" />}
                  </div>
                  <div>
                    <span className="font-bold block text-foreground">{opt.label}</span>
                    <span className="text-2xs text-muted-foreground leading-normal mt-0.5 block">
                      {opt.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Allergies & Restriction Groups */}
      <Card className="border-border/60 shadow-2xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Ban className="size-4 text-rose-500" aria-hidden="true" />
            Food Allergies & Exclusions
          </CardTitle>
          <CardDescription className="text-xs">
            Dishes containing selected allergy groups will be strictly excluded from recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {/* Active Restrictions summary pills */}
          {restrictedFoods.length > 0 && (
            <div className="rounded-lg bg-rose-50/50 border border-rose-200/60 p-3 space-y-1.5 dark:bg-rose-950/10 dark:border-rose-900/30">
              <span className="text-2xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Currently Excluded ({restrictedFoods.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {restrictedFoods.map((code) => (
                  <Badge
                    key={code}
                    variant="outline"
                    className="border-rose-300 text-rose-800 bg-white dark:bg-card text-2xs flex items-center gap-1 py-0.5"
                  >
                    {getRestrictionGroupLabel(code)}
                    <button
                      type="button"
                      onClick={() => toggleArrayItem(restrictedFoods, code, setRestrictedFoods)}
                      className="ml-1 text-rose-600 hover:text-rose-900"
                      aria-label={`Remove ${getRestrictionGroupLabel(code)}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Quick select restriction groups */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search allergy or food restrictions..."
                value={restrictSearch}
                onChange={(e) => setRestrictSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg border-border/40">
              {filteredRestrictions.map((rg) => {
                const isRestricted = restrictedFoods.includes(rg.code);
                return (
                  <button
                    type="button"
                    key={rg.code}
                    onClick={() => toggleArrayItem(restrictedFoods, rg.code, setRestrictedFoods)}
                    className={`p-2 rounded-lg border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      isRestricted
                        ? 'border-rose-400 bg-rose-50/80 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                    aria-pressed={isRestricted}
                  >
                    <span className="font-medium text-xs leading-tight">{rg.name}</span>
                    {isRestricted ? (
                      <Ban className="size-3.5 text-rose-600 shrink-0 ml-1.5" />
                    ) : (
                      <Plus className="size-3.5 text-muted-foreground shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Foods Already Introduced */}
      <Card className="border-border/60 shadow-2xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
            Foods Already Introduced & Tolerated
          </CardTitle>
          <CardDescription className="text-xs">
            Mark foods your infant has tried with no allergic reaction. Whole egg dishes require prior egg yolk introduction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-1">
          {/* Active Introduced Summary */}
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span>{foodsIntroduced.length} food(s) introduced</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFoodsIntroduced(INGREDIENTS_CATALOG.map((i) => i.id));
                  markChanged();
                }}
                className="text-2xs h-7 px-2 text-primary"
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFoodsIntroduced([]);
                  markChanged();
                }}
                className="text-2xs h-7 px-2 text-muted-foreground"
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={ingSearch}
              onChange={(e) => setIngSearch(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto p-1 border rounded-lg border-border/40">
            {filteredForIntroduced.map((item) => {
              const checked = foodsIntroduced.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggleArrayItem(foodsIntroduced, item.id, setFoodsIntroduced)}
                  className={`p-2 rounded-md border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    checked
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border-border/40 hover:bg-muted/30 text-foreground'
                  }`}
                  aria-pressed={checked}
                >
                  <span className="line-clamp-1 text-2xs font-medium" title={item.name}>
                    {item.name}
                  </span>
                  <div
                    className={`size-3.5 rounded border flex items-center justify-center shrink-0 ml-1 ${
                      checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-muted-foreground/30'
                    }`}
                  >
                    {checked && <Check className="size-2.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Available Household Ingredients (Kitchen Pantry) */}
      <Card className="border-border/60 shadow-2xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <UtensilsCrossed className="size-4 text-amber-600" aria-hidden="true" />
            Household Food Availability (Kitchen Pantry)
          </CardTitle>
          <CardDescription className="text-xs">
            Select items available in your kitchen today. The engine prioritizes meals with 100% on-hand ingredients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {/* Strict filter toggle */}
          <div className="p-3.5 rounded-xl border border-border/60 bg-secondary/30 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="only-avail-toggle" className="text-xs font-bold text-foreground block cursor-pointer">
                Strict Kitchen Pantry Filter
              </Label>
              <p className="text-2xs text-muted-foreground">
                Only recommend dishes where <strong>100% of ingredients</strong> are on-hand in your kitchen.
              </p>
            </div>
            <input
              id="only-avail-toggle"
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => {
                setOnlyAvailable(e.target.checked);
                markChanged();
              }}
              className="size-4 rounded accent-primary cursor-pointer shrink-0"
            />
          </div>

          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span>{availableIngredients.length} on-hand item(s) selected</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAllIngredientsForAvailable}
                className="text-2xs h-7 px-2 text-primary"
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAvailable}
                className="text-2xs h-7 px-2 text-muted-foreground"
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search pantry ingredients..."
              value={availSearch}
              onChange={(e) => setAvailSearch(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto p-1 border rounded-lg border-border/40">
            {filteredForAvailable.map((item) => {
              const isAvailable = availableIngredients.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggleArrayItem(availableIngredients, item.id, setAvailableIngredients)}
                  className={`p-2 rounded-md border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    isAvailable
                      ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-200'
                      : 'border-border/40 hover:bg-muted/30 text-foreground'
                  }`}
                  aria-pressed={isAvailable}
                >
                  <span className="line-clamp-1 text-2xs font-medium" title={item.name}>
                    {item.name}
                  </span>
                  <div
                    className={`size-3.5 rounded border flex items-center justify-center shrink-0 ml-1 ${
                      isAvailable ? 'bg-amber-600 border-amber-600 text-white' : 'border-muted-foreground/30'
                    }`}
                  >
                    {isAvailable && <Check className="size-2.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 p-4 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-lg">
        <p className="text-2xs text-muted-foreground">
          {hasChanges ? 'You have unsaved changes' : 'All preferences up to date'}
        </p>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (preferences) {
                  setCfStartDate(preferences.complementary_feeding_start_date ?? '');
                  setMilkMethod(preferences.milk_feeding_method ?? '');
                  setDietaryPrefs(preferences.dietary_preferences ?? []);
                  setRestrictedFoods(preferences.restricted_foods ?? []);
                  setFoodsIntroduced(preferences.foods_introduced ?? []);
                  setAvailableIngredients(preferences.available_ingredients ?? []);
                  setOnlyAvailable(preferences.only_available_ingredients ?? false);
                  setHasChanges(false);
                  setStatusMessage(null);
                }
              }}
              disabled={saving}
              className="text-xs h-9"
            >
              Cancel
            </Button>
          )}

          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 min-w-28 gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" /> Save Preferences
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
