/**
 * Metadata and caregiver-friendly descriptions for the Sri Lankan Nutrition Knowledge Base.
 *
 * Source: Family Health Bureau (FHB), Ministry of Health, Sri Lanka (2025).
 * "Right Food at the Right Time, To Make My Baby Healthy and Bright"
 */

import { FoodGroup, FoodTexture, MilkFeedingMethod, RestrictionGroupCode } from '@/types/nutrition';

export interface IngredientMeta {
  id: string;
  name: string;
  sinhalaName: string;
  foodGroup: FoodGroup;
}

export interface RestrictionGroupMeta {
  code: RestrictionGroupCode;
  name: string;
  description: string;
}

export const INGREDIENTS_CATALOG: IngredientMeta[] = [
  { id: 'ING_BREAST_MILK', name: 'Expressed Breast Milk', sinhalaName: 'මව්කිරි', foodGroup: 'HUMAN_MILK' },
  { id: 'ING_RICE_WHITE', name: 'White Raw Rice / Samba', sinhalaName: 'සුදු කැකුළු / සම්බා', foodGroup: 'GRAINS_AND_STAPLES' },
  { id: 'ING_RICE_RED', name: 'Red Raw Rice / Nadu', sinhalaName: 'රතු කැකුළු / නාඩු', foodGroup: 'GRAINS_AND_STAPLES' },
  { id: 'ING_DHAL', name: 'Red Lentils (Dhal)', sinhalaName: 'පරිප්පු', foodGroup: 'PULSES_AND_LEGUMES' },
  { id: 'ING_SPRATS', name: 'Whole Dried Sprats (Halmassa)', sinhalaName: 'හාල්මැස්සන්', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_FISH_SEA', name: 'Fresh Sea Fish (Thalapath, Balaya, Salaya)', sinhalaName: 'මුහුදු මාළු', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_CHICKEN', name: 'Chicken Flesh', sinhalaName: 'කුකුල් මස්', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_COCONUT_MILK', name: 'Thick Coconut Milk (Miti Kiri)', sinhalaName: 'මිටි කිරි', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_COCONUT_OIL', name: 'Pure Coconut Oil', sinhalaName: 'පොල් තෙල්', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_VEG_OIL', name: 'Vegetable Oil (Sunflower / Corn / Sesame)', sinhalaName: 'එළවළු තෙල්', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_BUTTER', name: 'Pure Unsalted Butter', sinhalaName: 'බටර්', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_MARGARINE', name: 'Margarine', sinhalaName: 'මාජරින්', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_BANANA', name: 'Ripe Banana (Ambul / Kolikuttu)', sinhalaName: 'ඉදුණු කෙසෙල්', foodGroup: 'FRUITS' },
  { id: 'ING_PAPAYA', name: 'Ripe Papaya', sinhalaName: 'ඉදුණු පැපොල්', foodGroup: 'FRUITS' },
  { id: 'ING_GREEN_GRAM', name: 'Green Gram (Mung Bean)', sinhalaName: 'මුං ඇට', foodGroup: 'PULSES_AND_LEGUMES' },
  { id: 'ING_COWPEA', name: 'Cowpea', sinhalaName: 'කවුපි', foodGroup: 'PULSES_AND_LEGUMES' },
  { id: 'ING_PUMPKIN', name: 'Yellow Pumpkin', sinhalaName: 'වට්ටක්කා', foodGroup: 'VEGETABLES' },
  { id: 'ING_CARROT', name: 'Carrot', sinhalaName: 'කැරට්', foodGroup: 'VEGETABLES' },
  { id: 'ING_SWEET_POTATO', name: 'Yellow Sweet Potato', sinhalaName: 'බතල', foodGroup: 'VEGETABLES' },
  { id: 'ING_LIVER', name: 'Liver (Chicken / Beef)', sinhalaName: 'අක්මාව', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_MEAT', name: 'Lean Meat (Beef / Mutton)', sinhalaName: 'මස්', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_CHICKPEAS', name: 'Chickpeas (Kadala)', sinhalaName: 'කඩල', foodGroup: 'PULSES_AND_LEGUMES' },
  { id: 'ING_EGG_YOLK', name: 'Hard-Boiled Egg Yolk', sinhalaName: 'තැම්බූ බිත්තර කහ මදය', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_GOTUKOLA', name: 'Gotukola', sinhalaName: 'ගොටුකොළ', foodGroup: 'GREEN_LEAVES' },
  { id: 'ING_MURUNGA_LEAF', name: 'Drumstick Leaves (Murunga Kola)', sinhalaName: 'මුරුංගා කොළ', foodGroup: 'GREEN_LEAVES' },
  { id: 'ING_SARANA', name: 'Sarana Leaves', sinhalaName: 'සාරණ', foodGroup: 'GREEN_LEAVES' },
  { id: 'ING_THAMPALA', name: 'Thampala (Amaranth)', sinhalaName: 'තම්පලා', foodGroup: 'GREEN_LEAVES' },
  { id: 'ING_MUKUNUWENNA', name: 'Mukunuwenna', sinhalaName: 'මුකුණුවැන්න', foodGroup: 'GREEN_LEAVES' },
  { id: 'ING_AVOCADO', name: 'Ripe Avocado', sinhalaName: 'අලිගැටපේර', foodGroup: 'FRUITS' },
  { id: 'ING_MANGO', name: 'Ripe Mango', sinhalaName: 'ඉදුණු අඹ', foodGroup: 'FRUITS' },
  { id: 'ING_SOYA', name: 'Soya Beans / Germinated Soya', sinhalaName: 'සෝයා බෝංචි', foodGroup: 'PULSES_AND_LEGUMES' },
  { id: 'ING_EGG_WHITE', name: 'Hard-Boiled Egg White', sinhalaName: 'තැම්බූ බිත්තර සුදු මදය', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_EGG_WHOLE', name: 'Whole Hard-Boiled Egg', sinhalaName: 'සම්පූර්ණ තැම්බූ බිත්තරය', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_JAK_FRUIT', name: 'Boiled Young Jak (Kos)', sinhalaName: 'තැම්බූ කොස්', foodGroup: 'GRAINS_AND_STAPLES' },
  { id: 'ING_BREADFRUIT', name: 'Boiled Breadfruit (Del)', sinhalaName: 'තැම්බූ දෙල්', foodGroup: 'GRAINS_AND_STAPLES' },
  { id: 'ING_STRING_HOPPERS', name: 'String Hoppers (Idiyappam)', sinhalaName: 'ඉඳිආප්ප', foodGroup: 'GRAINS_AND_STAPLES' },
  { id: 'ING_HOPPER', name: 'Hopper (Appa)', sinhalaName: 'ආප්ප', foodGroup: 'GRAINS_AND_STAPLES' },
  { id: 'ING_SPINACH', name: 'Ceylon Spinach (Nivithi)', sinhalaName: 'නිවිති', foodGroup: 'GREEN_LEAVES' },
  { id: 'ING_BRINJAL', name: 'Brinjal / Eggplant', sinhalaName: 'වම්බටු', foodGroup: 'VEGETABLES' },
  { id: 'ING_RIDGE_GOURD', name: 'Ridge Gourd (Watakolu)', sinhalaName: 'වැටකොළු', foodGroup: 'VEGETABLES' },
  { id: 'ING_DRUMSTICK', name: 'Drumstick Pods (Murunga Karal)', sinhalaName: 'මුරුංගා කරල්', foodGroup: 'VEGETABLES' },
  { id: 'ING_KUNISSO', name: 'Dried Small Prawns (Kunisso)', sinhalaName: 'කූනිස්සන්', foodGroup: 'ANIMAL_SOURCE_FOODS' },
  { id: 'ING_CURD', name: 'Buffalo / Cow Curd', sinhalaName: 'මී කිරි / එළකිරි', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_YOGHURT', name: 'Plain Yoghurt', sinhalaName: 'යෝගට්', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_CHEESE', name: 'Natural Cheese', sinhalaName: 'චීස්', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_PEANUT', name: 'Peanuts (Rata Kaju)', sinhalaName: 'රටකජු', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_CASHEW', name: 'Cashew Nuts (Kaju)', sinhalaName: 'කජු', foodGroup: 'FATS_AND_DAIRY' },
  { id: 'ING_MANIOC', name: 'Boiled Cassava / Manioc', sinhalaName: 'තැම්බූ මඤ්ඤොක්කා', foodGroup: 'GRAINS_AND_STAPLES' },
  { id: 'ING_COCONUT_SCRAP', name: 'Fresh Scraped Coconut', sinhalaName: 'ගාගත් පොල්', foodGroup: 'FATS_AND_DAIRY' },
];

export const INGREDIENTS_BY_ID: Record<string, IngredientMeta> = Object.fromEntries(
  INGREDIENTS_CATALOG.map(item => [item.id, item])
);
INGREDIENTS_BY_ID['ING_RICE'] = {
  id: 'ING_RICE',
  name: 'White / Red Rice',
  sinhalaName: 'කැකුළු බත්',
  foodGroup: 'GRAINS_AND_STAPLES',
};

export const RESTRICTION_GROUPS: RestrictionGroupMeta[] = [
  {
    code: 'RESTRICT_FISH',
    name: 'Fish Allergy',
    description: 'Exclude sea fish, sprats, and small dried fish products.',
  },
  {
    code: 'RESTRICT_SHELLFISH',
    name: 'Shellfish / Crustaceans',
    description: 'Exclude small dried prawns (kunisso) and shellfish.',
  },
  {
    code: 'RESTRICT_DAIRY',
    name: 'Cow / Buffalo Dairy',
    description: "Exclude cow's milk, buffalo curd, yoghurt, cheese, and dairy butter.",
  },
  {
    code: 'RESTRICT_EGG',
    name: 'Egg Allergy',
    description: 'Exclude egg yolk, egg white, and whole egg dishes.',
  },
  {
    code: 'RESTRICT_SOYA',
    name: 'Soya Bean Restriction',
    description: 'Exclude soya beans, germinated soya, and soya meat products.',
  },
  {
    code: 'RESTRICT_LEGUMES',
    name: 'Legumes & Pulses',
    description: 'Exclude dhal, green gram, cowpea, chickpeas, and legumes.',
  },
  {
    code: 'RESTRICT_PEANUT',
    name: 'Peanut Allergy',
    description: 'Exclude peanuts and crushed peanut snacks.',
  },
  {
    code: 'RESTRICT_TREE_NUT',
    name: 'Tree Nut Allergy (Cashew)',
    description: 'Exclude cashew nuts and tree nut products.',
  },
  {
    code: 'RESTRICT_COCONUT',
    name: 'Coconut Allergy',
    description: 'Exclude coconut milk, coconut oil, and fresh scraped coconut.',
  },
];

export const RESTRICTION_GROUPS_BY_CODE: Record<string, RestrictionGroupMeta> = Object.fromEntries(
  RESTRICTION_GROUPS.map(rg => [rg.code, rg])
);

export const MILK_FEEDING_METHODS: { value: MilkFeedingMethod; label: string; description: string }[] = [
  {
    value: 'exclusive_breastfeeding',
    label: 'Exclusive Breastfeeding',
    description: 'Feeding exclusively on breast milk on demand, day and night.',
  },
  {
    value: 'complementary_breastfeeding',
    label: 'Breastfeeding alongside complementary foods',
    description: 'Continuing breast milk on demand after meals up to 2 years and beyond.',
  },
  {
    value: 'infant_formula_only',
    label: 'Infant Formula Only',
    description: 'Physician-recommended infant formula prepared hygienically.',
  },
  {
    value: 'cow_milk',
    label: 'Animal Milk (Cow / Buffalo)',
    description: 'Boiled fresh cow or buffalo milk (strictly after 1 year of age).',
  },
  {
    value: 'other',
    label: 'Other / Mixed Feeding',
    description: 'Mixed breast milk and formula, or caregiver-specific feeding arrangement.',
  },
];

export const DIETARY_PREFERENCE_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: 'VEGETARIAN',
    label: 'Vegetarian (Plant-Based)',
    description: 'Excludes animal meats and fish; emphasizes pulses, grains, vegetables, and dairy/eggs if tolerated.',
  },
  {
    value: 'HALAL',
    label: 'Halal Preparation',
    description: 'Adheres to Islamic dietary requirements.',
  },
];

export const FOOD_GROUP_CONFIG: Record<FoodGroup, { label: string; color: string; bg: string }> = {
  GRAINS_AND_STAPLES: { label: 'Grains & Staples', color: 'text-amber-800', bg: 'bg-amber-50 border-amber-200' },
  PULSES_AND_LEGUMES: { label: 'Pulses & Legumes', color: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-200' },
  ANIMAL_SOURCE_FOODS: { label: 'Animal-Source Foods', color: 'text-rose-800', bg: 'bg-rose-50 border-rose-200' },
  VEGETABLES: { label: 'Vegetables', color: 'text-orange-800', bg: 'bg-orange-50 border-orange-200' },
  GREEN_LEAVES: { label: 'Green Leaves', color: 'text-green-800', bg: 'bg-green-50 border-green-200' },
  FRUITS: { label: 'Fresh Fruits', color: 'text-yellow-800', bg: 'bg-yellow-50 border-yellow-200' },
  FATS_AND_DAIRY: { label: 'Fats, Oils & Dairy', color: 'text-sky-800', bg: 'bg-sky-50 border-sky-200' },
  HUMAN_MILK: { label: 'Breast Milk', color: 'text-purple-800', bg: 'bg-purple-50 border-purple-200' },
};

export const FOOD_TEXTURE_LABELS: Record<FoodTexture, { label: string; description: string }> = {
  LIQUID: { label: 'Liquid', description: 'Breast milk on demand; no solids' },
  SMOOTH_PUREE: { label: 'Smooth Puree', description: 'Soft, creamy, lump-free consistency' },
  SEMI_SOLID_MASH: { label: 'Semi-Solid Mash', description: 'Soft burst grains mashed smooth with spoon' },
  HALF_MASHED: { label: 'Half Mashed', description: 'Granular texture encouraging tongue movement' },
  COARSELY_MASHED: { label: 'Coarsely Mashed', description: 'Fork-mashed texture stimulating chewing motion' },
  COARSELY_CHOPPED: { label: 'Coarsely Chopped', description: 'Tender small pieces chopped finely' },
  FINGER_FOOD: { label: 'Finger Food', description: 'Soft graspable pieces for self-feeding (8m+)' },
  FAMILY_FOOD: { label: 'Family Food', description: 'Nutritious family table meals without added salt/sugar' },
};

export function getIngredientLabel(id: string): string {
  const meta = INGREDIENTS_BY_ID[id];
  if (!meta) return id;
  return meta.sinhalaName ? `${meta.name} (${meta.sinhalaName})` : meta.name;
}

export function getRestrictionGroupLabel(code: string): string {
  const meta = RESTRICTION_GROUPS_BY_CODE[code];
  if (meta) return meta.name;
  return getIngredientLabel(code);
}

/**
 * Strips technical research references, booklet/PDF page citations, and tier codes
 * from backend guidance text, returning parent-friendly advice.
 */
export function sanitizeParentGuidance(text: string | null | undefined): string {
  if (!text) return '';
  return text
    // Remove bracketed citations like [Booklet pp. 2, 5, PDF pp. 4, 7] or [Booklet p. 8, PDF p. 10]
    .replace(/\s*\[(?:Booklet|PDF|FHB|Page)[^\]]*\]/gi, '')
    // Remove parenthetical citations like (Booklet p. 8, PDF p. 10)
    .replace(/\s*\((?:Booklet|PDF|FHB|Page)\s+p[^)]*\)/gi, '')
    // Remove trailing technical references
    .replace(/\s*\(FHB Tier [A-C][^)]*\)/gi, '')
    // Clean up multiple spaces or spaces before punctuation
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}
