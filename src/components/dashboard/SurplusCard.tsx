// src/components/dashboard/SurplusCard.tsx
import React from 'react';
import { Navigation, Sparkles, Check, ExternalLink } from 'lucide-react';
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
  const { activeRole, userId } = useEcoStore();
  const visual = CATEGORY_VISUALS[listing.category] || CATEGORY_VISUALS.produce;
  const isOwnListing = listing.donorId === userId;
  const isConsumer = activeRole === 'receiver' && !isOwnListing;

  // Format distance cleanly (meters if under 1 km, otherwise km)
  const formatDistance = (km?: number) => {
    if (km === undefined || Number.isNaN(km)) return 'Track Route';
    if (km < 0.05) return 'Nearby (<50m)';
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    return `${km.toFixed(1)} km away`;
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
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10 shrink-0">
              {listing.storageRequirement}
            </span>
          </div>

          <p className="text-xs text-slate-300/90 line-clamp-1 mt-0.5">
            {listing.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-1.5">
            <span className="font-semibold text-emerald-300">
              {listing.donorName}
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

      {/* Bottom Action Row: Timer + Clickable Distance Map Tracker + Claim Button */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
        <ExpiryActionBanner expiresAt={listing.expiresAt} />

        <div className="flex items-center gap-2 ml-auto">
          {/* Clickable Distance Pill -> Opens Map & Tracks Human-to-Store Route */}
          <button
            type="button"
            onClick={() => onTrackOnMap(listing)}
            title="Click to track route from your location to this store on the map"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/15 hover:border-emerald-400/50 text-xs font-semibold text-emerald-300 transition-all cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{formatDistance(listing.location.distanceKm)}</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </button>

          {/* Clean Non-Overlapping Claim Button (Only for Consumers) */}
          {isConsumer && (
            <button
              type="button"
              onClick={() => onClaim(listing.id)}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Claim
            </button>
          )}
        </div>
      </div>
    </div>
  );
};