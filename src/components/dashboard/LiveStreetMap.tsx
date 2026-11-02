// src/components/dashboard/LiveStreetMap.tsx
import React, { useState, useEffect } from 'react';
import type { SurplusListing } from '../../types';
import {
  type Coordinates,
  calculateDistanceKm,
  isValidCoordinate,
} from '../../utils/geoUtils';
import {
  Navigation,
  MapPin,
  Check,
  Compass,
  Layers,
  Footprints,
  LocateFixed,
  QrCode,
} from 'lucide-react';
import { useEcoStore } from '../../store/useEcoStore';

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
  onClearTracking,
  onClaim,
}) => {
  const { activeRole, userId, setActiveTab } = useEcoStore();
  const isStorePartner = activeRole === 'donor';

  const [selectedListing, setSelectedListing] = useState<SurplusListing | null>(
    trackedListing || listings[0] || null
  );
  const [mapType, setMapType] = useState<'m' | 'k'>('m');
  const [isRoutingInApp, setIsRoutingInApp] = useState<boolean>(
    Boolean(trackedListing) && !isStorePartner
  );
  const [liveHumanCoords, setLiveHumanCoords] =
    useState<Coordinates>(userLocation);

  useEffect(() => {
    if (isValidCoordinate(userLocation)) {
      setLiveHumanCoords(userLocation);
    }
  }, [userLocation]);

  useEffect(() => {
    if (!('geolocation' in navigator) || !isRoutingInApp || isStorePartner) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveHumanCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isRoutingInApp, isStorePartner]);

  useEffect(() => {
    if (trackedListing) {
      setSelectedListing(trackedListing);
      if (!isStorePartner) {
        setIsRoutingInApp(true);
      }
    } else if (!selectedListing && listings.length > 0) {
      setSelectedListing(listings[0]);
    }
  }, [trackedListing, listings, isStorePartner]);

  const activeTarget = trackedListing || selectedListing;

  const targetLat =
    activeTarget && isValidCoordinate(activeTarget.location)
      ? activeTarget.location.lat
      : isValidCoordinate(liveHumanCoords)
      ? liveHumanCoords.lat
      : 27.0815;

  const targetLng =
    activeTarget && isValidCoordinate(activeTarget.location)
      ? activeTarget.location.lng
      : isValidCoordinate(liveHumanCoords)
      ? liveHumanCoords.lng
      : 85.5594;

  const hasValidOrigin = isValidCoordinate(liveHumanCoords);
  const distanceKm =
    activeTarget && hasValidOrigin
      ? calculateDistanceKm(liveHumanCoords, activeTarget.location)
      : undefined;

  const estimatedWalkMins =
    distanceKm !== undefined ? Math.max(1, Math.round(distanceKm * 12)) : null;

  const formatDist = (km?: number) => {
    if (km === undefined) return 'Same Area';
    if (km < 0.05) return 'Right Here (<50m)';
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    return `${km.toFixed(1)} km away`;
  };

  const isSameSpot = distanceKm !== undefined && distanceKm < 0.03;

  // In Store Mode, always show clean Pin View. In Consumer Mode, allow A-to-B route tracking.
  const googleEmbedUrl =
    !isStorePartner && isRoutingInApp && activeTarget && hasValidOrigin && !isSameSpot
      ? `https://maps.google.com/maps?saddr=${liveHumanCoords.lat},${liveHumanCoords.lng}&daddr=${targetLat},${targetLng}&dirflg=w&t=${mapType}&ie=UTF8&output=embed`
      : `https://maps.google.com/maps?q=${targetLat},${targetLng}&t=${mapType}&z=16&ie=UTF8&iwloc=&output=embed`;

  const isAlreadyClaimed = activeTarget && activeTarget.status !== 'available';
  const isOwnStoreItem = activeTarget && activeTarget.donorId === userId;

  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-500/35 bg-[#0D1815] shadow-[0_0_30px_rgba(16,185,129,0.14)] flex flex-col">
      {/* Top Map Header Bar */}
      <div className="p-3 bg-[#101E1A] border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            {isRoutingInApp && !isStorePartner ? (
              <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <Compass className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-extrabold text-white truncate">
              {activeTarget
                ? `${activeTarget.donorName} (${activeTarget.location.neighborhood})`
                : 'Live Google Map — Store Network'}
            </h3>
            <p className="text-[11px] text-emerald-300 font-medium truncate">
              {activeTarget
                ? `📍 ${activeTarget.location.address}${
                    !isStorePartner
                      ? ` • ${formatDist(distanceKm)}${
                          estimatedWalkMins ? ` (~${estimatedWalkMins} min walk)` : ''
                        }`
                      : ''
                  }`
                : `GPS: ${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMapType((prev) => (prev === 'm' ? 'k' : 'm'))}
          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          {mapType === 'm' ? 'Satellite' : 'Map'}
        </button>
      </div>

      {/* Store Selector Pills */}
      {listings.length > 0 && (
        <div className="px-3 py-2 bg-black/40 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto">
          {listings.map((item) => {
            const isSelected = activeTarget?.id === item.id;
            const d = calculateDistanceKm(liveHumanCoords, item.location);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onClearTracking) onClearTracking();
                  setSelectedListing(item);
                  if (!isStorePartner) setIsRoutingInApp(true);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-sm'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">{item.donorName}</span>
                {!isStorePartner && d !== undefined && (
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
      <div className="relative w-full h-[380px] lg:h-[460px] bg-slate-900">
        <iframe
          key={`${googleEmbedUrl}`}
          title="EcoLoop In-App Live Route Tracker"
          src={googleEmbedUrl}
          className="w-full h-full border-0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {!isStorePartner && isRoutingInApp && activeTarget && (
          <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-emerald-400/50 flex items-center gap-2 text-[11px] font-bold text-emerald-300 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>
              {isSameSpot
                ? 'You are at the Store Location (<30m)'
                : `Live Walking Route Active • ${formatDist(distanceKm)}`}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Footer: ONLY shows Track Route & Claim buttons when in CONSUMER Mode */}
      {!isStorePartner && activeTarget && (
        <div className="p-3 bg-[#101E1A] border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-300 min-w-0">
            <span className="font-semibold text-white truncate block sm:inline">
              {activeTarget.title}
            </span>
            <span className="text-emerald-400 font-bold sm:ml-2">
              • {formatDist(distanceKm)}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                const nextState = !isRoutingInApp;
                setIsRoutingInApp(nextState);
                if (!nextState && onClearTracking) onClearTracking();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isRoutingInApp
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
              }`}
            >
              {isRoutingInApp ? (
                <>
                  <LocateFixed className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pin View</span>
                </>
              ) : (
                <>
                  <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Track Route in App</span>
                </>
              )}
            </button>

            {isAlreadyClaimed ? (
              <button
                type="button"
                onClick={() => setActiveTab('claims')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                My QR Pass
              </button>
            ) : (
              !isOwnStoreItem && (
                <button
                  type="button"
                  onClick={() => onClaim(activeTarget.id)}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  Claim
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};