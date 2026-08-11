import {
  haversineDistanceMeters,
  kmhToMs,
  msToKmh,
  GeoPoint,
} from './geo.util';

const DEFAULT_TICK_SECONDS = 120;
const DEFAULT_STOP_TICKS = 2;

export interface SimulatedLocation {
  latitude: number;
  longitude: number;
  speed: number;
  recordedAt: Date;
}

export interface TripSummary {
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  distanceMeters: number;
  maxSpeed: number;
  averageSpeed: number;
}

function interpolate(from: GeoPoint, to: GeoPoint, t: number): GeoPoint {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

/**
 * Builds one leg's worth of historical locations between two points: ramps
 * up, cruises at cruiseSpeedKmh with one brief stop partway, ramps down.
 * Used by seed scripts to produce a realistic-looking completed trip
 * without needing a live device — see prisma/seed.ts.
 */
export function buildLegLocations(
  from: GeoPoint,
  to: GeoPoint,
  startAt: Date,
  cruiseSpeedKmh: number,
  tickSeconds: number = DEFAULT_TICK_SECONDS,
): SimulatedLocation[] {
  const totalDistance = haversineDistanceMeters(from, to);
  const distancePerTick = kmhToMs(cruiseSpeedKmh) * tickSeconds;
  const steps = Math.max(6, Math.round(totalDistance / distancePerTick));
  const stopAtStep = Math.floor(steps / 2);

  const locations: SimulatedLocation[] = [];
  let tick = 0;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const isEndpoint = step === 0 || step === steps;
    locations.push({
      ...interpolate(from, to, t),
      speed: isEndpoint ? 0 : cruiseSpeedKmh,
      recordedAt: new Date(startAt.getTime() + tick * tickSeconds * 1000),
    });
    tick++;

    if (step === stopAtStep) {
      for (let s = 0; s < DEFAULT_STOP_TICKS; s++) {
        locations.push({
          ...interpolate(from, to, t),
          speed: 0,
          recordedAt: new Date(startAt.getTime() + tick * tickSeconds * 1000),
        });
        tick++;
      }
    }
  }
  return locations;
}

export function summarizeTrip(locations: SimulatedLocation[]): TripSummary {
  let distanceMeters = 0;
  let maxSpeed = 0;
  for (let i = 1; i < locations.length; i++) {
    distanceMeters += haversineDistanceMeters(locations[i - 1], locations[i]);
    maxSpeed = Math.max(maxSpeed, locations[i].speed);
  }
  const startedAt = locations[0].recordedAt;
  const endedAt = locations[locations.length - 1].recordedAt;
  const durationSeconds = Math.round(
    (endedAt.getTime() - startedAt.getTime()) / 1000,
  );
  const averageSpeed =
    durationSeconds > 0 ? msToKmh(distanceMeters / durationSeconds) : 0;

  return {
    startedAt,
    endedAt,
    durationSeconds,
    distanceMeters,
    maxSpeed,
    averageSpeed,
  };
}
