// src/components/dashboard/LiveStreetMap.tsx
import React, { useState, useEffect } from 'react';
import type { SurplusListing } from '../../types';
import { type Coordinates, calculateDistanceKm, isValidCoordinate } from '../../utils/geoUtils';
import {
  Navigation,
  ExternalLink,
  MapPin,
  Check,
  Compass,
  Layers,
} from 'lucide-react';

interface LiveStreetMapProps {
  listings: SurplusListing[];
  userLocation: Coordinates;
  trackedListing: SurplusListing | null;
  onClearTracking?: () => void;
  onClaim: (listingId: string) => void;
  isVisible?: boolean;
}

export const LiveStreetMap: React.FC<LiveStreetMapProps> = ({
  listings,
  userLocation,
  trackedListing,
  onClaim,
}) => {
  const [selectedListing, setSelectedListing] = useState<SurplusListing | null>(
    trackedListing || listings[0] || null
  );
  const [mapType, setMapType] = useState<'m' | 'k'>('m'); // 'm' = Road Map, 'k' = Satellite

  // Whenever user clicks the distance button on a card, lock the Google Map onto that store
  useEffect(() => {
    if (trackedListing) {
      setSelectedListing(trackedListing);
    } else if (!selectedListing && listings.length > 0) {
      setSelectedListing(listings[0]);
    }
  }, [trackedListing, listings]);

  const activeTarget = selectedListing || trackedListing;

  // Determine exact coordinates for the live Google Map
  const targetLat =
    activeTarget && isValidCoordinate(activeTarget.location)
      ? activeTarget.location.lat
      : isValidCoordinate(userLocation)
      ? userLocation.lat
      : 27.0815;

  const targetLng =
    activeTarget && isValidCoordinate(activeTarget.location)
      ? activeTarget.location.lng
      : isValidCoordinate(userLocation)
      ? userLocation.lng
      : 85.5594;

  const distanceKm =
    activeTarget && isValidCoordinate(userLocation)
      ? calculateDistanceKm(userLocation, activeTarget.location)
      : undefined;

  const formatDist = (km?: number) => {
    if (km === undefined) return 'Same Area';
    if (km < 0.05) return 'Right Here (<50m)';
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    return `${km.toFixed(1)} km away`;
  };

  // Live Google Maps Embed URL centered on the store/user with a pin
  const googleEmbedUrl = `https://maps.google.com/maps?q=${targetLat},${targetLng}&t=${mapType}&z=16&ie=UTF8&iwloc=&output=embed`;

  // Live Google Maps Turn-by-Turn Route URL (from Human Location -> Store Location)
  const googleDirectionsUrl = isValidCoordinate(userLocation)
    ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${targetLat},${targetLng}&travelmode=walking`
    : `https://www.google.com/maps/search/?api=1&query=${targetLat},${targetLng}`;

  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-500/35 bg-[#0D1815] shadow-[0_0_30px_rgba(16,185,129,0.14)] flex flex-col">
      {/* Top Map Header Bar */}
      <div className="p-3 bg-[#101E1A] border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-extrabold text-white truncate">
              {activeTarget
                ? `${activeTarget.donorName} (${activeTarget.location.neighborhood})`
                : 'Live Google Map — Your Location'}
            </h3>
            <p className="text-[11px] text-emerald-300 font-medium truncate">
              {activeTarget
                ? `📍 ${activeTarget.location.address} • ${formatDist(distanceKm)}`
                : `GPS: ${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`}
            </p>
          </div>
        </div>

        {/* Toggle Road Map vs Satellite View */}
        <button
          type="button"
          onClick={() => setMapType((prev) => (prev === 'm' ? 'k' : 'm'))}
          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          {mapType === 'm' ? 'Satellite' : 'Map'}
        </button>
      </div>

      {/* Store Selector Pills (When multiple listings exist, tap any store to jump on Google Map) */}
      {listings.length > 0 && (
        <div className="px-3 py-2 bg-black/40 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto">
          {listings.map((item) => {
            const isSelected = activeTarget?.id === item.id;
            const d = calculateDistanceKm(userLocation, item.location);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedListing(item)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-sm'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">{item.donorName}</span>
                {d !== undefined && (
                  <span className="opacity-80 text-[10px]">
                    ({d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Embedded Live Google Map Frame */}
      <div className="relative w-full h-[360px] lg:h-[460px] bg-slate-900">
        <iframe
          key={`${targetLat}-${targetLng}-${mapType}`}
          title="EcoLoop Live Google Map"
          src={googleEmbedUrl}
          className="w-full h-full border-0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Bottom Live Route Tracking & Action Bar */}
      <div className="p-3 bg-[#101E1A] border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-300">
          <span className="font-semibold text-white">
            {activeTarget ? activeTarget.title : 'Live GPS Pin'}
          </span>
          {activeTarget && (
            <span className="text-emerald-400 font-bold ml-2">
              • {formatDist(distanceKm)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <a
            href={googleDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white transition-colors no-underline"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live Walking Route</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </a>

          {activeTarget && (
            <button
              type="button"
              onClick={() => onClaim(activeTarget.id)}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider cursor-pointer"
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