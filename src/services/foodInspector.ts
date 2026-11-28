import type {
  DietaryTag,
  FoodCategory,
  FoodInspectionResult,
} from '../types';

const CATEGORIES: FoodCategory[] = [
  'bakery',
  'produce',
  'prepared_meals',
  'dairy',
  'pantry',
];
const STORAGE_REQUIREMENTS = ['ambient', 'refrigerated', 'frozen'] as const;
const DIETARY_TAGS: DietaryTag[] = [
  'vegan',
  'vegetarian',
  'gluten_free',
  'halal',
  'nut_free',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createFallbackResult(reason: string): FoodInspectionResult {
  return {
    isEdibleFood: true,
    safetyReason: `${reason} Please verify the food's condition and safe handling before publishing.`,
    title: 'Surplus food item',
    description: 'Please add the item details and confirm its condition.',
    category: 'produce',
    storageRequirement: 'refrigerated',
    dietaryTags: [],
    detectedAllergens: [],
    recommendedExpiryHours: 4,
    recommendedPickupWindow: 'Valid for 4 hours',
    source: 'fallback',
  };
}

function parseInspectionResult(value: unknown): FoodInspectionResult | null {
  if (!isRecord(value)) return null;

  const {
    isEdibleFood,
    safetyReason,
    title,
    description,
    category,
    storageRequirement,
    dietaryTags,
    detectedAllergens,
    recommendedExpiryHours,
    recommendedPickupWindow,
  } = value;

  if (
    typeof isEdibleFood !== 'boolean' ||
    typeof safetyReason !== 'string' ||
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    typeof category !== 'string' ||
    !CATEGORIES.includes(category as FoodCategory) ||
    typeof storageRequirement !== 'string' ||
    !STORAGE_REQUIREMENTS.includes(
      storageRequirement as (typeof STORAGE_REQUIREMENTS)[number]
    ) ||
    !Array.isArray(dietaryTags) ||
    !dietaryTags.every(
      (tag): tag is DietaryTag =>
        typeof tag === 'string' && DIETARY_TAGS.includes(tag as DietaryTag)
    ) ||
    !Array.isArray(detectedAllergens) ||
    !detectedAllergens.every((allergen) => typeof allergen === 'string') ||
    typeof recommendedExpiryHours !== 'number' ||
    !Number.isFinite(recommendedExpiryHours) ||
    typeof recommendedPickupWindow !== 'string'
  ) {
    return null;
  }

  return {
    isEdibleFood,
    safetyReason,
    title,
    description,
    category: category as FoodCategory,
    storageRequirement:
      storageRequirement as FoodInspectionResult['storageRequirement'],
    dietaryTags,
    detectedAllergens,
    recommendedExpiryHours,
    recommendedPickupWindow,
    source: 'ai',
  };
}

export async function inspectFoodImage(
  imageDataUrl: string
): Promise<FoodInspectionResult> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(
    imageDataUrl
  );
  if (!match) {
    return createFallbackResult('The selected image could not be prepared for inspection.');
  }

  const [, mimeType, imageBase64] = match;
  try {
    const response = await fetch('/api/inspect-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    if (!response.ok) {
      return createFallbackResult(
        `Food inspection is unavailable (HTTP ${response.status}).`
      );
    }

    const payload: unknown = await response.json();
    if (isRecord(payload) && payload.fallback === true) {
      const reason =
        typeof payload.reason === 'string'
          ? payload.reason
          : 'AI food inspection is not configured.';
      return createFallbackResult(reason);
    }

    const result = parseInspectionResult(payload);
    return (
      result ??
      createFallbackResult('The inspection service returned an invalid result.')
    );
  } catch {
    return createFallbackResult('Food inspection could not be reached.');
  }
}
