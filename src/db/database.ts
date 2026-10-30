// src/db/database.ts
import Dexie, { type Table } from 'dexie';
import { type SurplusListing, type ClaimRecord, IMPACT_CONSTANTS } from '../types';

export class EcoLoopDatabase extends Dexie {
  listings!: Table<SurplusListing, string>;
  claims!: Table<ClaimRecord, string>;

  constructor() {
    super('EcoLoopProductionDB');

    this.version(1).stores({
      listings: 'id, donorId, category, status, expiresAt, createdAt',
      claims: 'id, listingId, receiverId, status, claimedAt',
    });
  }
}

export const db = new EcoLoopDatabase();

/**
 * Computes environmental impact metrics from food weight in kilograms.
 */
export function calculateListingImpact(weightKg: number) {
  const co2SavedKg = Number(
    (weightKg * IMPACT_CONSTANTS.CO2_KG_PER_FOOD_KG).toFixed(2)
  );
  const estimatedMeals = Math.max(
    1,
    Math.round(weightKg / IMPACT_CONSTANTS.KG_PER_STANDARD_MEAL)
  );
  return { co2SavedKg, estimatedMeals };
}