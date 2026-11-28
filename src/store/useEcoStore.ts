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
  AccountProfile,
} from '../types';
import { db, calculateListingImpact } from '../db/database';
import {
  computeAggregateImpact,
  generatePickupCode,
} from '../utils/impactCalculator';
import { SAVED_LOCATION_KEY } from '../utils/geoUtils';
import type { Coordinates } from '../utils/geoUtils';
import {
  supabase,
  isCloudConfigured,
  mapRowToListing,
  mapListingToRow,
  mapRowToClaim,
  mapClaimToRow,
  mapRowToProfile,
  mapProfileToRow,
  startEcoLoopRealtime,
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

function getOrCreateDeviceUserId(): string {
  const storageKey = 'ecoloop_device_user_id';
  let existing = localStorage.getItem(storageKey);
  if (!existing) {
    existing = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(storageKey, existing);
  }
  return existing;
}

function getOrCreateGuestUserId(): string {
  const storageKey = 'ecoloop_guest_user_id';
  let existing = localStorage.getItem(storageKey);
  if (!existing) {
    existing = `guest-${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, existing);
  }
  return existing;
}

const OWN_LISTING_IDS_KEY = 'ecoloop_own_listing_ids';

function getOwnListingIds(): string[] {
  const stored = localStorage.getItem(OWN_LISTING_IDS_KEY);
  return stored ? stored.split('\n').filter(Boolean) : [];
}

interface EcoStoreState {
  listings: SurplusListing[];
  claims: ClaimRecord[];
  ownListingIds: string[];
  verifiedDonorIds: string[];
  impact: ImpactMetrics;
  isInitialized: boolean;
  isLoading: boolean;
  isLiveConnected: boolean;
  error: string | null;

  userLocation: Coordinates | null;
  locationLabel: string;
  locationError: string | null;

  userId: string;
  activeRole: UserRole;
  userName: string;
  currentUser: AccountProfile | null;
  authModalOpen: boolean;
  pendingAuthAction: (() => void) | null;

  activeTab: 'browse' | 'post' | 'claims' | 'analytics';
  selectedClaimForModal: ClaimRecord | null;
  trackedListing: SurplusListing | null;
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
  setTrackedListing: (listing: SurplusListing | null) => void;

  setAuthModalOpen: (open: boolean, afterAuth?: () => void) => void;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: () => Promise<void>;
  signOutAccount: () => Promise<void>;

  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: FoodCategory | 'all') => void;
  toggleDietaryTag: (tag: DietaryTag) => void;
  setMaxDistance: (km: number) => void;
  setSortBy: (sort: SortOption) => void;
  resetFilters: () => void;

  addListing: (input: NewListingInput) => Promise<SurplusListing | null>;
  claimListing: (
    listingId: string,
    consumerName?: string
  ) => Promise<ClaimRecord | null>;
  verifyPickupCode: (claimId: string, enteredCode: string) => Promise<boolean>;
  cancelClaim: (claimId: string) => Promise<void>;
  deleteOrReportListing: (listingId: string) => Promise<void>;

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

let authListenerAttached = false;
let ownListingStorageListenerAttached = false;
let refreshSequence = 0;

async function hydrateProfileFromCloud(
  uid: string,
  email: string,
  fallbackName: string,
  role: UserRole,
  authMode: 'supabase' | 'guest',
  defaultVerified: boolean,
  set: (partial: Partial<EcoStoreState>) => void,
  refreshData: () => Promise<void>
) {
  let profile: AccountProfile = {
    id: uid,
    email,
    displayName: fallbackName || email.split('@')[0] || 'EcoLoop Member',
    role,
    verifiedStore: defaultVerified,
    maxWeightCapKg: defaultVerified ? 50 : 5,
    authMode,
  };

  if (supabase && isCloudConfigured && authMode === 'supabase') {
    const { data: existingRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (existingRow) {
      profile = mapRowToProfile(existingRow, authMode);
      if (fallbackName.trim() && existingRow.display_name !== fallbackName.trim()) {
        profile.displayName = fallbackName.trim();
        await supabase.from('profiles').upsert(mapProfileToRow(profile));
      }
    } else {
      await supabase.from('profiles').upsert(mapProfileToRow(profile));
    }
  }

  localStorage.setItem('ecoloop_user_name', profile.displayName);

  set({
    userId: uid,
    userName: profile.displayName,
    currentUser: profile,
  });

  await refreshData();
}

export const useEcoStore = create<EcoStoreState>((set, get) => ({
  listings: [],
  claims: [],
  ownListingIds: getOwnListingIds(),
  verifiedDonorIds: ['demo-judge-01'],
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
  activeRole:
    (localStorage.getItem('ecoloop_active_role') as UserRole) || 'receiver',
  userName: localStorage.getItem('ecoloop_user_name') || '',
  currentUser: null,
  authModalOpen: false,
  pendingAuthAction: null,

  activeTab: 'browse',
  selectedClaimForModal: null,
  trackedListing: null,
  filters: DEFAULT_FILTERS,

  initializeStore: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      if (!ownListingStorageListenerAttached) {
        window.addEventListener('storage', (event) => {
          if (event.key === OWN_LISTING_IDS_KEY) {
            set({ ownListingIds: getOwnListingIds() });
          }
        });
        ownListingStorageListenerAttached = true;
      }

      await get().refreshData();
      await get().sweepExpiredListings();

      if (supabase && isCloudConfigured && !authListenerAttached) {
        authListenerAttached = true;
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          const u = sessionData.session.user;
          await hydrateProfileFromCloud(
            u.id,
            u.email || '',
            u.user_metadata?.full_name || u.email?.split('@')[0] || '',
            get().activeRole,
            'supabase',
            false,
            set,
            get().refreshData
          );
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const u = session.user;
            const action = get().pendingAuthAction;
            await hydrateProfileFromCloud(
              u.id,
              u.email || '',
              u.user_metadata?.full_name || u.email?.split('@')[0] || '',
              get().activeRole,
              'supabase',
              false,
              set,
              get().refreshData
            );
            set({ authModalOpen: false, pendingAuthAction: null });
            if (action) action();
          } else if (event === 'SIGNED_OUT') {
            const deviceId = getOrCreateDeviceUserId();
            set({
              userId: deviceId,
              currentUser: null,
              authModalOpen: false,
              pendingAuthAction: null,
            });
            await get().refreshData();
          }
        });
      }

      if (supabase && isCloudConfigured) {
        startEcoLoopRealtime(
          () => {
            void get().refreshData();
          },
          (isLiveConnected) => set({ isLiveConnected })
        );
      }

      set({ isInitialized: true, isLoading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to initialize network';
      set({ error: message, isLoading: false, isInitialized: true });
    }
  },

  refreshData: async () => {
    const requestId = ++refreshSequence;
    try {
      if (supabase && isCloudConfigured) {
        const [
          { data: cloudListings, error: lErr },
          { data: cloudClaims, error: cErr },
          { data: cloudProfiles },
        ] = await Promise.all([
          supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('claims')
            .select('*')
            .order('claimed_at', { ascending: false }),
          supabase.from('profiles').select('id, verified_store'),
        ]);

        if (requestId !== refreshSequence) return;

        const verifiedIds = new Set<string>(['demo-judge-01']);
        if (cloudProfiles) {
          for (const p of cloudProfiles) {
            if (p.verified_store && p.id) {
              verifiedIds.add(String(p.id));
            }
          }
        }
        const cur = get().currentUser;
        if (cur?.verifiedStore) {
          verifiedIds.add(cur.id);
        }

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
          if (requestId !== refreshSequence) return;
          const selectedClaim = get().selectedClaimForModal;
          set({
            listings: parsedListings,
            claims: parsedClaims,
            selectedClaimForModal: selectedClaim
              ? parsedClaims.find((claim) => claim.id === selectedClaim.id) || null
              : null,
            verifiedDonorIds: Array.from(verifiedIds),
            impact,
          });
          return;
        }
      }

      const [localListings, localClaims] = await Promise.all([
        db.listings.orderBy('createdAt').reverse().toArray(),
        db.claims.orderBy('claimedAt').reverse().toArray(),
      ]);

      const verifiedIds = new Set<string>(get().verifiedDonorIds);
      if (get().currentUser?.verifiedStore) {
        verifiedIds.add(get().currentUser!.id);
      }

      const impact = computeAggregateImpact(localListings, localClaims);
      if (requestId !== refreshSequence) return;
      const selectedClaim = get().selectedClaimForModal;
      set({
        listings: localListings,
        claims: localClaims,
        selectedClaimForModal: selectedClaim
          ? localClaims.find((claim) => claim.id === selectedClaim.id) || null
          : null,
        verifiedDonorIds: Array.from(verifiedIds),
        impact,
      });
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

  setUserLocation: (coords, label) => {
    localStorage.setItem(
      SAVED_LOCATION_KEY,
      JSON.stringify({ coords, label })
    );
    set({ userLocation: coords, locationLabel: label, locationError: null });
  },

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
    set((s) => ({
      userName: name,
      currentUser: s.currentUser ? { ...s.currentUser, displayName: name } : null,
    }));
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedClaimForModal: (claim) =>
    set({
      selectedClaimForModal: claim
        ? get().claims.find((current) => current.id === claim.id) || claim
        : null,
    }),
  setTrackedListing: (listing) => set({ trackedListing: listing }),

  setAuthModalOpen: (open, afterAuth) =>
    set({
      authModalOpen: open,
      pendingAuthAction: open ? afterAuth || null : null,
    }),

  signInWithGoogle: async () => {
    if (!supabase || !isCloudConfigured) {
      throw new Error('Supabase cloud is not configured.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(error.message);
  },

  signInAsDemo: async () => {
    const guestId = getOrCreateGuestUserId();
    await hydrateProfileFromCloud(
      guestId,
      'demo-judge@ecoloop.app',
      'Judge Demo',
      get().activeRole,
      'guest',
      true,
      set,
      get().refreshData
    );

    const action = get().pendingAuthAction;
    set({ authModalOpen: false, pendingAuthAction: null, error: null });
    if (action) action();
  },

  signOutAccount: async () => {
    if (
      supabase &&
      isCloudConfigured &&
      get().currentUser?.authMode === 'supabase'
    ) {
      await supabase.auth.signOut();
    }
    const deviceId = getOrCreateDeviceUserId();
    set({
      userId: deviceId,
      currentUser: null,
      authModalOpen: false,
      pendingAuthAction: null,
    });
    await get().refreshData();
  },

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

  addListing: async (input: NewListingInput) => {
    const { userId: storedUserId, currentUser } = get();
    const userId = currentUser?.id || storedUserId;

    if (!currentUser) {
      get().setAuthModalOpen(true, () => {
        get().addListing(input);
      });
      return null;
    }

    const capKg = currentUser.maxWeightCapKg;
    if (!currentUser.verifiedStore && input.weightKg > capKg) {
      const msg = `Unverified Community Donor limit is ${capKg} kg. Verify your store badge to publish up to 50 kg.`;
      set({ error: msg });
      throw new Error(msg);
    }

    const now = Date.now();
    const { co2SavedKg, estimatedMeals } = calculateListingImpact(input.weightKg);

    const newListing: SurplusListing = {
      id: `lst-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      donorId: userId,
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
    const ownListingIds = Array.from(
      new Set([...getOwnListingIds(), newListing.id])
    );
    localStorage.setItem(OWN_LISTING_IDS_KEY, ownListingIds.join('\n'));
    set({ ownListingIds });
    await get().refreshData();
    set({ activeTab: 'browse', error: null });
    return newListing;
  },

  claimListing: async (listingId: string, consumerName?: string) => {
    const {
      userId: storedUserId,
      userName,
      activeRole,
      currentUser,
    } = get();
    const userId = currentUser?.id || storedUserId;

    if (getOwnListingIds().includes(listingId)) {
      const message = 'You cannot claim a listing published from this browser.';
      set({ error: message });
      return null;
    }

    if (!currentUser) {
      get().setAuthModalOpen(true, () => {
        get().claimListing(listingId, consumerName);
      });
      return null;
    }

    if (activeRole === 'donor') {
      set({ error: 'Switch to Consumer Mode to claim surplus food.' });
      return null;
    }

    const claimant =
      consumerName?.trim() ||
      currentUser.displayName ||
      userName.trim() ||
      'Community Consumer';
    const now = Date.now();
    const pickupCode = generatePickupCode();

    try {
      const target = get().listings.find((l) => l.id === listingId);
      if (!target || target.status !== 'available') {
        throw new Error('This listing has just been claimed by someone else.');
      }

      const newClaim: ClaimRecord = {
        id: `clm-${now.toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        listingId: target.id,
        listingTitle: target.title,
        donorName: target.donorName,
        receiverId: userId,
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
    const { userId: storedUserId, userName, listings, currentUser } = get();
    const userId = currentUser?.id || storedUserId;

    try {
      const claim = get().claims.find((c) => c.id === claimId);
      if (!claim) return false;

      const parentListing = listings.find((l) => l.id === claim.listingId);
      const isStoreOwner =
        parentListing &&
        (parentListing.donorId === userId ||
          (userName.trim() !== '' &&
            parentListing.donorName.toLowerCase() ===
              userName.trim().toLowerCase()));

      if (!isStoreOwner) {
        set({ error: 'Only the store that created this listing can verify pickup QR/codes.' });
        return false;
      }

      if (claim.pickupCode.toUpperCase() !== normalizedInput) {
        return false;
      }

      if (supabase && isCloudConfigured) {
        const [{ error: claimError }, { error: listingError }] = await Promise.all([
          supabase
            .from('claims')
            .update({ status: 'verified_complete', completed_at: now })
            .eq('id', claimId),
          supabase
            .from('listings')
            .update({ status: 'completed' })
            .eq('id', claim.listingId),
        ]);
        if (claimError || listingError) {
          throw new Error(
            claimError?.message || listingError?.message || 'Pickup verification failed.'
          );
        }
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
        const [{ error: claimError }, { error: listingError }] = await Promise.all([
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
        if (claimError || listingError) {
          throw new Error(
            claimError?.message || listingError?.message || 'Claim cancellation failed.'
          );
        }
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

  deleteOrReportListing: async (listingId: string) => {
    const { userId: storedUserId, userName, listings, currentUser } = get();
    const userId = currentUser?.id || storedUserId;
    try {
      const target = listings.find((l) => l.id === listingId);
      const isOwner =
        target &&
        (target.donorId === userId ||
          (userName.trim() !== '' &&
            target.donorName.toLowerCase() === userName.trim().toLowerCase()));

      if (!isOwner) {
        set({ error: 'Only the store owner who published this listing can delete it.' });
        return;
      }

      if (supabase && isCloudConfigured) {
        await supabase.from('listings').delete().eq('id', listingId);
      }
      await db.listings.delete(listingId);
      await get().refreshData();
    } catch (err) {
      console.error('[EcoLoop]: Failed to remove listing:', err);
    }
  },

  getMyConsumerClaims: () => {
    const { claims, userId, currentUser } = get();
    const effectiveUserId = currentUser?.id || userId;
    return claims.filter((c) => c.receiverId === effectiveUserId);
  },

  getIncomingStoreClaims: () => {
    const { claims, listings, userId, userName, currentUser } = get();
    const effectiveUserId = currentUser?.id || userId;
    const myStoreListingIds = new Set(
      listings
        .filter(
          (l) =>
            l.donorId === effectiveUserId ||
            (userName.trim() !== '' &&
              l.donorName.toLowerCase() === userName.trim().toLowerCase())
        )
        .map((l) => l.id)
    );
    return claims.filter((c) => myStoreListingIds.has(c.listingId));
  },

  getFilteredListings: () => {
    const { listings, filters, verifiedDonorIds } = get();
    const now = Date.now();
    const verifiedSet = new Set(verifiedDonorIds);

    return listings
      .filter((item) => {
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
      })
      .sort((a, b) => {
        const aVer = verifiedSet.has(a.donorId) ? 1 : 0;
        const bVer = verifiedSet.has(b.donorId) ? 1 : 0;
        if (aVer !== bVer) return bVer - aVer;
        return a.expiresAt - b.expiresAt;
      });
  },
}));