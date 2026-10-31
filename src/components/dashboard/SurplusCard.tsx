// src/components/dashboard/SurplusCard.tsx
import React from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import type { SurplusListing, FoodCategory } from '../../types';
import { useEcoStore } from '../../store/useEcoStore';
import { ExpiryActionBanner } from '../common/ExpiryActionBanner';

interface SurplusCardProps {
  listing: SurplusListing;
  onClaim: (id: string) => void;
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

export const SurplusCard: React.FC<SurplusCardProps> = ({ listing, onClaim }) => {
  const { activeRole, userId } = useEcoStore();
  const visual = CATEGORY_VISUALS[listing.category] || CATEGORY_VISUALS.produce;
  const isOwnListing = listing.donorId === userId;

  const donorInitials = listing.donorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group relative rounded-2xl bg-[#101B18]/85 backdrop-blur-xl border border-emerald-500/35 p-3.5 shadow-[0_0_25px_rgba(16,185,129,0.14)] hover:border-emerald-400/70 hover:shadow-[0_0_30px_rgba(16,185,129,0.28)] transition-all duration-300">
      <div className="flex items-stretch gap-3.5">
        {/* Left Square Food Photo or Category Emblem */}
        <div
          className={`w-24 sm:w-28 rounded-xl bg-gradient-to-br ${visual.bgGradient} border border-white/10 flex flex-col items-center justify-center shrink-0 relative overflow-hidden shadow-inner`}
        >
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="text-3xl sm:text-4xl select-none filter drop-shadow-md transform group-hover:scale-110 transition-transform duration-300">
              {visual.emoji}
            </div>
          )}
          <span className="absolute bottom-1.5 text-[10px] font-bold text-emerald-100 bg-black/70 px-2 py-0.5 rounded-full backdrop-blur-xs border border-white/10">
            {listing.weightKg} kg
          </span>
        </div>

        {/* Center Content & Countdown Bar */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white leading-snug truncate">
                {listing.title}
              </h3>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10 shrink-0">
                {listing.storageRequirement}
              </span>
            </div>

            <p className="text-xs text-slate-300/90 line-clamp-1 mt-0.5">
              {listing.description}
            </p>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-emerald-300/85 mt-1">
              <span className="font-semibold text-white">{listing.donorName}</span>
              <span className="text-slate-500">•</span>
              <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-300">
                <MapPin className="w-3 h-3 text-emerald-400" />
                {listing.location.neighborhood}
              </span>
              <span className="text-slate-500">•</span>
              <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-400">
                <Sparkles className="w-3 h-3" /> {listing.co2SavedKg}kg CO₂
              </span>
            </div>
          </div>

          {/* Bottom Row: Countdown + Rescue Button + Avatar/Distance */}
          <div className="flex items-end gap-3 mt-1">
            <div className="flex-1 min-w-0">
              <ExpiryActionBanner
                expiresAt={listing.expiresAt}
                onRescue={() => onClaim(listing.id)}
                isStoreView={activeRole === 'donor'}
                isOwnListing={isOwnListing}
              />
            </div>

            {/* Right Column: Store Avatar & Real GPS Distance */}
            <div className="flex flex-col items-center justify-end shrink-0 pb-0.5 min-w-[48px]">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-emerald-200">
                  {donorInitials}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-300 mt-1">
                {listing.location.distanceKm !== undefined
                  ? `${listing.location.distanceKm} km`
                  : listing.location.neighborhood}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};