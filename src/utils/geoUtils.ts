// src/utils/geoUtils.ts

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ResolvedLocation extends Coordinates {
  displayName: string;
  cityOrArea: string;
}

/**
 * Calculates the real-world distance in kilometers between two GPS coordinates
 * using the spherical Haversine formula.
 */
export function calculateDistanceKm(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) +
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Requests live GPS coordinates from the browser.
 * Rejects cleanly if the user denies permission or GPS is unavailable.
 */
export function requestBrowserGps(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        reject(new Error(err.message || 'Location permission denied.'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/**
 * Converts raw (lat, lng) coordinates into a real-world street & city name
 * using OpenStreetMap Nominatim Reverse Geocoding.
 */
export async function reverseGeocode(coords: Coordinates): Promise<ResolvedLocation> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) throw new Error('Reverse geocoding failed');
    const data = await res.json();

    const addr = data.address || {};
    const cityOrArea =
      addr.suburb ||
      addr.neighbourhood ||
      addr.city_district ||
      addr.town ||
      addr.city ||
      addr.municipality ||
      addr.county ||
      'Current Area';

    const road = addr.road || addr.pedestrian || '';
    const displayName = road ? `${road}, ${cityOrArea}` : cityOrArea;

    return {
      lat: coords.lat,
      lng: coords.lng,
      displayName,
      cityOrArea,
    };
  } catch {
    return {
      lat: coords.lat,
      lng: coords.lng,
      displayName: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      cityOrArea: 'Live GPS Area',
    };
  }
}

/**
 * Forward geocodes a search string (e.g. "New Baneshwor" or "123 Main St")
 * into real latitude/longitude coordinates.
 */
export async function searchAddressCoordinates(
  query: string
): Promise<ResolvedLocation | null> {
  if (!query.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=1&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const match = results[0];
    const lat = parseFloat(match.lat);
    const lng = parseFloat(match.lon);
    const addr = match.address || {};
    const cityOrArea =
      addr.suburb ||
      addr.neighbourhood ||
      addr.town ||
      addr.city ||
      match.name ||
      query;

    return {
      lat,
      lng,
      displayName: match.display_name.split(',').slice(0, 2).join(', '),
      cityOrArea,
    };
  } catch {
    return null;
  }
}