import React, { useState } from 'react';
import {
  AlertTriangle,
  Baby,
  CheckCircle2,
  Clock,
  Heart,
  Info,
  Loader2,
  Milk,
  RotateCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  BabyNutritionPreferencesResponse,
  MilkFeedingMethod,
  NutritionRecommendationResponse,
} from '@/types/nutrition';
import { sanitizeParentGuidance } from '@/features/nutrition/nutritionMetadata';
import { BabyProfile } from '@/types/baby';

export interface MilkFeedingStageViewProps {
  baby: BabyProfile | null;
  recommendations: NutritionRecommendationResponse;
  preferences: BabyNutritionPreferencesResponse | null;
  onUpdateMilkFeedingMethod: (method: MilkFeedingMethod) => Promise<void>;
  isUpdatingPreferences?: boolean;
}

export function MilkFeedingStageView({
  baby,
  recommendations,
  preferences,
  onUpdateMilkFeedingMethod,
  isUpdatingPreferences = false,
}: MilkFeedingStageViewProps) {
  const completedMonths = recommendations.child_age_completed_months;
  const remainingDays = recommendations.child_age_remaining_days;
  const monthsRemainingToComplementary = Math.max(0, 6 - completedMonths);

  const recordedMethod = preferences?.milk_feeding_method as MilkFeedingMethod | null | undefined;
  const isBreastfeeding =
    recordedMethod === 'exclusive_breastfeeding' ||
    recordedMethod === 'complementary_breastfeeding';
  const isFormula = recordedMethod === 'infant_formula_only';
  const isOther = recordedMethod === 'other' || recordedMethod === 'cow_milk';
  const isUnknown = !recordedMethod;

  // Local state for optional milk feeding method control
  const [isEditingMethod, setIsEditingMethod] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<MilkFeedingMethod>(
    recordedMethod ?? 'exclusive_breastfeeding',
  );
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const handleSaveMethod = async () => {
    try {
      await onUpdateMilkFeedingMethod(selectedMethod);
      setSaveSuccessMessage('Milk feeding method updated successfully.');
      setIsEditingMethod(false);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch {
      // Error handled by query mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Stage Overview & 6-Month Complementary Milestone Banner */}
      <Alert className="border-purple-200 bg-purple-50/70 dark:bg-purple-950/20 text-purple-950 dark:text-purple-200 rounded-xl shadow-xs">
        <Milk className="size-5 text-purple-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <AlertTitle className="text-base font-bold text-purple-900 dark:text-purple-300">
              Exclusive Milk Feeding Stage (0–5 Completed Months)
            </AlertTitle>
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-2.5 py-0.5 w-fit">
              Age: {completedMonths} completed months {remainingDays > 0 ? `+ ${remainingDays} days` : ''}
            </Badge>
          </div>
          <AlertDescription className="text-xs leading-relaxed space-y-2 text-purple-900/90 dark:text-purple-200">
            <p>
              According to national infant feeding guidelines, infants under six completed calendar months obtain 100% of their nutrients, protective antibodies, and hydration from milk feeding alone.
            </p>
            <p className="font-semibold text-purple-950 dark:text-purple-100 flex items-center gap-1.5">
              <Clock className="size-3.5 text-purple-600 inline" aria-hidden="true" />
              Complementary feeding begins strictly at six completed calendar months ({monthsRemainingToComplementary === 1 ? 'approx. 1 month remaining' : `approx. ${monthsRemainingToComplementary} months remaining`}). No solid, semi-solid, or puréed foods should be introduced before 6 completed calendar months.
            </p>
          </AlertDescription>
        </div>
      </Alert>

      {/* 2. Milk-Feeding Method Information & Caregiver Control */}
      <Card className="border-border/60 shadow-xs bg-card">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Heart className="size-4 text-primary" aria-hidden="true" />
              Recorded Milk-Feeding Information
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Caregiver-recorded feeding method for {baby?.name ?? 'your baby'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isEditingMethod ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedMethod(recordedMethod ?? 'exclusive_breastfeeding');
                  setIsEditingMethod(true);
                }}
                className="text-xs h-8 gap-1.5 cursor-pointer"
              >
                <RotateCw className="size-3" aria-hidden="true" />
                {isUnknown ? 'Record Feeding Method' : 'Update Feeding Method'}
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Status Badge & Notification */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Current Recorded Status:</span>
            {isBreastfeeding && (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Exclusive Breastfeeding (Recommended)
              </Badge>
            )}
            {isFormula && (
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1">
                <Milk className="size-3" aria-hidden="true" />
                Infant Formula Feeding (Doctor Guided)
              </Badge>
            )}
            {isOther && (
              <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1">
                Mixed Milk Feeding
              </Badge>
            )}
            {isUnknown && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-400 text-xs">
                Not Specified (Showing National Guidance)
              </Badge>
            )}
          </div>

          {saveSuccessMessage && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Inline Method Updater Form */}
          {isEditingMethod && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3.5">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground">Select Feeding Method for {baby?.name ?? 'Baby'}</h4>
                <p className="text-xs text-muted-foreground">
                  Update your baby's current feeding method so the system displays appropriate guidance without exposing unnecessary complementary food settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('exclusive_breastfeeding')}
                  className={`p-3 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    selectedMethod === 'exclusive_breastfeeding'
                      ? 'border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <Heart className="size-3.5 text-rose-500" /> Exclusive Breastfeeding
                  </p>
                  <p className="text-2xs text-muted-foreground mt-1">
                    Breast milk only, on cue day & night.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('infant_formula_only')}
                  className={`p-3 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    selectedMethod === 'infant_formula_only'
                      ? 'border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <Milk className="size-3.5 text-blue-600" /> Infant Formula Feeding
                  </p>
                  <p className="text-2xs text-muted-foreground mt-1">
                    Doctor or healthcare professional recommended infant formula.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('other')}
                  className={`p-3 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    selectedMethod === 'other'
                      ? 'border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <RotateCw className="size-3.5 text-indigo-600" /> Mixed Milk Feeding
                  </p>
                  <p className="text-2xs text-muted-foreground mt-1">
                    Combination of breast milk and formula.
                  </p>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingMethod(false)}
                  disabled={isUpdatingPreferences}
                  className="text-xs h-8 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveMethod}
                  disabled={isUpdatingPreferences}
                  className="text-xs h-8 gap-1.5 cursor-pointer"
                >
                  {isUpdatingPreferences ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    'Save Feeding Method'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 3. Method-Specific Guidance Cards */}
          {/* Case A: Recorded Formula Feeding */}
          {isFormula && (
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Milk className="size-4 text-blue-600" aria-hidden="true" />
                Infant Formula Feeding &amp; Safe Preparation Guidelines
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                For babies receiving infant formula, strict hygiene, safe reconstitution, and responsive bottle-feeding practices protect against infections and digestive discomfort.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-card rounded-lg p-3 border border-border/60 space-y-1.5">
                  <p className="font-bold text-foreground">Safe Preparation &amp; Hygiene:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-0.5">
                    <li>Boil safe drinking water and let it cool according to formula manufacturer instructions.</li>
                    <li>Always use the exact scoop provided in the tin; never add extra powder or dilute with extra water.</li>
                    <li>Sterilize bottles, teats, and collars thoroughly in boiling water before every feed.</li>
                    <li>Discard any formula remaining in the bottle after a feed within 1 to 2 hours.</li>
                  </ul>
                </div>

                <div className="bg-card rounded-lg p-3 border border-border/60 space-y-1.5">
                  <p className="font-bold text-foreground">Responsive Bottle Feeding:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-0.5">
                    <li>Hold baby in a semi-upright position with eye contact; never feed while baby is lying flat.</li>
                    <li>Tilt the bottle just enough to fill the teat with milk to prevent baby from swallowing air.</li>
                    <li>Never prop the bottle with cushions or leave your baby alone while feeding.</li>
                    <li>Respect satiety cues: stop feeding when baby pushes teat away or relaxes hands; never force a baby to finish a bottle.</li>
                  </ul>
                </div>
              </div>
              <p className="text-2xs text-muted-foreground italic">
                Note: Do not switch formula brands or formulas without consulting your pediatrician or Public Health Midwife (PHM). Do not add cereals, biscuits, or sugar into the bottle.
              </p>
            </div>
          )}

          {/* Case B: Recorded Breastfeeding */}
          {isBreastfeeding && (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Heart className="size-4 text-emerald-600" aria-hidden="true" />
                Recommended Breastfeeding Guidance
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Exclusive breastfeeding is recommended on demand, day and night (at least 8 to 12 feeds in 24 hours).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-card rounded-lg p-3 border border-border/60 space-y-1.5">
                  <p className="font-bold text-foreground">Feeding Rhythm &amp; Latch:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-0.5">
                    <li>Feed whenever baby shows early hunger cues (rooting, smacking lips, sucking fists).</li>
                    <li>Allow baby to finish feeding from the first breast completely before offering the second breast.</li>
                    <li>Emptying the first breast ensures baby receives fat-rich hindmilk, which promotes fullness and weight gain.</li>
                    <li>Night feeds are vital as prolactin hormone levels are highest at night.</li>
                  </ul>
                </div>

                <div className="bg-card rounded-lg p-3 border border-border/60 space-y-1.5">
                  <p className="font-bold text-foreground">Hydration &amp; Purity:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-0.5">
                    <li>Breast milk contains over 80% water and provides all fluids needed, even during hot Sri Lankan dry seasons.</li>
                    <li>No additional water, glucose water, or teas should be given.</li>
                    <li>Water fills the baby's tiny stomach, reduces nursing demand, and exposes the baby to diarrhea risks.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Case C: Unknown / Unspecified Method */}
          {isUnknown && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Info className="size-4 text-amber-600" aria-hidden="true" />
                National Milk-Feeding Guidance (Recommendation)
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Exclusive breastfeeding is recommended for all infants from birth up to six completed calendar months whenever possible.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-card rounded-lg p-3 border border-border/60 space-y-1.5">
                  <p className="font-bold text-foreground">For Breastfed Infants:</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Feed on cue, day and night, at least 8 to 12 times in 24 hours. Breast milk provides complete nutrition and hydration without any need for water or other liquids.
                  </p>
                </div>

                <div className="bg-card rounded-lg p-3 border border-border/60 space-y-1.5">
                  <p className="font-bold text-foreground">For Formula-Fed Infants:</p>
                  <p className="text-muted-foreground leading-relaxed">
                    If formula feeding has been advised by your pediatrician or healthcare provider, follow strict bottle sterilization, use boiled safe water, and practice responsive bottle feeding without forcing.
                  </p>
                </div>
              </div>
              <p className="text-2xs text-muted-foreground">
                Tip: You can record your baby's specific feeding method above to tailor this interface.
              </p>
            </div>
          )}

          {/* Case D: Mixed Milk Feeding */}
          {isOther && (
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="size-4 text-indigo-600" aria-hidden="true" />
                Mixed Milk Feeding Guidance
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                For infants receiving both breast milk and formula, continue breastfeeding as frequently as possible to support maternal milk supply and immunity, while preparing all formula hygienically with boiled water.
              </p>
              <p className="text-xs text-muted-foreground">
                Practice responsive feeding for all feeds: watch for early hunger cues and pause feeds when baby indicates fullness.
              </p>
            </div>
          )}

          {/* Backend Guidance Text Verbatim */}
          {recommendations.milk_feeding_guidance && (
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3 text-xs text-muted-foreground space-y-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Info className="size-3.5 text-primary" aria-hidden="true" />
                Feeding Stage Guidance:
              </span>
              <p className="leading-relaxed">{sanitizeParentGuidance(recommendations.milk_feeding_guidance)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Responsive Feeding: Recognizing Infant Cues */}
      <Card className="border-border/60 shadow-xs bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" aria-hidden="true" />
            Responsive Feeding: Recognizing Infant Cues
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Feed in response to your baby's signals with warmth, patience, and love.
          </p>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Hunger Cues */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h5 className="font-bold text-emerald-900 dark:text-emerald-300">
                  Early Hunger Cues (Time to Feed)
                </h5>
              </div>
              <ul className="space-y-1.5 text-muted-foreground pl-1">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">&bull;</span>
                  <span><strong>Rooting reflex:</strong> Turning head toward caregiver or chest, opening mouth.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">&bull;</span>
                  <span><strong>Lip movements:</strong> Smacking lips, licking, or making sucking sounds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">&bull;</span>
                  <span><strong>Hands to mouth:</strong> Sucking on fingers, hands, or fists.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">&bull;</span>
                  <span><strong>Restlessness:</strong> Stirring, squirming, or soft whimpering (crying is a late hunger cue).</span>
                </li>
              </ul>
            </div>

            {/* Satiety Cues */}
            <div className="rounded-xl border border-purple-200/80 bg-purple-50/30 dark:bg-purple-950/10 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h5 className="font-bold text-purple-900 dark:text-purple-300">
                  Fullness Cues (Time to Stop)
                </h5>
              </div>
              <ul className="space-y-1.5 text-muted-foreground pl-1">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">&bull;</span>
                  <span><strong>Closing mouth:</strong> Closing lips firmly or pushing away nipple or teat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">&bull;</span>
                  <span><strong>Turning away:</strong> Actively turning head away from the breast or bottle.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">&bull;</span>
                  <span><strong>Slowing down:</strong> Pausing often, slowing suck-swallow rhythm.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">&bull;</span>
                  <span><strong>Relaxation:</strong> Opening fists, limp relaxed arms, and falling peacefully asleep.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-3.5 rounded-lg bg-primary/5 border border-primary/15 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong className="text-foreground">Responsive Feeding Principle:</strong> Never force your baby to finish a feed. Feeding should be a gentle, loving interaction with eye contact. Avoid screen distractions (mobile phones, television) completely during feeding times.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5. Essential Health & Safety Prohibitions (0–5 Months) */}
      <Card className="border-rose-200 bg-rose-50/30 dark:bg-rose-950/10 dark:border-rose-900/30 shadow-xs">
        <CardHeader className="pb-3 border-b border-rose-200/50 dark:border-rose-900/30">
          <CardTitle className="text-sm font-bold text-rose-950 dark:text-rose-300 flex items-center gap-2">
            <ShieldAlert className="size-4 text-rose-600" aria-hidden="true" />
            Critical Safety Prohibitions for Under 6 Months
          </CardTitle>
          <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-0.5">
            Strict Sri Lankan national health prohibitions to safeguard infant health
          </p>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-card p-3 border border-border/60 space-y-1 shadow-2xs">
              <p className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-600" />
                No Plain or Glucose Water
              </p>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Fills the small stomach without calories or nutrients, causing poor growth and increasing risk of water intoxication.
              </p>
            </div>

            <div className="rounded-lg bg-card p-3 border border-border/60 space-y-1 shadow-2xs">
              <p className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-600" />
                No Animal Milk (Cow / Goat)
              </p>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Excess protein and minerals burden immature kidneys and can trigger micro-intestinal blood loss and severe iron deficiency.
              </p>
            </div>

            <div className="rounded-lg bg-card p-3 border border-border/60 space-y-1 shadow-2xs">
              <p className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-600" />
                No Honey (Botulism Risk)
              </p>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Honey can contain microscopic <em>Clostridium botulinum</em> spores, causing life-threatening infant botulism. Never give honey before 12 months.
              </p>
            </div>

            <div className="rounded-lg bg-card p-3 border border-border/60 space-y-1 shadow-2xs">
              <p className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-600" />
                No Teas or Gripe Water
              </p>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Commercial herbal preparations and teas are not medically approved, may contain unlisted herbs or alcohol, and interfere with mineral absorption.
              </p>
            </div>

            <div className="rounded-lg bg-card p-3 border border-border/60 space-y-1 shadow-2xs">
              <p className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-600" />
                No Early Semi-Solids or Purees
              </p>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Immature digestive enzymes cannot process starches before six completed months; increases risk of choking, allergies, and diarrhea.
              </p>
            </div>

            <div className="rounded-lg bg-card p-3 border border-border/60 space-y-1 shadow-2xs">
              <p className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-600" />
                No Salt, Sugar, or Flavorings
              </p>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Added salt harms immature infant kidneys. Added sugar promotes tooth decay and establishes unhealthy taste preferences.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Milestone Readiness Signs (Preparing for 6 Completed Months) */}
      <Card className="border-border/60 shadow-xs bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Baby className="size-4 text-primary" aria-hidden="true" />
            Looking Ahead: Complementary Feeding Readiness (6 Completed Months)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            What developmental signs indicate readiness when your baby reaches six completed months?
          </p>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-3.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            At exactly six completed calendar months, breast milk or formula continues to be the primary source of nutrition, but complementary foods are introduced to meet growing energy and iron needs. Watch for these milestone readiness signs:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
              <p className="font-bold text-foreground">Sitting Upright</p>
              <p className="text-2xs text-muted-foreground">Baby can sit with minimal support and hold body upright.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
              <p className="font-bold text-foreground">Good Neck Control</p>
              <p className="text-2xs text-muted-foreground">Baby can hold their head steady without wobbling.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
              <p className="font-bold text-foreground">Loss of Tongue Thrust</p>
              <p className="text-2xs text-muted-foreground">Baby no longer automatically pushes food out of the mouth with tongue.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
              <p className="font-bold text-foreground">Interest in Food</p>
              <p className="text-2xs text-muted-foreground">Baby opens mouth when food is brought near and reaches for food.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
