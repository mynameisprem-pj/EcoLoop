type FoodCategory =
  | 'bakery'
  | 'produce'
  | 'prepared_meals'
  | 'dairy'
  | 'pantry';
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

declare const process: {
  env: Record<string, string | undefined>;
};

const VALID_CATEGORIES: FoodCategory[] = [
  'bakery',
  'produce',
  'prepared_meals',
  'dairy',
  'pantry',
];

const VALID_STORAGE: StorageRequirement[] = [
  'ambient',
  'refrigerated',
  'frozen',
];

const VALID_DIETARY_TAGS: DietaryTag[] = [
  'vegan',
  'vegetarian',
  'gluten_free',
  'halal',
  'nut_free',
];

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeBase64Payload(raw: string): string {
  const trimmed = raw.trim();
  const dataUrlMatch = /^data:[^;]+;base64,(.+)$/i.exec(trimmed);
  return dataUrlMatch ? dataUrlMatch[1].trim() : trimmed;
}

function parseInspectionResponse(value: unknown): InspectionResponse | null {
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
    !VALID_CATEGORIES.includes(category as FoodCategory) ||
    typeof storageRequirement !== 'string' ||
    !VALID_STORAGE.includes(storageRequirement as StorageRequirement) ||
    !Array.isArray(dietaryTags) ||
    !dietaryTags.every(
      (tag) =>
        typeof tag === 'string' && VALID_DIETARY_TAGS.includes(tag as DietaryTag)
    ) ||
    !Array.isArray(detectedAllergens) ||
    !detectedAllergens.every((allergen) => typeof allergen === 'string') ||
    typeof recommendedExpiryHours !== 'number' ||
    !Number.isFinite(recommendedExpiryHours) ||
    recommendedExpiryHours < 0.5 ||
    recommendedExpiryHours > 48 ||
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
    storageRequirement: storageRequirement as StorageRequirement,
    dietaryTags: dietaryTags as DietaryTag[],
    detectedAllergens: detectedAllergens as string[],
    recommendedExpiryHours,
    recommendedPickupWindow,
  };
}

function getImageInput(value: unknown): InspectionRequest | null {
  if (!isRecord(value)) return null;
  const { imageBase64, mimeType } = value;
  if (
    typeof imageBase64 !== 'string' ||
    typeof mimeType !== 'string' ||
    !ALLOWED_MIME_TYPES.has(mimeType)
  ) {
    return null;
  }

  const normalizedBase64 = normalizeBase64Payload(imageBase64);
  if (normalizedBase64.length === 0) {
    return null;
  }

  return { imageBase64: normalizedBase64, mimeType };
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
    res
      .status(400)
      .json({ error: 'A valid imageBase64 and mimeType are required.' });
    return;
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
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
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
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
          response_mime_type: 'application/json',
          response_schema: {
            type: 'OBJECT',
            properties: {
              isEdibleFood: { type: 'BOOLEAN' },
              safetyReason: { type: 'STRING' },
              title: { type: 'STRING' },
              description: { type: 'STRING' },
              category: {
                type: 'STRING',
                enum: VALID_CATEGORIES,
              },
              storageRequirement: {
                type: 'STRING',
                enum: VALID_STORAGE,
              },
              dietaryTags: {
                type: 'ARRAY',
                items: {
                  type: 'STRING',
                  enum: VALID_DIETARY_TAGS,
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
      const errorText = await geminiResponse.text().catch(() => '');
      console.error(
        'Gemini food inspection failed:',
        geminiResponse.status,
        errorText.slice(0, 500)
      );
      res.status(502).json({
        error: 'Food inspection provider request failed.',
        upstreamStatus: geminiResponse.status,
      });
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
      console.error('Gemini returned non-JSON text:', text.slice(0, 300));
      res.status(502).json({ error: 'Food inspection returned invalid JSON.' });
      return;
    }

    const result = parseInspectionResponse(parsed);
    if (!result) {
      console.error('Gemini JSON failed schema validation:', parsed);
      res.status(502).json({ error: 'Food inspection returned invalid fields.' });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Gemini food inspection request failed:', error);
    res.status(502).json({ error: 'Food inspection provider request failed.' });
  }
}