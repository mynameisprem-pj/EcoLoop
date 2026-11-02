// src/components/dashboard/SurplusCard.tsx
import React, { useState } from 'react';
import {
  Navigation,
  Sparkles,
  Check,
  BadgeCheck,
  Trash2,
  Flag,
} from 'lucide-react';
import type { SurplusListing, FoodCategory } from '../../types';
import { ExpiryActionBanner } from '../common/ExpiryActionBanner';
import { useEcoStore } from '../../store/useEcoStore';

interface SurplusCardProps {
  listing: SurplusListing;
  onClaim: (id: string) => void;
  onTrackOnMap: (listing: SurplusListing) => void;
}

const CATEGORY_VISUALS: Record<
  FoodCategory,
  { emoji: string; label: string; bgGradient: string }
> = {
  produce: {
    emoji: '🥬🥕🍅',
    label: 'Fresh Produce',
    bgGradient: 'from-emerald-900/60 to-teal-950/80',
  },
  bakery: {
    emoji: '🥐🥖🥨',
    label: 'Baked Goods',
    bgGradient: 'from-amber-900/50 to-stone-900/80',
  },
  prepared_meals: {
    emoji: '🍲🍛🥗',
    label: 'Prepared Meals',
    bgGradient: 'from-orange-900/50 to-slate-900/80',
  },
  dairy: {
    emoji: '🥛🧀🥣',
    label: 'Dairy & Chilled',
    bgGradient: 'from-cyan-900/50 to-slate-900/80',
  },
  pantry: {
    emoji: '🛍️🌾🥫',
    label: 'Pantry Groceries',
    bgGradient: 'from-lime-900/50 to-slate-900/80',
  },
};

export const SurplusCard: React.FC<SurplusCardProps> = ({
  listing,
  onClaim,
  onTrackOnMap,
}) => {
  const { activeRole, userId, listings, deleteOrReportListing } = useEcoStore();
  const [confirmAction, setConfirmAction] = useState<'delete' | 'report' | null>(
    null
  );

  const visual = CATEGORY_VISUALS[listing.category] || CATEGORY_VISUALS.produce;
  const isOwnListing = listing.donorId === userId;
  const isConsumer = activeRole === 'receiver' && !isOwnListing;

  // A store earns the Verified Badge if it has completed at least 1 QR-verified rescue
  // OR if the listing includes a live food photo and valid GPS coordinates
  const hasCompletedRescues = listings.some(
    (l) =>
      l.status === 'completed' &&
      (l.donorId === listing.donorId ||
        l.donorName.toLowerCase() === listing.donorName.toLowerCase())
  );
  const isVerifiedStore =
    hasCompletedRescues || Boolean(listing.imageUrl && listing.location.lat !== 0);

  const formatDistance = (km?: number) => {
    if (km === undefined || Number.isNaN(km)) return 'Track Route';
    if (km < 0.05) return 'Nearby (<50m)';
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    return `${km.toFixed(1)} km away`;
  };

  const handleConfirmRemoval = async () => {
    await deleteOrReportListing(listing.id);
    setConfirmAction(null);
  };

  return (
    <div className="group relative rounded-2xl bg-[#101B18]/90 backdrop-blur-xl border border-emerald-500/30 p-3.5 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:border-emerald-400/60 transition-all duration-300">
      <div className="flex items-start gap-3.5">
        {/* Left Square Thumbnail */}
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br ${visual.bgGradient} border border-white/10 flex flex-col items-center justify-center shrink-0 relative overflow-hidden`}
        >
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-2xl sm:text-3xl select-none">{visual.emoji}</div>
          )}
          <span className="absolute bottom-1 text-[10px] font-bold text-emerald-100 bg-black/75 px-2 py-0.5 rounded-full border border-white/10">
            {listing.weightKg} kg
          </span>
        </div>

        {/* Right Details Column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white leading-snug truncate">
              {listing.title}
            </h3>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10">
                {listing.storageRequirement}
              </span>

              {/* Store Owner Delete Button OR Consumer Report Fake Button */}
              {isOwnListing ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction('delete')}
                  title="Delete your store listing"
                  className="p-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmAction('report')}
                  title="Report fake or unavailable listing"
                  className="p-1 rounded-lg bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-300/90 line-clamp-1 mt-0.5">
            {listing.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-1.5">
            <span className="font-semibold text-emerald-300 inline-flex items-center gap-1">
              {listing.donorName}
              {isVerifiedStore && (
                <span
                  title="Verified Store Partner (GPS & Photo/History Verified)"
                  className="inline-flex items-center text-emerald-400"
                >
                  <BadgeCheck className="w-3.5 h-3.5 fill-emerald-500/20" />
                </span>
              )}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300 text-[11px]">
              {listing.location.neighborhood}
            </span>
            <span className="text-slate-500">•</span>
            <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-400 font-medium">
              <Sparkles className="w-3 h-3" /> {listing.co2SavedKg}kg CO₂
            </span>
          </div>
        </div>
      </div>

      {/* Inline Confirmation Bar when Delete or Report Fake is clicked */}
      {confirmAction && (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-2 text-xs">
          <span className="text-rose-200 font-medium">
            {confirmAction === 'delete'
              ? 'Remove this listing from the marketplace?'
              : 'Report & remove this listing as fake or unavailable?'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 hover:bg-white/15 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRemoval}
              className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold cursor-pointer"
            >
              {confirmAction === 'delete' ? 'Delete' : 'Confirm Report'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Action Row: Timer + Consumer-Only Track & Claim Controls */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
        <ExpiryActionBanner expiresAt={listing.expiresAt} />

        <div className="flex items-center gap-2 ml-auto">
          {isConsumer ? (
            <>
              <button
                type="button"
                onClick={() => onTrackOnMap(listing)}
                title="Click to track live walking route inside the app"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/15 hover:border-emerald-400/50 text-xs font-semibold text-emerald-300 transition-all cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{formatDistance(listing.location.distanceKm)} • Track</span>
              </button>

              <button
                type="button"
                onClick={() => onClaim(listing.id)}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Claim
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-300">
              ● Live Store Listing ({listing.location.neighborhood})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};