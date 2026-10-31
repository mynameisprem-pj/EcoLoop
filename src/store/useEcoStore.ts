// src/store/useEcoStore.ts
import { create } from 'zustand';
import type {
  SurplusListing,
  ClaimRecord,
  FoodCategory,
  DietaryTag,
  UserRole,
  ImpactMetrics,
  DonorProfile,
} from '../types';
import { db, calculateListingImpact } from '../db/database';
import {
  computeAggregateImpact,
  generatePickupCode,
} from '../utils/impactCalculator';
import type { Coordinates } from '../utils/geoUtils';
import {
  supabase,
  isCloudConfigured,
  mapRowToListing,
  mapListingToRow,
  mapRowToClaim,
  mapClaimToRow,
} from '../lib/supabase';

export type SortOption = 'urgency' | 'distance' | 'impact';

interface FilterState {
  searchQuery: string;
  category: FoodCategory | 'all';
  dietaryTags: DietaryTag[];
  maxDistanceKm: number;
  sortBy: SortOption;
}

export interface NewListingInput {
  donorName: string;
  donorType: DonorProfile['businessType'];
  title: string;
  description: string;
  category: FoodCategory;
  dietaryTags: DietaryTag[];
  weightKg: number;
  expiryHours: number;
  pickupWindow: string;
  storageRequirement: 'ambient' | 'refrigerated' | 'frozen';
  address: string;
  neighborhood: string;
  coordinates: Coordinates;
  imageUrl?: string;
}

/**
 * Generates or retrieves a unique persistent ID for this specific phone/browser
 */
function getOrCreateDeviceUserId(): string {
  const storageKey = 'ecoloop_device_user_id';
  let existing = localStorage.getItem(storageKey);
  if (!existing) {
    existing = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(storageKey, existing);
  }
  return existing;
}

interface EcoStoreState {
  listings: SurplusListing[];
  claims: ClaimRecord[];
  impact: ImpactMetrics;
  isInitialized: boolean;
  isLoading: boolean;
  isLiveConnected: boolean;
  error: string | null;

  userLocation: Coordinates | null;
  locationLabel: string;
  locationError: string | null;

  // Unique Device Identity & Role
  userId: string;
  activeRole: UserRole;
  userName: string;

  activeTab: 'browse' | 'post' | 'claims' | 'analytics';
  selectedClaimForModal: ClaimRecord | null;
  filters: FilterState;

  initializeStore: () => Promise<void>;
  refreshData: () => Promise<void>;
  sweepExpiredListings: () => Promise<void>;

  setUserLocation: (coords: Coordinates, label: string) => void;
  setLocationError: (err: string | null) => void;
  setActiveRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
  setActiveTab: (tab: EcoStoreState['activeTab']) => void;
  setSelectedClaimForModal: (claim: ClaimRecord | null) => void;

  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: FoodCategory | 'all') => void;
  toggleDietaryTag: (tag: DietaryTag) => void;
  setMaxDistance: (km: number) => void;
  setSortBy: (sort: SortOption) => void;
  resetFilters: () => void;

  addListing: (input: NewListingInput) => Promise<SurplusListing>;
  claimListing: (
    listingId: string,
    consumerName?: string
  ) => Promise<ClaimRecord | null>;
  verifyPickupCode: (claimId: string, enteredCode: string) => Promise<boolean>;
  cancelClaim: (claimId: string) => Promise<void>;

  // Role-Scoped Selectors
  getFilteredListings: () => SurplusListing[];
  getMyConsumerClaims: () => ClaimRecord[];
  getIncomingStoreClaims: () => ClaimRecord[];
}

const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  category: 'all',
  dietaryTags: [],
  maxDistanceKm: 50,
  sortBy: 'urgency',
};

let realtimeSubscribed = false;

export const useEcoStore = create<EcoStoreState>((set, get) => ({
  listings: [],
  claims: [],
  impact: {
    totalWeightKg: 0,
    totalMealsSaved: 0,
    totalCo2SavedKg: 0,
    activeClaimsCount: 0,
    completedRescuesCount: 0,
  },
  isInitialized: false,
  isLoading: false,
  isLiveConnected: false,
  error: null,

  userLocation: null,
  locationLabel: 'Detecting location...',
  locationError: null,

  userId: getOrCreateDeviceUserId(),
  activeRole: (localStorage.getItem('ecoloop_active_role') as UserRole) || 'receiver',
  userName: localStorage.getItem('ecoloop_user_name') || '',

  activeTab: 'browse',
  selectedClaimForModal: null,
  filters: DEFAULT_FILTERS,

  initializeStore: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      await get().refreshData();
      await get().sweepExpiredListings();

      if (supabase && !realtimeSubscribed) {
        realtimeSubscribed = true;
        supabase
          .channel('ecoloop-live-network')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'listings' },
            () => {
              get().refreshData();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'claims' },
            () => {
              get().refreshData();
            }
          )
          .subscribe((status) => {
            set({ isLiveConnected: status === 'SUBSCRIBED' });
          });
      }

      set({ isInitialized: true, isLoading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to initialize network';
      set({ error: message, isLoading: false, isInitialized: true });
    }
  },

  refreshData: async () => {
    try {
      if (supabase && isCloudConfigured) {
        const [
          { data: cloudListings, error: lErr },
          { data: cloudClaims, error: cErr },
        ] = await Promise.all([
          supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('claims')
            .select('*')
            .order('claimed_at', { ascending: false }),
        ]);

        if (!lErr && !cErr && cloudListings && cloudClaims) {
          const parsedListings = cloudListings.map(mapRowToListing);
          const parsedClaims = cloudClaims.map(mapRowToClaim);

          await db.transaction('rw', db.listings, db.claims, async () => {
            await db.listings.clear();
            await db.claims.clear();
            await db.listings.bulkPut(parsedListings);
            await db.claims.bulkPut(parsedClaims);
          });

          const impact = computeAggregateImpact(parsedListings, parsedClaims);
          set({ listings: parsedListings, claims: parsedClaims, impact });
          return;
        }
      }

      const [localListings, localClaims] = await Promise.all([
        db.listings.orderBy('createdAt').reverse().toArray(),
        db.claims.orderBy('claimedAt').reverse().toArray(),
      ]);

      const impact = computeAggregateImpact(localListings, localClaims);
      set({ listings: localListings, claims: localClaims, impact });
    } catch (err) {
      console.error('[EcoLoop]: Sync error:', err);
    }
  },

  sweepExpiredListings: async () => {
    const now = Date.now();
    try {
      const expired = get().listings.filter(
        (item) => item.status === 'available' && item.expiresAt <= now
      );
      if (expired.length === 0) return;

      const expiredIds = expired.map((i) => i.id);

      if (supabase && isCloudConfigured) {
        await supabase
          .from('listings')
          .update({ status: 'expired' })
          .in('id', expiredIds);
      }

      await db.listings
        .where('id')
        .anyOf(expiredIds)
        .modify({ status: 'expired' });
      await get().refreshData();
    } catch (err) {
      console.error('[EcoLoop]: Expiry sweep error:', err);
    }
  },

  setUserLocation: (coords, label) =>
    set({ userLocation: coords, locationLabel: label, locationError: null }),

  setLocationError: (err) => set({ locationError: err }),

  setActiveRole: (role) => {
    localStorage.setItem('ecoloop_active_role', role);
    set({
      activeRole: role,
      activeTab: role === 'donor' ? 'post' : 'browse',
    });
  },

  setUserName: (name) => {
    localStorage.setItem('ecoloop_user_name', name);
    set({ userName: name });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedClaimForModal: (claim) => set({ selectedClaimForModal: claim }),

  setSearchQuery: (searchQuery) =>
    set((state) => ({ filters: { ...state.filters, searchQuery } })),

  setCategoryFilter: (category) =>
    set((state) => ({ filters: { ...state.filters, category } })),

  toggleDietaryTag: (tag) =>
    set((state) => {
      const exists = state.filters.dietaryTags.includes(tag);
      const dietaryTags = exists
        ? state.filters.dietaryTags.filter((t) => t !== tag)
        : [...state.filters.dietaryTags, tag];
      return { filters: { ...state.filters, dietaryTags } };
    }),

  setMaxDistance: (maxDistanceKm) =>
    set((state) => ({ filters: { ...state.filters, maxDistanceKm } })),

  setSortBy: (sortBy) =>
    set((state) => ({ filters: { ...state.filters, sortBy } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  /**
   * Publishes a listing linked to THIS device's unique `userId` as `donorId`
   */
  addListing: async (input: NewListingInput) => {
    const { userId } = get();
    const now = Date.now();
    const { co2SavedKg, estimatedMeals } = calculateListingImpact(input.weightKg);

    const newListing: SurplusListing = {
      id: `lst-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      donorId: userId, // <-- Tied to this Store Partner phone!
      donorName: input.donorName.trim(),
      donorType: input.donorType,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      dietaryTags: input.dietaryTags,
      weightKg: input.weightKg,
      estimatedMeals,
      co2SavedKg,
      createdAt: now,
      expiresAt: now + input.expiryHours * 60 * 60 * 1000,
      pickupWindow: input.pickupWindow.trim(),
      location: {
        lat: input.coordinates.lat,
        lng: input.coordinates.lng,
        address: input.address.trim(),
        neighborhood: input.neighborhood.trim(),
      },
      status: 'available',
      storageRequirement: input.storageRequirement,
      imageUrl: input.imageUrl,
    };

    if (supabase && isCloudConfigured) {
      const { error } = await supabase
        .from('listings')
        .insert(mapListingToRow(newListing));
      if (error) throw new Error(error.message);
    }

    await db.listings.put(newListing);
    await get().refreshData();
    set({ activeTab: 'browse' });
    return newListing;
  },

  /**
   * Claims a listing linked to THIS consumer device's unique `userId` as `receiverId`
   */
  claimListing: async (listingId: string, consumerName?: string) => {
    const { userId, userName, activeRole } = get();

    if (activeRole === 'donor') {
      set({ error: 'Switch to Consumer Mode to claim surplus food.' });
      return null;
    }

    const claimant =
      consumerName?.trim() || userName.trim() || 'Community Consumer';
    const now = Date.now();
    const pickupCode = generatePickupCode();

    try {
      const target = get().listings.find((l) => l.id === listingId);
      if (!target || target.status !== 'available') {
        throw new Error('This listing has just been claimed by someone else.');
      }

      if (target.donorId === userId) {
        throw new Error('You cannot claim your own store listing.');
      }

      const newClaim: ClaimRecord = {
        id: `clm-${now.toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        listingId: target.id,
        listingTitle: target.title,
        donorName: target.donorName,
        receiverId: userId, // <-- Tied strictly to this Consumer's phone!
        receiverName: claimant,
        claimedAt: now,
        pickupCode,
        status: 'pending_pickup',
        weightKg: target.weightKg,
        co2SavedKg: target.co2SavedKg,
        mealsSaved: target.estimatedMeals,
      };

      if (supabase && isCloudConfigured) {
        const { data: updatedRows, error: updateErr } = await supabase
          .from('listings')
          .update({
            status: 'claimed',
            claimed_by_id: userId,
            claimed_by_name: claimant,
            claimed_at: now,
            pickup_code: pickupCode,
          })
          .eq('id', listingId)
          .eq('status', 'available')
          .select();

        if (updateErr || !updatedRows || updatedRows.length === 0) {
          throw new Error('Listing was just claimed by another user.');
        }

        const { error: claimErr } = await supabase
          .from('claims')
          .insert(mapClaimToRow(newClaim));
        if (claimErr) throw new Error(claimErr.message);
      }

      await db.transaction('rw', db.listings, db.claims, async () => {
        await db.listings.update(listingId, {
          status: 'claimed',
          claimedById: userId,
          claimedByName: claimant,
          claimedAt: now,
          pickupCode,
        });
        await db.claims.put(newClaim);
      });

      await get().refreshData();
      set({ selectedClaimForModal: newClaim });
      return newClaim;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to claim listing';
      set({ error: message });
      return null;
    }
  },

  verifyPickupCode: async (claimId: string, enteredCode: string) => {
    const normalizedInput = enteredCode.trim().toUpperCase();
    const now = Date.now();

    try {
      const claim = get().claims.find((c) => c.id === claimId);
      if (!claim) return false;

      if (claim.pickupCode.toUpperCase() !== normalizedInput) {
        return false;
      }

      if (supabase && isCloudConfigured) {
        await Promise.all([
          supabase
            .from('claims')
            .update({ status: 'verified_complete', completed_at: now })
            .eq('id', claimId),
          supabase
            .from('listings')
            .update({ status: 'completed' })
            .eq('id', claim.listingId),
        ]);
      }

      await db.transaction('rw', db.listings, db.claims, async () => {
        await db.claims.update(claimId, {
          status: 'verified_complete',
          completedAt: now,
        });
        await db.listings.update(claim.listingId, {
          status: 'completed',
        });
      });

      await get().refreshData();
      const updated = get().claims.find((c) => c.id === claimId) || null;
      set({ selectedClaimForModal: updated });
      return true;
    } catch (err) {
      console.error('[EcoLoop]: Error verifying pickup code:', err);
      return false;
    }
  },

  cancelClaim: async (claimId: string) => {
    try {
      const claim = get().claims.find((c) => c.id === claimId);
      if (!claim) return;

      if (supabase && isCloudConfigured) {
        await Promise.all([
          supabase
            .from('claims')
            .update({ status: 'cancelled' })
            .eq('id', claimId),
          supabase
            .from('listings')
            .update({
              status: 'available',
              claimed_by_id: null,
              claimed_by_name: null,
              claimed_at: null,
              pickup_code: null,
            })
            .eq('id', claim.listingId),
        ]);
      }

      await db.transaction('rw', db.listings, db.claims, async () => {
        await db.claims.update(claimId, { status: 'cancelled' });
        await db.listings.update(claim.listingId, {
          status: 'available',
          claimedById: undefined,
          claimedByName: undefined,
          claimedAt: undefined,
          pickupCode: undefined,
        });
      });

      await get().refreshData();
      set({ selectedClaimForModal: null });
    } catch (err) {
      console.error('[EcoLoop]: Failed to cancel claim:', err);
    }
  },

  /**
   * Returns only claims made by THIS Consumer device
   */
  getMyConsumerClaims: () => {
    const { claims, userId } = get();
    return claims.filter((c) => c.receiverId === userId);
  },

  /**
   * Returns only claims placed on listings owned by THIS Store Partner device
   */
  getIncomingStoreClaims: () => {
    const { claims, listings, userId, userName } = get();
    const myStoreListingIds = new Set(
      listings
        .filter(
          (l) =>
            l.donorId === userId ||
            (userName.trim() !== '' &&
              l.donorName.toLowerCase() === userName.trim().toLowerCase())
        )
        .map((l) => l.id)
    );
    return claims.filter((c) => myStoreListingIds.has(c.listingId));
  },

  getFilteredListings: () => {
    const { listings, filters } = get();
    const now = Date.now();

    return listings.filter((item) => {
      if (item.status !== 'available' || item.expiresAt <= now) return false;

      if (filters.category !== 'all' && item.category !== filters.category) {
        return false;
      }

      if (filters.dietaryTags.length > 0) {
        const hasAllTags = filters.dietaryTags.every((tag) =>
          item.dietaryTags.includes(tag)
        );
        if (!hasAllTags) return false;
      }

      if (filters.searchQuery.trim() !== '') {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDonor = item.donorName.toLowerCase().includes(q);
        const matchNeighborhood = item.location.neighborhood
          .toLowerCase()
          .includes(q);
        const matchAddress = item.location.address.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        if (
          !matchTitle &&
          !matchDonor &&
          !matchNeighborhood &&
          !matchAddress &&
          !matchDesc
        ) {
          return false;
        }
      }

      return true;
    });
  },
}));