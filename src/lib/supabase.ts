// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SurplusListing, ClaimRecord, AccountProfile, UserRole } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-id')
);

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

type RealtimeStatus = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

interface RealtimeManager {
  channel: RealtimeChannel | null;
  status: RealtimeStatus | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  listenersAttached: boolean;
  onChange: (() => void) | null;
  onStatusChange: ((connected: boolean) => void) | null;
}

declare global {
  var __ecoLoopRealtimeManager: RealtimeManager | undefined;
}

function getRealtimeManager(): RealtimeManager {
  if (!globalThis.__ecoLoopRealtimeManager) {
    globalThis.__ecoLoopRealtimeManager = {
      channel: null,
      status: null,
      retryTimer: null,
      refreshTimer: null,
      pollTimer: null,
      listenersAttached: false,
      onChange: null,
      onStatusChange: null,
    };
  }
  return globalThis.__ecoLoopRealtimeManager;
}

function scheduleRealtimeReconnect(
  manager: RealtimeManager,
  channel: RealtimeChannel,
  client: SupabaseClient
) {
  if (manager.retryTimer) return;

  manager.retryTimer = setTimeout(async () => {
    manager.retryTimer = null;
    try {
      await client.removeChannel(channel);
    } catch (error) {
      console.error('[EcoLoop]: Failed to remove stale realtime channel:', error);
    }
    if (!manager.channel) connectRealtime(manager);
  }, 1500);
}

function scheduleDataRefresh(manager: RealtimeManager) {
  if (manager.refreshTimer) clearTimeout(manager.refreshTimer);
  manager.refreshTimer = setTimeout(() => {
    manager.refreshTimer = null;
    manager.onChange?.();
  }, 200);
}

function connectRealtime(manager: RealtimeManager) {
  if (!supabase || manager.channel || manager.retryTimer) return;

  const client = supabase;
  const channel = client
    .channel('ecoloop-live-network')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'listings' },
      () => scheduleDataRefresh(manager)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'claims' },
      () => scheduleDataRefresh(manager)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => scheduleDataRefresh(manager)
    );

  manager.channel = channel;
  channel.subscribe((status) => {
    if (manager.channel !== channel) return;
    manager.status = status;
    manager.onStatusChange?.(status === 'SUBSCRIBED');

    if (
      status === 'CLOSED' ||
      status === 'CHANNEL_ERROR' ||
      status === 'TIMED_OUT'
    ) {
      manager.channel = null;
      scheduleRealtimeReconnect(manager, channel, client);
    }
  });
}

export function startEcoLoopRealtime(
  onChange: () => void,
  onStatusChange: (connected: boolean) => void
) {
  if (!supabase || !isCloudConfigured) return;

  const manager = getRealtimeManager();
  manager.onChange = onChange;
  manager.onStatusChange = onStatusChange;
  onStatusChange(manager.status === 'SUBSCRIBED');
  connectRealtime(manager);

  if (!manager.listenersAttached && typeof document !== 'undefined') {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') manager.onChange?.();
    };
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    manager.pollTimer = setInterval(refreshIfVisible, 4500);
    manager.listenersAttached = true;
  }
}

export function mapRowToProfile(
  row: Record<string, any>,
  authMode: 'supabase' | 'guest' = 'supabase'
): AccountProfile {
  const verifiedStore = Boolean(row.verified_store);
  return {
    id: String(row.id),
    email: String(row.email || ''),
    displayName: String(row.display_name || 'EcoLoop User'),
    role: (row.role as UserRole) || 'receiver',
    verifiedStore,
    businessRegCode: row.business_reg_code ?? undefined,
    maxWeightCapKg: verifiedStore ? 50 : 5,
    authMode,
  };
}

export function mapProfileToRow(profile: AccountProfile) {
  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.displayName,
    role: profile.role,
    verified_store: profile.verifiedStore,
    business_reg_code: profile.businessRegCode ?? null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Maps a PostgreSQL `listings` row to our TypeScript `SurplusListing` interface
 */
export function mapRowToListing(row: Record<string, any>): SurplusListing {
  return {
    id: row.id,
    donorId: row.donor_id,
    donorName: row.donor_name,
    donorType: row.donor_type,
    title: row.title,
    description: row.description,
    category: row.category,
    dietaryTags: Array.isArray(row.dietary_tags) ? row.dietary_tags : [],
    weightKg: Number(row.weight_kg),
    estimatedMeals: Number(row.estimated_meals),
    co2SavedKg: Number(row.co2_saved_kg),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    pickupWindow: row.pickup_window,
    location: {
      lat: Number(row.lat),
      lng: Number(row.lng),
      address: row.address,
      neighborhood: row.neighborhood,
    },
    status: row.status,
    storageRequirement: row.storage_requirement,
    imageUrl: row.image_url ?? undefined,
    claimedById: row.claimed_by_id ?? undefined,
    claimedByName: row.claimed_by_name ?? undefined,
    claimedAt: row.claimed_at ? Number(row.claimed_at) : undefined,
    pickupCode: row.pickup_code ?? undefined,
  };
}

/**
 * Maps our TypeScript `SurplusListing` to a PostgreSQL `listings` row
 */
export function mapListingToRow(listing: SurplusListing) {
  return {
    id: listing.id,
    donor_id: listing.donorId,
    donor_name: listing.donorName,
    donor_type: listing.donorType,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    dietary_tags: listing.dietaryTags,
    weight_kg: listing.weightKg,
    estimated_meals: listing.estimatedMeals,
    co2_saved_kg: listing.co2SavedKg,
    created_at: listing.createdAt,
    expires_at: listing.expiresAt,
    pickup_window: listing.pickupWindow,
    lat: listing.location.lat,
    lng: listing.location.lng,
    address: listing.location.address,
    neighborhood: listing.location.neighborhood,
    status: listing.status,
    storage_requirement: listing.storageRequirement,
    image_url: listing.imageUrl ?? null,
    claimed_by_id: listing.claimedById ?? null,
    claimed_by_name: listing.claimedByName ?? null,
    claimed_at: listing.claimedAt ?? null,
    pickup_code: listing.pickupCode ?? null,
  };
}

/**
 * Maps a PostgreSQL `claims` row to our TypeScript `ClaimRecord` interface
 */
export function mapRowToClaim(row: Record<string, any>): ClaimRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    donorName: row.donor_name,
    receiverId: row.receiver_id,
    receiverName: row.receiver_name,
    claimedAt: Number(row.claimed_at),
    completedAt: row.completed_at ? Number(row.completed_at) : undefined,
    pickupCode: row.pickup_code,
    status: row.status,
    weightKg: Number(row.weight_kg),
    co2SavedKg: Number(row.co2_saved_kg),
    mealsSaved: Number(row.meals_saved),
  };
}

/**
 * Maps our TypeScript `ClaimRecord` to a PostgreSQL `claims` row
 */
export function mapClaimToRow(claim: ClaimRecord) {
  return {
    id: claim.id,
    listing_id: claim.listingId,
    listing_title: claim.listingTitle,
    donor_name: claim.donorName,
    receiver_id: claim.receiverId,
    receiver_name: claim.receiverName,
    claimed_at: claim.claimedAt,
    completed_at: claim.completedAt ?? null,
    pickup_code: claim.pickupCode,
    status: claim.status,
    weight_kg: claim.weightKg,
    co2_saved_kg: claim.co2SavedKg,
    meals_saved: claim.mealsSaved,
  };
}