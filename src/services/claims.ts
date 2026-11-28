import { db } from '../db/database';
import { isCloudConfigured, supabase } from '../lib/supabase';

export const DAILY_CLAIM_LIMIT = 3;

const COUNTED_CLAIM_STATUSES: readonly string[] = [
  'pending_pickup',
  'verified_complete',
  'completed',
] as const;

export async function getTodayClaimCount(userId: string): Promise<number> {
  const now = new Date();
  const startOfTodayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const startOfTomorrowUtc = startOfTodayUtc + 24 * 60 * 60 * 1000;

  if (supabase && isCloudConfigured) {
    const { count, error } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .gte('claimed_at', startOfTodayUtc)
      .lt('claimed_at', startOfTomorrowUtc)
      .in('status', [...COUNTED_CLAIM_STATUSES]);

    if (error) {
      throw new Error(`Could not check today's claim count: ${error.message}`);
    }

    return count ?? 0;
  }

  return db.claims
    .where('receiverId')
    .equals(userId)
    .filter(
      (claim) =>
        claim.claimedAt >= startOfTodayUtc &&
        claim.claimedAt < startOfTomorrowUtc &&
        COUNTED_CLAIM_STATUSES.includes(claim.status)
    )
    .count();
}
