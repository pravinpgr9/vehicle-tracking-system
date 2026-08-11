/**
 * Seeds a richer demo account: one vehicle, a week-plus of real inter-city
 * trips (Nashik, Mumbai, Pune, Malegaon) plus a couple of local commutes
 * today, with matching geofence events and alerts. Distinct from
 * prisma/seed.ts's single-day demo — this is for exercising the dashboard
 * and reports with realistic variety (multiple cities, multiple dates,
 * multiple speeds) rather than a minimal smoke-test dataset.
 *
 * Configurable via env vars so no personal info is hardcoded here:
 *   SEED_EMAIL, SEED_PASSWORD, SEED_NAME (defaults below are placeholders)
 *
 * Run with: npx tsx scripts/seed-rich-demo.ts
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  DeviceType,
  GeofenceEventType,
  type Geofence,
} from '../src/generated/prisma/client';
import {
  buildLegLocations,
  summarizeTrip,
  type SimulatedLocation,
} from '../src/common/utils/route-sim.util';
import { generateToken, hashToken } from '../src/common/utils/token.util';

const BCRYPT_SALT_ROUNDS = 12;
const EMAIL = process.env.SEED_EMAIL ?? 'rich-demo@example.com';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Str0ngPass!';
const NAME = process.env.SEED_NAME ?? 'Rich Demo User';
const DEVICE_IDENTIFIER = 'innova-tracker-001';

const OVERSPEED_LIMIT_KMH = 80;
const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

const NASHIK_HOME = { latitude: 20.0056, longitude: 73.7891 };
const NASHIK_OFFICE = { latitude: 20.1056, longitude: 73.8891 };
const MUMBAI_OFFICE = { latitude: 19.076, longitude: 72.8777 };
const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const MALEGAON = { latitude: 20.5579, longitude: 74.5288 };

interface TripPlan {
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
  fromLabel: string;
  toLabel: string;
  /** How long before "now" this trip started. */
  startedHoursAgo: number;
  cruiseSpeedKmh: number;
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * MILLISECONDS_PER_MINUTE);
}

function startTimeFor(plan: TripPlan): Date {
  return minutesAgo(plan.startedHoursAgo * MINUTES_PER_HOUR);
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log(`Removing any previous seed data for ${EMAIL}...`);
  await prisma.user.deleteMany({ where: { email: EMAIL } });

  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: NAME, email: EMAIL, passwordHash },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      name: 'Multi-City Explorer',
      registrationNumber: 'MH12XY9999',
      make: 'Toyota',
      model: 'Innova',
      year: 2023,
    },
  });

  const deviceToken = generateToken();
  const device = await prisma.device.create({
    data: {
      vehicleId: vehicle.id,
      deviceType: DeviceType.PHONE,
      deviceIdentifier: DEVICE_IDENTIFIER,
      platform: 'android',
      deviceTokenHash: hashToken(deviceToken),
      lastSeenAt: new Date(),
    },
  });

  const geofenceDefs: Array<{
    name: string;
    point: { latitude: number; longitude: number };
  }> = [
    { name: 'Home (Nashik)', point: NASHIK_HOME },
    { name: 'Office (Nashik)', point: NASHIK_OFFICE },
    { name: 'Mumbai Office', point: MUMBAI_OFFICE },
  ];
  const geofences = new Map<string, Geofence>();
  for (const def of geofenceDefs) {
    const geofence = await prisma.geofence.create({
      data: {
        userId: user.id,
        name: def.name,
        ...def.point,
        radiusMeters: 200,
      },
    });
    geofences.set(def.name, geofence);
  }

  // Tracks the last known ENTER/EXIT per geofence so transitions are only
  // recorded when the state actually changes (same rule the live
  // GeofenceDetectionService uses — see ARCHITECTURE.md).
  const geofenceState = new Map<string, GeofenceEventType>();

  async function maybeRecordGeofenceTransition(
    geofenceName: string,
    point: { latitude: number; longitude: number },
    occurredAt: Date,
  ): Promise<void> {
    const geofence = geofences.get(geofenceName);
    if (!geofence) return;
    const RADIUS_CHECK_METERS = 250; // generous vs the 200m geofence radius
    const distance =
      Math.sqrt(
        (point.latitude - geofence.latitude) ** 2 +
          (point.longitude - geofence.longitude) ** 2,
      ) * 111_000; // rough degrees->meters, fine at this radius scale
    const isInside = distance <= RADIUS_CHECK_METERS;
    const wasInside =
      geofenceState.get(geofenceName) === GeofenceEventType.ENTER;
    if (isInside === wasInside) return;

    const eventType = isInside
      ? GeofenceEventType.ENTER
      : GeofenceEventType.EXIT;
    geofenceState.set(geofenceName, eventType);
    const event = await prisma.geofenceEvent.create({
      data: {
        vehicleId: vehicle.id,
        geofenceId: geofence.id,
        eventType,
        latitude: point.latitude,
        longitude: point.longitude,
        occurredAt,
      },
    });
    const verb = isInside ? 'Entered' : 'Exited';
    await prisma.alert.create({
      data: {
        vehicleId: vehicle.id,
        type: isInside ? 'GEOFENCE_ENTER' : 'GEOFENCE_EXIT',
        severity: 'INFO',
        title: `${verb} ${geofence.name}`,
        message: `Vehicle ${verb.toLowerCase()} geofence "${geofence.name}"`,
        metadata: { geofenceId: geofence.id, geofenceEventId: event.id },
        occurredAt,
      },
    });
  }

  const plans: TripPlan[] = [
    {
      from: NASHIK_HOME,
      to: MUMBAI_OFFICE,
      fromLabel: 'Home (Nashik)',
      toLabel: 'Mumbai Office',
      startedHoursAgo: 191,
      cruiseSpeedKmh: 60,
    },
    {
      from: MUMBAI_OFFICE,
      to: PUNE,
      fromLabel: 'Mumbai Office',
      toLabel: 'Pune',
      startedHoursAgo: 167,
      cruiseSpeedKmh: 65,
    },
    {
      from: PUNE,
      to: NASHIK_HOME,
      fromLabel: 'Pune',
      toLabel: 'Home (Nashik)',
      startedHoursAgo: 143,
      cruiseSpeedKmh: 58,
    },
    {
      from: NASHIK_HOME,
      to: MALEGAON,
      fromLabel: 'Home (Nashik)',
      toLabel: 'Malegaon',
      startedHoursAgo: 47,
      cruiseSpeedKmh: 45,
    },
    {
      from: MALEGAON,
      to: NASHIK_HOME,
      fromLabel: 'Malegaon',
      toLabel: 'Home (Nashik)',
      startedHoursAgo: 38,
      cruiseSpeedKmh: 45,
    },
    {
      from: NASHIK_HOME,
      to: NASHIK_OFFICE,
      fromLabel: 'Home (Nashik)',
      toLabel: 'Office (Nashik)',
      startedHoursAgo: 3,
      cruiseSpeedKmh: 28,
    },
    {
      from: NASHIK_OFFICE,
      to: NASHIK_HOME,
      fromLabel: 'Office (Nashik)',
      toLabel: 'Home (Nashik)',
      startedHoursAgo: 0.5,
      cruiseSpeedKmh: 30,
    },
  ];

  // The very first point this vehicle ever reports gets an implicit ENTER
  // (no prior state to compare against) — same behavior as live ingestion.
  await maybeRecordGeofenceTransition(
    plans[0].fromLabel,
    plans[0].from,
    startTimeFor(plans[0]),
  );

  console.log('Building trips:');
  const tripSummaries: Array<{
    label: string;
    distanceKm: string;
    maxSpeed: number;
  }> = [];

  for (const plan of plans) {
    const startAt = startTimeFor(plan);
    const locations = buildLegLocations(
      plan.from,
      plan.to,
      startAt,
      plan.cruiseSpeedKmh,
    );

    await prisma.location.createMany({
      data: locations.map((location: SimulatedLocation) => ({
        vehicleId: vehicle.id,
        deviceId: device.id,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        heading: 90,
        accuracy: 8,
        batteryLevel: 85,
        recordedAt: location.recordedAt,
      })),
    });

    const summary = summarizeTrip(locations);
    // A brief overspeed burst partway through, on faster (highway) legs only.
    const maxSpeed =
      plan.cruiseSpeedKmh >= 40
        ? Math.round(plan.cruiseSpeedKmh * 1.35)
        : summary.maxSpeed;

    const trip = await prisma.trip.create({
      data: {
        vehicleId: vehicle.id,
        startedAt: summary.startedAt,
        endedAt: summary.endedAt,
        lastMovingAt: summary.endedAt,
        startLatitude: plan.from.latitude,
        startLongitude: plan.from.longitude,
        endLatitude: plan.to.latitude,
        endLongitude: plan.to.longitude,
        distanceMeters: summary.distanceMeters,
        durationSeconds: summary.durationSeconds,
        maxSpeed,
        averageSpeed: summary.averageSpeed,
        status: 'COMPLETED',
      },
    });

    if (maxSpeed > OVERSPEED_LIMIT_KMH) {
      await prisma.alert.create({
        data: {
          vehicleId: vehicle.id,
          type: 'OVERSPEED',
          severity: 'WARNING',
          title: 'Overspeed detected',
          message: `Vehicle exceeded ${OVERSPEED_LIMIT_KMH} km/h (recorded ${maxSpeed} km/h)`,
          metadata: {
            speed: maxSpeed,
            limit: OVERSPEED_LIMIT_KMH,
            tripId: trip.id,
          },
          occurredAt: new Date(
            summary.startedAt.getTime() +
              (summary.endedAt.getTime() - summary.startedAt.getTime()) / 2,
          ),
        },
      });
    }

    // Departure exits the "from" geofence, arrival enters the "to" geofence.
    await maybeRecordGeofenceTransition(
      plan.fromLabel,
      locations[1],
      locations[1].recordedAt,
    );
    await maybeRecordGeofenceTransition(
      plan.toLabel,
      locations.at(-1)!,
      locations.at(-1)!.recordedAt,
    );

    tripSummaries.push({
      label: `${plan.fromLabel} -> ${plan.toLabel}`,
      distanceKm: (summary.distanceMeters / 1000).toFixed(1),
      maxSpeed,
    });
    console.log(
      `  ${tripSummaries.at(-1)!.label}: ${tripSummaries.at(-1)!.distanceKm}km, max ${maxSpeed}km/h`,
    );
  }

  // Bump the device's lastSeenAt to match the final (most recent) point so
  // the dashboard shows "online" immediately after seeding.
  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });

  console.log('\nSeed complete:');
  console.log(`  User:     ${EMAIL} / ${PASSWORD}`);
  console.log(`  Vehicle:  ${vehicle.name} (${vehicle.id})`);
  console.log(`  Device token (for the GPS simulator, shown only now):`);
  console.log(`    ${deviceToken}`);
  console.log(
    `  Trips:    ${tripSummaries.length} completed across Nashik, Mumbai, Pune, Malegaon`,
  );
  console.log(`  Geofences: ${[...geofences.keys()].join(', ')}\n`);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
