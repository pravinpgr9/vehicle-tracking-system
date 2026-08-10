import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AlertsEngineService } from './alerts-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import { GeofenceTransitionEvent } from '../common/events/geofence-transition.event';
import {
  Device,
  Geofence,
  GeofenceEvent,
  GeofenceEventType,
  Location,
  Trip,
  TripStatus,
  Vehicle,
  VehicleStatus,
} from '../generated/prisma/client';

function buildLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'location-1',
    vehicleId: 'vehicle-1',
    deviceId: 'device-1',
    latitude: 20.0056,
    longitude: 73.7891,
    altitude: null,
    speed: 90,
    heading: null,
    accuracy: null,
    batteryLevel: null,
    recordedAt: new Date('2026-08-10T17:00:10.000Z'),
    receivedAt: new Date('2026-08-10T17:00:10.000Z'),
    ...overrides,
  };
}

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    userId: 'user-1',
    name: 'My C3',
    registrationNumber: 'MH15AB1234',
    make: null,
    model: null,
    year: null,
    status: VehicleStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1',
    vehicleId: 'vehicle-1',
    deviceType: 'PHONE',
    deviceIdentifier: 'android-car-001',
    platform: 'android',
    deviceTokenHash: 'hash',
    isActive: true,
    lastSeenAt: new Date('2026-08-10T16:00:00.000Z'),
    createdAt: new Date('2026-08-10T10:00:00.000Z'),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    vehicleId: 'vehicle-1',
    startedAt: new Date('2026-08-10T15:00:00.000Z'),
    endedAt: new Date('2026-08-10T15:30:00.000Z'),
    startLatitude: 20.0056,
    startLongitude: 73.7891,
    endLatitude: 20.0056,
    endLongitude: 73.7891,
    distanceMeters: 5000,
    durationSeconds: 1800,
    maxSpeed: 60,
    averageSpeed: 30,
    status: TripStatus.COMPLETED,
    lastMovingAt: new Date('2026-08-10T15:30:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildGeofence(overrides: Partial<Geofence> = {}): Geofence {
  return {
    id: 'geofence-1',
    userId: 'user-1',
    name: 'Home',
    latitude: 20.0056,
    longitude: 73.7891,
    radiusMeters: 200,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildGeofenceEvent(
  overrides: Partial<GeofenceEvent> = {},
): GeofenceEvent {
  return {
    id: 'gf-event-1',
    vehicleId: 'vehicle-1',
    geofenceId: 'geofence-1',
    eventType: GeofenceEventType.ENTER,
    latitude: 20.0056,
    longitude: 73.7891,
    occurredAt: new Date(),
    ...overrides,
  };
}

interface AlertRecord {
  id: string;
  vehicleId: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: unknown;
  occurredAt: Date;
}

interface AlertCreateArgs {
  data: Omit<AlertRecord, 'id' | 'occurredAt'>;
}

function buildAlertRecord(overrides: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id: 'alert-0',
    vehicleId: 'vehicle-1',
    type: 'DEVICE_OFFLINE',
    severity: 'CRITICAL',
    title: 'Device offline',
    message: 'previous alert',
    metadata: null,
    occurredAt: new Date(),
    ...overrides,
  };
}

describe('AlertsEngineService', () => {
  let service: AlertsEngineService;
  let prisma: {
    location: { findFirst: jest.Mock<Promise<Location | null>, unknown[]> };
    device: { findMany: jest.Mock<Promise<Device[]>, unknown[]> };
    vehicle: { findMany: jest.Mock<Promise<Vehicle[]>, unknown[]> };
    trip: { findFirst: jest.Mock<Promise<Trip | null>, unknown[]> };
    alert: {
      findFirst: jest.Mock<Promise<AlertRecord | null>, unknown[]>;
      create: jest.Mock<Promise<AlertRecord>, [AlertCreateArgs]>;
    };
  };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    prisma = {
      location: { findFirst: jest.fn<Promise<Location | null>, unknown[]>() },
      device: { findMany: jest.fn<Promise<Device[]>, unknown[]>() },
      vehicle: { findMany: jest.fn<Promise<Vehicle[]>, unknown[]>() },
      trip: { findFirst: jest.fn<Promise<Trip | null>, unknown[]>() },
      alert: {
        findFirst: jest.fn<Promise<AlertRecord | null>, unknown[]>(),
        create: jest.fn<Promise<AlertRecord>, [AlertCreateArgs]>(),
      },
    };
    eventEmitter = { emit: jest.fn() };

    const configService = {
      get: (key: string, fallback: number) =>
        ({
          'alert.overspeedLimitKmh': 80,
          'alert.deviceOfflineMinutes': 10,
          'alert.longStopMinutes': 15,
        })[key] ?? fallback,
    };

    service = new AlertsEngineService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      eventEmitter as unknown as EventEmitter2,
    );
    prisma.alert.create.mockImplementation((args) =>
      Promise.resolve({ id: 'alert-1', occurredAt: new Date(), ...args.data }),
    );
  });

  describe('checkOverspeed', () => {
    it('does nothing under the limit', async () => {
      prisma.location.findFirst.mockResolvedValue(null);
      await service.checkOverspeed(
        new LocationIngestedEvent(buildLocation({ speed: 50 })),
      );
      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('alerts on the transition into speeding', async () => {
      prisma.location.findFirst.mockResolvedValue(buildLocation({ speed: 60 }));
      await service.checkOverspeed(
        new LocationIngestedEvent(buildLocation({ speed: 95 })),
      );
      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AppEvent.ALERT_CREATED,
        expect.anything(),
      );
    });

    it('does not repeat the alert while still speeding', async () => {
      prisma.location.findFirst.mockResolvedValue(buildLocation({ speed: 90 }));
      await service.checkOverspeed(
        new LocationIngestedEvent(buildLocation({ speed: 95 })),
      );
      expect(prisma.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('geofence-triggered alerts', () => {
    it('creates a GEOFENCE_ENTER alert', async () => {
      await service.handleGeofenceEntered(
        new GeofenceTransitionEvent(
          buildGeofenceEvent({ eventType: GeofenceEventType.ENTER }),
          buildGeofence(),
        ),
      );
      const [{ data }] = prisma.alert.create.mock.calls[0];
      expect(data.type).toBe('GEOFENCE_ENTER');
    });

    it('creates a GEOFENCE_EXIT alert', async () => {
      await service.handleGeofenceExited(
        new GeofenceTransitionEvent(
          buildGeofenceEvent({ eventType: GeofenceEventType.EXIT }),
          buildGeofence(),
        ),
      );
      const [{ data }] = prisma.alert.create.mock.calls[0];
      expect(data.type).toBe('GEOFENCE_EXIT');
    });
  });

  describe('sweepDeviceOffline', () => {
    it('alerts once for a newly-stale device', async () => {
      prisma.device.findMany.mockResolvedValue([buildDevice()]);
      prisma.alert.findFirst.mockResolvedValue(null);

      await service.sweepDeviceOffline();

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      const [{ data }] = prisma.alert.create.mock.calls[0];
      expect(data.type).toBe('DEVICE_OFFLINE');
    });

    it('does not repeat the alert for the same offline episode', async () => {
      const device = buildDevice();
      prisma.device.findMany.mockResolvedValue([device]);
      prisma.alert.findFirst.mockResolvedValue(
        buildAlertRecord({ occurredAt: new Date() }),
      );

      await service.sweepDeviceOffline();

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('sweepLongStop', () => {
    it('skips a vehicle whose trip is still active', async () => {
      prisma.vehicle.findMany.mockResolvedValue([buildVehicle()]);
      prisma.trip.findFirst.mockResolvedValue(
        buildTrip({ status: TripStatus.ACTIVE, endedAt: null }),
      );

      await service.sweepLongStop();

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('skips a vehicle that stopped recently', async () => {
      prisma.vehicle.findMany.mockResolvedValue([buildVehicle()]);
      prisma.trip.findFirst.mockResolvedValue(
        buildTrip({ endedAt: new Date() }),
      );

      await service.sweepLongStop();

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('alerts once for a vehicle stopped past the threshold', async () => {
      prisma.vehicle.findMany.mockResolvedValue([buildVehicle()]);
      prisma.trip.findFirst.mockResolvedValue(
        buildTrip({ endedAt: new Date('2026-08-10T00:00:00.000Z') }),
      );
      prisma.alert.findFirst.mockResolvedValue(null);

      await service.sweepLongStop();

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      const [{ data }] = prisma.alert.create.mock.calls[0];
      expect(data.type).toBe('LONG_STOP');
    });
  });
});
