// src/components/dashboard/LiveStreetMap.tsx
import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { SurplusListing } from '../../types';
import { type Coordinates, calculateDistanceKm } from '../../utils/geoUtils';
import { Navigation, Clock, ExternalLink, X } from 'lucide-react';
import { getExpiryTimeRemaining } from '../../utils/impactCalculator';

const storePinIcon = new L.DivIcon({
  className: 'custom-eco-pin',
  html: `<div style="
    width: 32px;
    height: 32px;
    background: #10B981;
    border: 3px solid #061411;
    border-radius: 50%;
    box-shadow: 0 0 16px rgba(16,185,129,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
  ">🏪</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const userGpsIcon = new L.DivIcon({
  className: 'custom-user-pin',
  html: `<div style="
    width: 22px;
    height: 22px;
    background: #38BDF8;
    border: 3px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 0 16px #38BDF8;
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface LiveStreetMapProps {
  listings: SurplusListing[];
  userLocation: Coordinates;
  trackedListing: SurplusListing | null;
  onClearTracking?: () => void;
  onClaim: (listingId: string) => void;
  isVisible?: boolean;
}

/**
 * Fixes the black/half-loaded Leaflet tile bug on mobile tabs
 * and automatically zooms to fit both Human Location and Store Location when tracking.
 */
const MapController: React.FC<{
  center: Coordinates;
  trackedListing: SurplusListing | null;
  isVisible: boolean;
}> = ({ center, trackedListing, isVisible }) => {
  const map = useMap();

  useEffect(() => {
    // Force Leaflet to recalculate its container size when tab becomes visible
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (trackedListing) {
        const bounds = L.latLngBounds(
          [center.lat, center.lng],
          [trackedListing.location.lat, trackedListing.location.lng]
        );
        map.fitBounds(bounds, { padding: [55, 55], maxZoom: 16 });
      } else {
        map.setView([center.lat, center.lng], 14);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [center, trackedListing, isVisible, map]);

  return null;
};

export const LiveStreetMap: React.FC<LiveStreetMapProps> = ({
  listings,
  userLocation,
  trackedListing,
  onClearTracking,
  onClaim,
  isVisible = true,
}) => {
  const trackedDistanceKm = trackedListing
    ? calculateDistanceKm(userLocation, {
        lat: trackedListing.location.lat,
        lng: trackedListing.location.lng,
      })
    : null;

  return (
    <div className="relative w-full h-[440px] lg:h-[600px] rounded-2xl overflow-hidden border border-emerald-500/35 bg-[#0b1614] shadow-[0_0_30px_rgba(16,185,129,0.12)] z-0">
      <MapContainer
        center={[userLocation.lat, userLocation.lng]}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="ecoloop-dark-tiles"
        />

        <MapController
          center={userLocation}
          trackedListing={trackedListing}
          isVisible={isVisible}
        />

        {/* Human Location Marker (Blue Pulse Dot) */}
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userGpsIcon}>
          <Popup>
            <div className="text-slate-900 font-bold text-xs">
              🚶 Your Live Location
            </div>
          </Popup>
        </Marker>

        {/* Live Route Tracking Line Between Human and Selected Store */}
        {trackedListing && (
          <Polyline
            positions={[
              [userLocation.lat, userLocation.lng],
              [trackedListing.location.lat, trackedListing.location.lng],
            ]}
            pathOptions={{
              color: '#10B981',
              weight: 4,
              dashArray: '8, 8',
              opacity: 0.95,
            }}
          />
        )}

        {/* Store Pins */}
        {listings.map((item) => {
          const distKm = calculateDistanceKm(userLocation, {
            lat: item.location.lat,
            lng: item.location.lng,
          });
          const remaining = getExpiryTimeRemaining(item.expiresAt);
          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${item.location.lat},${item.location.lng}&travelmode=walking`;

          return (
            <Marker
              key={item.id}
              position={[item.location.lat, item.location.lng]}
              icon={storePinIcon}
            >
              <Popup>
                <div className="min-w-[210px] text-slate-900 space-y-1.5 p-0.5">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase">
                    {item.donorName} • {distKm} km
                  </div>
                  <div className="text-sm font-extrabold leading-tight">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-600">
                    📍 {item.location.address}, {item.location.neighborhood}
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-700 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {remaining.formatted}
                    </span>
                    <span>{item.weightKg} kg</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 rounded-lg bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center gap-1 no-underline"
                    >
                      Navigate <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onClaim(item.id)}
                      className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Claim Drop
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Active Route Tracking Overlay Card */}
      {trackedListing ? (
        <div className="absolute top-3 inset-x-3 z-[400] rounded-2xl bg-slate-950/95 backdrop-blur-md border border-emerald-400/50 p-3 shadow-2xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase">
              <Navigation className="w-3.5 h-3.5 animate-pulse" />
              <span>Tracking Route • {trackedDistanceKm} km away</span>
            </div>
            <p className="text-xs font-bold text-white truncate mt-0.5">
              {trackedListing.donorName} ({trackedListing.location.neighborhood})
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${trackedListing.location.lat},${trackedListing.location.lng}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-[11px] flex items-center gap-1"
            >
              Directions <ExternalLink className="w-3 h-3" />
            </a>
            {onClearTracking && (
              <button
                type="button"
                onClick={onClearTracking}
                className="p-1.5 rounded-xl bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                title="Clear route tracking"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute top-3 right-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-emerald-500/40 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-emerald-300 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>You (Blue) • Stores ({listings.length})</span>
        </div>
      )}
    </div>
  );
};