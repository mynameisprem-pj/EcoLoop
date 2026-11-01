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
 * Requests live GPS coordinates from the browser.
 * If high-accuracy GPS times out (common on Windows/Mac laptops without GPS chips),
 * automatically retries with Wi-Fi/network triangulation.
 */
export function requestBrowserGps(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    // First attempt: High accuracy (best for phones)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Fallback attempt for laptops/desktops: standard network/Wi-Fi positioning
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          (err) => {
            reject(new Error(err.message || 'Location permission denied.'));
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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