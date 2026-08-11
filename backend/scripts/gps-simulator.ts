/**
 * Sends simulated GPS points to the running backend so the tracking
 * pipeline (trips, geofences, alerts, WebSocket) can be exercised without
 * an actual phone. Run with `npm run gps:simulate` after setting the env
 * vars below (see .env.example).
 */

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface RoutePoint extends GeoPoint {
  speedKmh: number;
}

const API_URL = process.env.SIMULATOR_API_URL ?? 'http://localhost:3000/api/v1';
const VEHICLE_ID = process.env.SIMULATOR_VEHICLE_ID;
const DEVICE_ID = process.env.SIMULATOR_DEVICE_ID;
const DEVICE_TOKEN = process.env.SIMULATOR_DEVICE_TOKEN;
const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS ?? 5000);

const HOME: GeoPoint = { latitude: 20.0056, longitude: 73.7891 };
const OFFICE: GeoPoint = { latitude: 20.02, longitude: 73.8 };

const CRUISE_SPEED_KMH = 42;
const MIN_DRIVING_STEPS = 4;
const STOP_DURATION_TICKS = 3;
const PARK_DURATION_TICKS = 5;
const STARTING_BATTERY = 100;
const BATTERY_DRAIN_PER_TICK = 0.05;
const MIN_BATTERY = 20;
const GPS_ACCURACY_METERS = 8;
const FULL_CIRCLE_DEGREES = 360;
const EARTH_RADIUS_METERS = 6_371_000;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 3600;
const METERS_PER_KM = 1000;

function interpolate(from: GeoPoint, to: GeoPoint, t: number): GeoPoint {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const deltaLat = toRad(b.latitude - a.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLon = Math.sin(deltaLon / 2);
  const h =
    sinDeltaLat * sinDeltaLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDeltaLon * sinDeltaLon;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Number of ticks to cross `from`→`to` at CRUISE_SPEED_KMH given how far
 * apart each tick is in time — so the labeled speed and the actual
 * lat/lon displacement agree (a trip's computed distance/duration would
 * otherwise imply a wildly different speed than what's reported).
 */
function drivingStepsFor(from: GeoPoint, to: GeoPoint): number {
  const distanceMeters = haversineMeters(from, to);
  const cruiseSpeedMps = (CRUISE_SPEED_KMH * METERS_PER_KM) / SECONDS_PER_HOUR;
  const distancePerTick =
    cruiseSpeedMps * (INTERVAL_MS / MILLISECONDS_PER_SECOND);
  return Math.max(
    MIN_DRIVING_STEPS,
    Math.round(distanceMeters / distancePerTick),
  );
}

function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const deltaLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (toDeg(Math.atan2(y, x)) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
}

/** One directional drive: ramps up, cruises, has one brief mid-route stop, ramps down. */
function buildLeg(from: GeoPoint, to: GeoPoint): RoutePoint[] {
  const drivingSteps = drivingStepsFor(from, to);
  const stopAtStep = Math.floor(drivingSteps / 2);
  const points: RoutePoint[] = [];

  for (let step = 0; step <= drivingSteps; step++) {
    const t = step / drivingSteps;
    const isEndpoint = step === 0 || step === drivingSteps;
    points.push({
      ...interpolate(from, to, t),
      speedKmh: isEndpoint ? 0 : CRUISE_SPEED_KMH,
    });

    if (step === stopAtStep) {
      for (let tick = 0; tick < STOP_DURATION_TICKS; tick++) {
        points.push({ ...interpolate(from, to, t), speedKmh: 0 });
      }
    }
  }
  return points;
}

function buildParked(at: GeoPoint, ticks: number): RoutePoint[] {
  return Array.from({ length: ticks }, () => ({ ...at, speedKmh: 0 }));
}

function buildRoute(): RoutePoint[] {
  return [
    ...buildLeg(HOME, OFFICE),
    ...buildParked(OFFICE, PARK_DURATION_TICKS),
    ...buildLeg(OFFICE, HOME),
    ...buildParked(HOME, PARK_DURATION_TICKS),
  ];
}

function requireEnv(): {
  vehicleId: string;
  deviceId: string;
  deviceToken: string;
} {
  if (!VEHICLE_ID || !DEVICE_ID || !DEVICE_TOKEN) {
    console.error(
      'Missing required environment variables.\n\n' +
        'Set SIMULATOR_VEHICLE_ID, SIMULATOR_DEVICE_ID, and SIMULATOR_DEVICE_TOKEN.\n' +
        'Get these by registering a user, creating a vehicle, and registering a\n' +
        'device for it (POST /api/v1/vehicles/:vehicleId/devices returns the\n' +
        'device token exactly once) — see DEVELOPMENT.md.',
    );
    process.exit(1);
  }
  return {
    vehicleId: VEHICLE_ID,
    deviceId: DEVICE_ID,
    deviceToken: DEVICE_TOKEN,
  };
}

async function sendLocation(
  env: ReturnType<typeof requireEnv>,
  point: RoutePoint,
  heading: number,
  batteryLevel: number,
): Promise<void> {
  const response = await fetch(`${API_URL}/tracking/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Device ${env.deviceToken}`,
    },
    body: JSON.stringify({
      deviceId: env.deviceId,
      vehicleId: env.vehicleId,
      latitude: point.latitude,
      longitude: point.longitude,
      speed: point.speedKmh,
      heading,
      accuracy: GPS_ACCURACY_METERS,
      batteryLevel: Math.round(batteryLevel),
      recordedAt: new Date().toISOString(),
    }),
  });

  const status = point.speedKmh > 0 ? 'moving' : 'stopped';
  if (!response.ok) {
    const body = await response.text();
    console.error(`[${status}] rejected (${response.status}): ${body}`);
    return;
  }
  console.log(
    `[${status}] ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} @ ${point.speedKmh} km/h`,
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const env = requireEnv();
  const route = buildRoute();

  console.log(
    `GPS simulator started: vehicle=${env.vehicleId} device=${env.deviceId} interval=${INTERVAL_MS}ms`,
  );

  let tick = 0;
  let running = true;
  process.on('SIGINT', () => {
    console.log('\nStopping GPS simulator...');
    running = false;
  });

  while (running) {
    const index = tick % route.length;
    const point = route[index];
    const next = route[(index + 1) % route.length];
    const heading = bearingDegrees(point, next);
    const battery = Math.max(
      MIN_BATTERY,
      STARTING_BATTERY - tick * BATTERY_DRAIN_PER_TICK,
    );

    await sendLocation(env, point, heading, battery);

    tick++;
    await sleep(INTERVAL_MS);
  }
}

void main();
