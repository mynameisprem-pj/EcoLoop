type FoodCategory = 'bakery' | 'produce' | 'prepared_meals' | 'dairy' | 'pantry';
type DietaryTag =
  | 'vegan'
  | 'vegetarian'
  | 'gluten_free'
  | 'halal'
  | 'nut_free';
type StorageRequirement = 'ambient' | 'refrigerated' | 'frozen';

interface InspectionRequest {
  imageBase64: string;
  mimeType: string;
}

interface InspectionResponse {
  isEdibleFood: boolean;
  safetyReason: string;
  title: string;
  description: string;
  category: FoodCategory;
  storageRequirement: StorageRequirement;
  dietaryTags: DietaryTag[];
  detectedAllergens: string[];
  recommendedExpiryHours: number;
  recommendedPickupWindow: string;
}

interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseInspectionResponse(value: unknown): InspectionResponse | null {
  if (!isRecord(value)) return null;
  const categories: FoodCategory[] = [
    'bakery',
    'produce',
    'prepared_meals',
    'dairy',
    'pantry',
  ];
  const storageRequirements: StorageRequirement[] = [
    'ambient',
    'refrigerated',
    'frozen',
  ];
  const dietaryTags: DietaryTag[] = [
    'vegan',
    'vegetarian',
    'gluten_free',
    'halal',
    'nut_free',
  ];
  const fields = value as Record<string, unknown>;

  if (
    typeof fields.isEdibleFood !== 'boolean' ||
    typeof fields.safetyReason !== 'string' ||
    typeof fields.title !== 'string' ||
    typeof fields.description !== 'string' ||
    typeof fields.category !== 'string' ||
    !categories.includes(fields.category as FoodCategory) ||
    typeof fields.storageRequirement !== 'string' ||
    !storageRequirements.includes(
      fields.storageRequirement as StorageRequirement
    ) ||
    !Array.isArray(fields.dietaryTags) ||
    !fields.dietaryTags.every(
      (tag) => typeof tag === 'string' && dietaryTags.includes(tag as DietaryTag)
    ) ||
    !Array.isArray(fields.detectedAllergens) ||
    !fields.detectedAllergens.every(
      (allergen) => typeof allergen === 'string'
    ) ||
    typeof fields.recommendedExpiryHours !== 'number' ||
    !Number.isFinite(fields.recommendedExpiryHours) ||
    fields.recommendedExpiryHours < 0.5 ||
    fields.recommendedExpiryHours > 48 ||
    typeof fields.recommendedPickupWindow !== 'string'
  ) {
    return null;
  }

  return {
    isEdibleFood: fields.isEdibleFood,
    safetyReason: fields.safetyReason,
    title: fields.title,
    description: fields.description,
    category: fields.category as FoodCategory,
    storageRequirement: fields.storageRequirement as StorageRequirement,
    dietaryTags: fields.dietaryTags as DietaryTag[],
    detectedAllergens: fields.detectedAllergens as string[],
    recommendedExpiryHours: fields.recommendedExpiryHours,
    recommendedPickupWindow: fields.recommendedPickupWindow,
  };
}

function getImageInput(value: unknown): InspectionRequest | null {
  if (!isRecord(value)) return null;
  const { imageBase64, mimeType } = value;
  if (
    typeof imageBase64 !== 'string' ||
    imageBase64.length === 0 ||
    typeof mimeType !== 'string' ||
    !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
  ) {
    return null;
  }
  return { imageBase64, mimeType };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res
      .status(200)
      .json({ fallback: true, reason: 'GEMINI_API_KEY not configured' });
    return;
  }

  const image = getImageInput(req.body);
  if (!image) {
    res.status(400).json({ error: 'A valid imageBase64 and mimeType are required.' });
    return;
  }

  const prompt = [
    'Inspect this image for a surplus food listing.',
    'Set isEdibleFood to false for blank images, memes, non-food spam, or food that is visibly spoiled or inedible.',
    'Never claim food is safe based only on an image; use safetyReason to state visible concerns and remind the user to verify handling, temperature, and condition.',
    'Describe only what is visible. Do not invent dietary certifications or ingredients. Include dietaryTags only when confidently supported by the image.',
    'Choose a concise title and a brief 1-2 sentence description.',
    'Estimate a conservative remaining pickup duration in hours from 0.5 to 48.',
    'Return only the requested JSON object.',
  ].join(' ');

  const endpoint = new URL(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  );

  try {
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: image.mimeType,
                  data: image.imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              isEdibleFood: { type: 'BOOLEAN' },
              safetyReason: { type: 'STRING' },
              title: { type: 'STRING' },
              description: { type: 'STRING' },
              category: {
                type: 'STRING',
                enum: ['bakery', 'produce', 'prepared_meals', 'dairy', 'pantry'],
              },
              storageRequirement: {
                type: 'STRING',
                enum: ['ambient', 'refrigerated', 'frozen'],
              },
              dietaryTags: {
                type: 'ARRAY',
                items: {
                  type: 'STRING',
                  enum: [
                    'vegan',
                    'vegetarian',
                    'gluten_free',
                    'halal',
                    'nut_free',
                  ],
                },
              },
              detectedAllergens: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
              recommendedExpiryHours: { type: 'NUMBER' },
              recommendedPickupWindow: { type: 'STRING' },
            },
            required: [
              'isEdibleFood',
              'safetyReason',
              'title',
              'description',
              'category',
              'storageRequirement',
              'dietaryTags',
              'detectedAllergens',
              'recommendedExpiryHours',
              'recommendedPickupWindow',
            ],
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      console.error(
        'Gemini food inspection failed with status:',
        geminiResponse.status
      );
      res.status(502).json({ error: 'Food inspection provider request failed.' });
      return;
    }

    const data: unknown = await geminiResponse.json();
    if (!isRecord(data) || !Array.isArray(data.candidates)) {
      res.status(502).json({ error: 'Food inspection returned no result.' });
      return;
    }

    const candidate = data.candidates[0];
    if (!isRecord(candidate) || !isRecord(candidate.content)) {
      res.status(502).json({ error: 'Food inspection returned no result.' });
      return;
    }
    const parts = candidate.content.parts;
    if (!Array.isArray(parts)) {
      res.status(502).json({ error: 'Food inspection returned no result.' });
      return;
    }
    const text = parts.find(
      (part): part is Record<string, unknown> =>
        isRecord(part) && typeof part.text === 'string'
    )?.text;
    if (typeof text !== 'string') {
      res.status(502).json({ error: 'Food inspection returned no result.' });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      res.status(502).json({ error: 'Food inspection returned invalid JSON.' });
      return;
    }

    const result = parseInspectionResponse(parsed);
    if (!result) {
      res.status(502).json({ error: 'Food inspection returned invalid fields.' });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Gemini food inspection request failed:', error);
    res.status(502).json({ error: 'Food inspection provider request failed.' });
  }
}
