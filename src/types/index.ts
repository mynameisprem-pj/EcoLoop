// src/types/index.ts

export type UserRole = 'donor' | 'receiver';

export type FoodCategory = 
  | 'bakery'
  | 'produce'
  | 'prepared_meals'
  | 'dairy'
  | 'pantry';

export type ListingStatus = 
  | 'available'
  | 'claimed'
  | 'completed'
  | 'expired';

export type DietaryTag = 
  | 'vegan'
  | 'vegetarian'
  | 'gluten_free'
  | 'halal'
  | 'nut_free';

export interface GeoLocation {
  lat: number;
  lng: number;
  address: string;
  neighborhood: string;
  distanceKm?: number; // Calculated dynamically relative to active user
}

export interface DonorProfile {
  id: string;
  name: string;
  businessType: 'Bakery' | 'Grocery' | 'Cafe' | 'Restaurant' | 'Community Fridge';
  verified: boolean;
  rating: number;
  location: GeoLocation;
}

// Inside src/types/index.ts -> interface SurplusListing
export interface SurplusListing {
  id: string;
  donorId: string;
  donorName: string;
  donorType: DonorProfile['businessType'];
  title: string;
  description: string;
  category: FoodCategory;
  dietaryTags: DietaryTag[];
  weightKg: number;
  estimatedMeals: number;
  co2SavedKg: number;
  createdAt: number;
  expiresAt: number;
  pickupWindow: string;
  location: GeoLocation;
  status: ListingStatus;
  storageRequirement: 'ambient' | 'refrigerated' | 'frozen';
  imageUrl?: string;              // <-- Real food photo (compressed WebP/JPEG)
  claimedById?: string;
  claimedByName?: string;
  claimedAt?: number;
  pickupCode?: string;
}

export interface ClaimRecord {
  id: string;
  listingId: string;
  listingTitle: string;
  donorName: string;
  receiverId: string;
  receiverName: string;
  claimedAt: number;
  completedAt?: number;
  pickupCode: string;
  status: 'pending_pickup' | 'verified_complete' | 'cancelled';
  weightKg: number;
  co2SavedKg: number;
  mealsSaved: number;
}

export interface ImpactMetrics {
  totalWeightKg: number;
  totalMealsSaved: number;
  totalCo2SavedKg: number;
  activeClaimsCount: number;
  completedRescuesCount: number;
}

// Environmental Conversion Constants (FAO / EPA Standard Approximations)
export const IMPACT_CONSTANTS = {
  CO2_KG_PER_FOOD_KG: 2.5,      // 1 kg of landfill food waste prevented = 2.5 kg CO2e saved
  KG_PER_STANDARD_MEAL: 0.45,   // ~450g per standard nutritious meal
} as const;