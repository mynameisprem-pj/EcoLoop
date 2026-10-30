// src/utils/impactCalculator.ts
import { 
  type SurplusListing, 
  type ClaimRecord, 
  type ImpactMetrics, 
  IMPACT_CONSTANTS 
} from '../types';

export type UrgencyLevel = 'critical' | 'warning' | 'normal' | 'expired';

export interface TimeRemaining {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  urgency: UrgencyLevel;
}

/**
 * Calculates aggregate impact metrics across all completed and active rescues
 */
export function computeAggregateImpact(
  listings: SurplusListing[],
  claims: ClaimRecord[]
): ImpactMetrics {
  const completedListings = listings.filter((l) => l.status === 'completed');
  const activeClaimsCount = claims.filter((c) => c.status === 'pending_pickup').length;

  const totalWeightKg = Number(
    completedListings.reduce((acc, item) => acc + item.weightKg, 0).toFixed(1)
  );
  const totalCo2SavedKg = Number(
    (totalWeightKg * IMPACT_CONSTANTS.CO2_KG_PER_FOOD_KG).toFixed(2)
  );
  const totalMealsSaved = completedListings.reduce(
    (acc, item) => acc + item.estimatedMeals,
    0
  );

  return {
    totalWeightKg,
    totalMealsSaved,
    totalCo2SavedKg,
    activeClaimsCount,
    completedRescuesCount: completedListings.length,
  };
}

/**
 * Computes real-time countdown breakdown and visual urgency tier
 */
export function getExpiryTimeRemaining(expiresAt: number, now = Date.now()): TimeRemaining {
  const totalMs = expiresAt - now;

  if (totalMs <= 0) {
    return {
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'Expired',
      urgency: 'expired',
    };
  }

  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

  // Critical: less than 90 minutes left; Warning: less than 3 hours left
  let urgency: UrgencyLevel = 'normal';
  if (totalMs <= 90 * 60 * 1000) {
    urgency = 'critical';
  } else if (totalMs <= 180 * 60 * 1000) {
    urgency = 'warning';
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatted = hours > 0 
    ? `${hours}h ${pad(minutes)}m ${pad(seconds)}s` 
    : `${minutes}m ${pad(seconds)}s`;

  return {
    totalMs,
    hours,
    minutes,
    seconds,
    formatted,
    urgency,
  };
}

/**
 * Generates a human-readable 6-character alphanumeric verification code for QR handoff
 */
export function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded ambiguous 0, O, 1, I
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ECO-${code}`;
}