/**
 * Seeds a demo user, vehicle, device, geofences, and a realistic day of
 * driving (locations + trips + alerts) so the API/dashboard have something
 * to show without waiting on a real phone. Safe to re-run: it wipes the
 * previous demo user (cascades to everything below it) before recreating.
 *
 * Run with `npm run seed` (wraps `prisma db seed`, configured in
 * prisma.config.ts to execute this file with tsx).
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, DeviceType } from '../src/generated/prisma/client';
import {
  buildLegLocations,
  summarizeTrip,
} from '../src/common/utils/route-sim.util';
import { generateToken, hashToken } from '../src/common/utils/token.util';

const BCRYPT_SALT_ROUNDS = 12;
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Str0ngPass!';
const DEVICE_IDENTIFIER = 'android-car-001';

const HOME = { latitude: 20.0056, longitude: 73.7891 };
const OFFICE = { latitude: 20.1056, longitude: 73.8891 };
const CRUISE_SPEED_KMH = 32;

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log(`Removing any previous seed data for ${DEMO_EMAIL}...`);
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: 'Demo User', email: DEMO_EMAIL, passwordHash },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      name: 'My C3',
      registrationNumber: 'MH15AB1234',
      make: 'Citroen',
      model: 'C3',
      year: 2022,
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

  const homeGeofence = await prisma.geofence.create({
    data: { userId: user.id, name: 'Home', ...HOME, radiusMeters: 200 },
  });
  await prisma.geofence.create({
    data: { userId: user.id, name: 'Office', ...OFFICE, radiusMeters: 200 },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const morningStart = new Date(today.getTime() + 8.5 * 60 * 60 * 1000); // 08:30 UTC
  const eveningStart = new Date(today.getTime() + 18 * 60 * 60 * 1000); // 18:00 UTC

  const morningLocations = buildLegLocations(
    HOME,
    OFFICE,
    morningStart,
    CRUISE_SPEED_KMH,
  );
  const eveningLocations = buildLegLocations(
    OFFICE,
    HOME,
    eveningStart,
    CRUISE_SPEED_KMH,
  );

  for (const locations of [morningLocations, eveningLocations]) {
    await prisma.location.createMany({
      data: locations.map((location) => ({
        vehicleId: vehicle.id,
        deviceId: device.id,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        heading: 90,
        accuracy: 8,
        batteryLevel: 90,
        recordedAt: location.recordedAt,
      })),
    });
  }

  const morningSummary = summarizeTrip(morningLocations);
  const eveningSummary = summarizeTrip(eveningLocations);

  const morningTrip = await prisma.trip.create({
    data: {
      vehicleId: vehicle.id,
      startedAt: morningSummary.startedAt,
      endedAt: morningSummary.endedAt,
      lastMovingAt: morningSummary.endedAt,
      startLatitude: HOME.latitude,
      startLongitude: HOME.longitude,
      endLatitude: OFFICE.latitude,
      endLongitude: OFFICE.longitude,
      distanceMeters: morningSummary.distanceMeters,
      durationSeconds: morningSummary.durationSeconds,
      maxSpeed: morningSummary.maxSpeed,
      averageSpeed: morningSummary.averageSpeed,
      status: 'COMPLETED',
    },
  });
  await prisma.trip.create({
    data: {
      vehicleId: vehicle.id,
      startedAt: eveningSummary.startedAt,
      endedAt: eveningSummary.endedAt,
      lastMovingAt: eveningSummary.endedAt,
      startLatitude: OFFICE.latitude,
      startLongitude: OFFICE.longitude,
      endLatitude: HOME.latitude,
      endLongitude: HOME.longitude,
      distanceMeters: eveningSummary.distanceMeters,
      durationSeconds: eveningSummary.durationSeconds,
      maxSpeed: eveningSummary.maxSpeed,
      averageSpeed: eveningSummary.averageSpeed,
      status: 'COMPLETED',
    },
  });

  const homeExitEvent = await prisma.geofenceEvent.create({
    data: {
      vehicleId: vehicle.id,
      geofenceId: homeGeofence.id,
      eventType: 'EXIT',
      latitude: morningLocations[1].latitude,
      longitude: morningLocations[1].longitude,
      occurredAt: morningLocations[1].recordedAt,
    },
  });
  await prisma.geofenceEvent.create({
    data: {
      vehicleId: vehicle.id,
      geofenceId: homeGeofence.id,
      eventType: 'ENTER',
      latitude: eveningLocations[eveningLocations.length - 1].latitude,
      longitude: eveningLocations[eveningLocations.length - 1].longitude,
      occurredAt: eveningLocations[eveningLocations.length - 1].recordedAt,
    },
  });

  await prisma.alert.create({
    data: {
      vehicleId: vehicle.id,
      type: 'GEOFENCE_EXIT',
      severity: 'INFO',
      title: 'Exited Home',
      message: 'Vehicle exited geofence "Home"',
      metadata: {
        geofenceId: homeGeofence.id,
        geofenceEventId: homeExitEvent.id,
      },
      occurredAt: homeExitEvent.occurredAt,
    },
  });
  await prisma.alert.create({
    data: {
      vehicleId: vehicle.id,
      type: 'OVERSPEED',
      severity: 'WARNING',
      title: 'Overspeed detected',
      message: 'Vehicle exceeded 80 km/h (recorded 92 km/h)',
      metadata: { speed: 92, limit: 80 },
      occurredAt: new Date(morningSummary.endedAt.getTime() - 10 * 60 * 1000),
    },
  });
  await prisma.alert.create({
    data: {
      vehicleId: vehicle.id,
      type: 'LONG_STOP',
      severity: 'INFO',
      title: 'Vehicle stopped for a long time',
      message: `Vehicle has been stationary since ${morningSummary.endedAt.toISOString()}`,
      metadata: { tripId: morningTrip.id },
      occurredAt: eveningSummary.startedAt,
    },
  });

  console.log('\nSeed complete:');
  console.log(`  User:     ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Vehicle:  ${vehicle.name} (${vehicle.id})`);
  console.log(`  Device:   ${device.deviceIdentifier} (${device.id})`);
  console.log(`  Device token (for the GPS simulator, shown only now):`);
  console.log(`    ${deviceToken}`);
  console.log(
    `  Trips:    2 completed (${morningSummary.distanceMeters.toFixed(0)}m, ${eveningSummary.distanceMeters.toFixed(0)}m)`,
  );
  console.log('  Geofences: Home, Office');
  console.log('  Alerts:   GEOFENCE_EXIT, OVERSPEED, LONG_STOP\n');

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
