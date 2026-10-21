import React from 'react';
import {
  Ban,
  BookOpen,
  Scale,
  Shield,
  Sparkles,
  Tv,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FOOD_GROUP_CONFIG, FOOD_TEXTURE_LABELS } from '@/features/nutrition/nutritionMetadata';
import { FoodGroup, FoodTexture } from '@/types/nutrition';

export function NutritionGuidanceSection() {
  const foodGroups = Object.keys(FOOD_GROUP_CONFIG) as FoodGroup[];
  const foodTextures = Object.keys(FOOD_TEXTURE_LABELS) as FoodTexture[];

  return (
    <div className="space-y-6">
      {/* Primary Reference Citation Header */}
      <Card className="border-border/60 shadow-2xs bg-gradient-to-br from-emerald-50/40 via-background to-primary/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="size-12 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <BookOpen className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <Badge className="bg-emerald-700 text-white font-medium text-xs mb-1">
                National Feeding Guidelines
              </Badge>
              <h3 className="text-xl font-bold text-foreground">
                Right Food at the Right Time, To Make Your Baby Healthy & Bright
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Practical, stage-by-stage complementary feeding guidance, nutrient-rich Sri Lankan recipes, age-appropriate portions, and responsive feeding advice to support healthy child development.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The 7 Food Groups */}
      <Card className="border-border/60 shadow-2xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600" aria-hidden="true" />
            The 7 Sri Lankan Childhood Food Groups
          </CardTitle>
          <CardDescription className="text-xs">
            To ensure optimal physical growth and cognitive development, a child's daily diet must encompass items from these recognized food groups.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {foodGroups.map((fg) => {
              const cfg = FOOD_GROUP_CONFIG[fg];
              return (
                <div
                  key={fg}
                  className={`p-3.5 rounded-xl border ${cfg.bg} space-y-1 transition-all`}
                >
                  <span className={`text-xs font-bold ${cfg.color} block`}>{cfg.label}</span>
                  <p className="text-2xs text-muted-foreground leading-normal">
                    {fg === 'GRAINS_AND_STAPLES' && 'White & red rice, string hoppers, hoppers, breadfruit, jak.'}
                    {fg === 'PULSES_AND_LEGUMES' && 'Red lentils (dhal), green gram, cowpea, chickpeas, soya.'}
                    {fg === 'ANIMAL_SOURCE_FOODS' && 'Sea fish, whole sprat powder, chicken, liver, egg yolk, egg white.'}
                    {fg === 'VEGETABLES' && 'Yellow pumpkin, carrot, sweet potato, brinjal, ridge gourd.'}
                    {fg === 'GREEN_LEAVES' && 'Gotukola, murunga leaves, sarana, thampala, mukunuwenna, spinach.'}
                    {fg === 'FRUITS' && 'Ripe banana, papaya, avocado, mango. Always freshly mashed or scraped.'}
                    {fg === 'FATS_AND_DAIRY' && 'Thick coconut milk, coconut oil, vegetable oil, butter, curd, yoghurt, cheese.'}
                    {fg === 'HUMAN_MILK' && 'Mother’s milk on demand; primary nutrition throughout the first year.'}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Texture Progression Roadmap */}
      <Card className="border-border/60 shadow-2xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Scale className="size-4 text-primary" aria-hidden="true" />
            Developmental Texture Progression Timeline
          </CardTitle>
          <CardDescription className="text-xs">
            Stage-by-stage consistency progression to develop tongue coordination, chewing skills, and prevent oral aversion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {foodTextures.map((tex) => {
              const info = FOOD_TEXTURE_LABELS[tex];
              return (
                <div key={tex} className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
                  <Badge variant="outline" className="text-xs font-bold text-foreground border-border/80">
                    {info.label}
                  </Badge>
                  <p className="text-2xs text-muted-foreground leading-snug pt-1">{info.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Key Safety Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rule 1: Salt & Sugar */}
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
            <Ban className="size-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>Strict Salt & Sugar Ban</span>
          </div>
          <p className="text-2xs text-rose-950 dark:text-rose-200 leading-relaxed">
            Never add salt, sugar, honey, condensed milk, or artificial flavor enhancers before 1 year of age. Protects immature infant kidneys and prevents lifelong sweet preference.
          </p>
        </div>

        {/* Rule 2: Responsive Feeding */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
            <Tv className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>Screen-Free Responsive Feeding</span>
          </div>
          <p className="text-2xs text-amber-950 dark:text-amber-200 leading-relaxed">
            Never feed while distracted by televisions, mobile phones, or moving around. Feed patiently with eye contact, responding to hunger and fullness cues without force-feeding.
          </p>
        </div>

        {/* Rule 3: Choking Safety */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
            <Shield className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>Whole Nut & Choking Hazards</span>
          </div>
          <p className="text-2xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
            Never give whole peanuts, cashews, or hard round seeds to children under 5 years. Peanuts and tree nuts must always be roasted and crushed into fine paste or powder.
          </p>
        </div>
      </div>
    </div>
  );
}
