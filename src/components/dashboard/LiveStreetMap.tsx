// src/components/dashboard/LiveStreetMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { type SurplusListing } from '../../types';
import { type Coordinates, calculateDistanceKm } from '../../utils/geoUtils';
import { Navigation, Clock } from 'lucide-react';
import { getExpiryTimeRemaining } from '../../utils/impactCalculator';

// Custom Emerald Marker Icon for Food Drops
const storePinIcon = new L.DivIcon({
  className: 'custom-eco-pin',
  html: `<div style="
    width: 30px;
    height: 30px;
    background: #10B981;
    border: 3px solid #061411;
    border-radius: 50%;
    box-shadow: 0 0 16px rgba(16,185,129,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #061411;
    font-weight: 900;
    font-size: 14px;
  ">🌱</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Custom Blue Pulse Marker for User's Real GPS Position
const userGpsIcon = new L.DivIcon({
  className: 'custom-user-pin',
  html: `<div style="
    width: 18px;
    height: 18px;
    background: #38BDF8;
    border: 3px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 0 14px #38BDF8;
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface LiveStreetMapProps {
  listings: SurplusListing[];
  userLocation: Coordinates;
  onClaim: (listingId: string) => void;
  heightClass?: string;
}

const RecenterMap: React.FC<{ center: Coordinates }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, map]);
  return null;
};

export const LiveStreetMap: React.FC<LiveStreetMapProps> = ({
  listings,
  userLocation,
  onClaim,
  heightClass = 'h-[420px] lg:h-[600px]',
}) => {
  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-emerald-500/35 shadow-[0_0_30px_rgba(16,185,129,0.12)] z-0`}
    >
      <MapContainer
        center={[userLocation.lat, userLocation.lng]}
        zoom={15}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="ecoloop-dark-tiles"
        />
        <RecenterMap center={userLocation} />

        {/* User's Real Live GPS Location */}
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userGpsIcon}>
          <Popup>
            <div className="text-slate-900 font-semibold text-xs">
              📍 Your Live GPS Location
            </div>
          </Popup>
        </Marker>

        {/* Active Store Surplus Drops */}
        {listings.map((item) => {
          const distKm = calculateDistanceKm(userLocation, {
            lat: item.location.lat,
            lng: item.location.lng,
          });
          const remaining = getExpiryTimeRemaining(item.expiresAt);

          return (
            <Marker
              key={item.id}
              position={[item.location.lat, item.location.lng]}
              icon={storePinIcon}
            >
              <Popup>
                <div className="min-w-[200px] text-slate-900 space-y-1.5 p-0.5">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase">
                    {item.donorName} • {distKm} km away
                  </div>
                  <div className="text-sm font-extrabold leading-tight">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-600 line-clamp-2">
                    {item.description}
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-700 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {remaining.formatted}
                    </span>
                    <span>{item.weightKg} kg</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClaim(item.id)}
                    className="w-full mt-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Claim Surplus Drop
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Live GPS Status Pill */}
      <div className="absolute top-3 right-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-emerald-500/40 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-emerald-300 shadow-lg">
        <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span>Live GPS Active ({ listings.length } drops nearby)</span>
      </div>
    </div>
  );
};