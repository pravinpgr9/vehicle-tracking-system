import type { Geofence } from '../api/types';

interface Point {
  latitude: number;
  longitude: number;
}

interface NamedPoint extends Point {
  name: string;
}

// A handful of well-known cities so inter-city trips read as "Nashik ->
// Mumbai" instead of raw coordinates. Extend this list as needed — it's
// just a fallback for points that aren't inside one of the user's own
// geofences (which take priority and are usually more meaningful, e.g.
// "Home" instead of "Nashik").
const KNOWN_CITIES: NamedPoint[] = [
  { name: 'Nashik', latitude: 20.0056, longitude: 73.7891 },
  { name: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { name: 'Pune', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Malegaon', latitude: 20.5579, longitude: 74.5288 },
  { name: 'Aurangabad', latitude: 19.8762, longitude: 75.3433 },
  { name: 'Thane', latitude: 19.2183, longitude: 72.9781 },
  { name: 'Nagpur', latitude: 21.1458, longitude: 79.0882 },
];

const CITY_MATCH_RADIUS_KM = 15;
const EARTH_RADIUS_KM = 6371;

function distanceKm(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Labels a point with the nearest meaningful place name: the user's own
 * geofence if it's inside (or very near) one — "Home", not "Nashik" — else
 * the nearest known city within range, else raw coordinates.
 */
export function labelPoint(point: Point, geofences: Geofence[]): string {
  let closestGeofence: { name: string; distanceKm: number } | null = null;
  for (const geofence of geofences) {
    const d = distanceKm(point, geofence);
    if (d * 1000 <= geofence.radiusMeters * 3) {
      if (!closestGeofence || d < closestGeofence.distanceKm) {
        closestGeofence = { name: geofence.name, distanceKm: d };
      }
    }
  }
  if (closestGeofence) {
    return closestGeofence.name;
  }

  let closestCity: { name: string; distanceKm: number } | null = null;
  for (const city of KNOWN_CITIES) {
    const d = distanceKm(point, city);
    if (d <= CITY_MATCH_RADIUS_KM && (!closestCity || d < closestCity.distanceKm)) {
      closestCity = { name: city.name, distanceKm: d };
    }
  }
  if (closestCity) {
    return closestCity.name;
  }

  return `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`;
}
