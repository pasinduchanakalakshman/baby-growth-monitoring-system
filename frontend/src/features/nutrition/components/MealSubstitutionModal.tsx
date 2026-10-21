import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  CookingPot,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { nutritionApi } from '@/api/nutrition';
import {
  MealRecommendationItem,
  PlannedMealSlot,
  SubstituteValidationResponse,
} from '@/types/nutrition';

interface MealSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: PlannedMealSlot | null;
  planDate: string;
  babyId: number;
  onApplySubstitute: (slotNumber: number, replacementItem: MealRecommendationItem) => void;
}

export function MealSubstitutionModal({
  isOpen,
  onClose,
  slot,
  planDate,
  babyId,
  onApplySubstitute,
}: MealSubstitutionModalProps) {
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<SubstituteValidationResponse | null>(null);

  const validateMutation = useMutation({
    mutationFn: (foodId: string) => {
      if (!slot?.meal_item) throw new Error('No meal item to substitute');
      return nutritionApi.validateSubstitute(babyId, {
        plan_date: planDate,
        original_food_id: slot.meal_item.dish_or_food_id,
        replacement_food_id: foodId,
      });
    },
    onSuccess: (data) => {
      setValidationResult(data);
    },
    onError: () => {
      setValidationResult({
        is_valid: false,
        validation_message: 'Network or server error validating substitution.',
      });
    },
  });

  if (!slot || !slot.meal_item) return null;

  const currentMeal = slot.meal_item;
  const eligibleSubs = slot.eligible_substitutes || [];

  const handleSelectAlternative = (foodId: string) => {
    setSelectedFoodId(foodId);
    setValidationResult(null);
    validateMutation.mutate(foodId);
  };

  const handleApply = () => {
    if (validationResult?.is_valid && validationResult.replacement_item) {
      onApplySubstitute(slot.slot_number, validationResult.replacement_item);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFoodId(null);
    setValidationResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-6 sm:p-7 bg-card border-border/80 shadow-xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <RefreshCw className="size-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Validated Alternative Meal</span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Substitute Meal for {slot.slot_label}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Current dish: <strong className="text-foreground">{currentMeal.name}</strong> ({currentMeal.household_portion}).
            Choose a verified alternative suitable for your child's developmental stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <label className="text-xs font-semibold text-foreground block">
            Eligible Alternative Dishes & Snacks ({eligibleSubs.length})
          </label>

          {eligibleSubs.length === 0 ? (
            <Alert className="rounded-xl border-amber-300 bg-amber-50/70 text-amber-900 text-xs">
              <AlertCircle className="size-4 text-amber-700" />
              <AlertDescription>
                No alternative dishes in the catalogue currently meet all active dietary restrictions and texture requirements for this specific stage.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
              {eligibleSubs.map((foodId) => {
                const isSelected = selectedFoodId === foodId;
                const formattedName = foodId
                  .replace(/^(DISH_|SNACK_)/, '')
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <button
                    key={foodId}
                    type="button"
                    onClick={() => handleSelectAlternative(foodId)}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                        : 'border-border/70 hover:border-border hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CookingPot className={`size-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{formattedName}</span>
                    </div>
                    {isSelected && validateMutation.isPending && (
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Validation Status Feedback */}
          {validateMutation.isPending && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Verifying age-suitability and texture...</span>
            </div>
          )}

          {validationResult && (
            <Alert
              variant={validationResult.is_valid ? 'default' : 'destructive'}
              className={`rounded-xl text-xs ${
                validationResult.is_valid
                  ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : ''
              }`}
            >
              {validationResult.is_valid ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              <AlertDescription className="mt-0.5 font-medium">
                {validationResult.validation_message}
                {validationResult.is_valid && validationResult.replacement_item && (
                  <div className="mt-2 text-2xs space-y-1 text-emerald-800 dark:text-emerald-300">
                    <p>
                      <strong>Portion:</strong> {validationResult.replacement_item.household_portion}
                    </p>
                    <p>
                      <strong>Texture:</strong> {validationResult.replacement_item.texture.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!validationResult?.is_valid || validateMutation.isPending}
            onClick={handleApply}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5"
          >
            <Sparkles className="size-3.5" />
            Apply Substitute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
