// src/utils/geoUtils.ts

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ResolvedLocation extends Coordinates {
  displayName: string;
  cityOrArea: string;
}

export const SAVED_LOCATION_KEY = 'ecoloop_saved_location';

export interface SavedLocation {
  coords: Coordinates;
  label: string;
}

function isValidSavedCoordinates(value: unknown): value is Coordinates {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('lat' in value) ||
    !('lng' in value) ||
    typeof value.lat !== 'number' ||
    typeof value.lng !== 'number'
  ) {
    return false;
  }
  return isValidCoordinate({ lat: value.lat, lng: value.lng });
}

export function getSavedLocation(): SavedLocation | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const saved = localStorage.getItem(SAVED_LOCATION_KEY);
    if (!saved) return null;

    const location: unknown = JSON.parse(saved);
    if (
      typeof location !== 'object' ||
      location === null ||
      !('coords' in location) ||
      !('label' in location) ||
      typeof location.label !== 'string' ||
      !isValidSavedCoordinates(location.coords)
    ) {
      return null;
    }

    return {
      coords: location.coords,
      label: location.label,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if coordinates are valid real-world numbers and not (0,0)
 */
export function isValidCoordinate(coord?: Coordinates | null): coord is Coordinates {
  if (!coord) return false;
  const { lat, lng } = coord;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return false; // Reject (0,0)
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Calculates the real-world distance in kilometers between two GPS coordinates
 * using the spherical Haversine formula. Returns undefined if either coordinate is invalid.
 */
export function calculateDistanceKm(
  coord1?: Coordinates | null,
  coord2?: Coordinates | null
): number | undefined {
  if (!isValidCoordinate(coord1) || !isValidCoordinate(coord2)) {
    return undefined;
  }

  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Requests browser location using network positioning, falling back to a
 * previously confirmed location when geolocation is unavailable or times out.
 */
export function requestBrowserGps(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    const savedLocation = getSavedLocation();
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      if (savedLocation) {
        resolve(savedLocation.coords);
        return;
      }
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
        if (savedLocation) {
          resolve(savedLocation.coords);
          return;
        }
        reject(new Error(err.message || 'Location permission denied.'));
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
    );
  });
}

/**
 * Converts raw (lat, lng) coordinates into a real-world street & city name
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
      addr.village ||
      addr.town ||
      addr.city_district ||
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
 * Forward geocodes a search string into real latitude/longitude coordinates.
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
      addr.village ||
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