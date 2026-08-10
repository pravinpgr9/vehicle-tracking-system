import { EventEmitter2 } from '@nestjs/event-emitter';
import { GeofenceDetectionService } from './geofence-detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import {
  Geofence,
  GeofenceEvent,
  GeofenceEventType,
  Location,
  Vehicle,
  VehicleStatus,
} from '../generated/prisma/client';

function buildVehicle(): Vehicle {
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

function buildLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'location-1',
    vehicleId: 'vehicle-1',
    deviceId: 'device-1',
    latitude: 20.0056,
    longitude: 73.7891,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    batteryLevel: null,
    recordedAt: new Date(),
    receivedAt: new Date(),
    ...overrides,
  };
}

function buildGeofenceEvent(
  overrides: Partial<GeofenceEvent> = {},
): GeofenceEvent {
  return {
    id: 'event-1',
    vehicleId: 'vehicle-1',
    geofenceId: 'geofence-1',
    eventType: GeofenceEventType.ENTER,
    latitude: 20.0056,
    longitude: 73.7891,
    occurredAt: new Date(),
    ...overrides,
  };
}

interface GeofenceEventCreateArgs {
  data: Omit<GeofenceEvent, 'id' | 'occurredAt'>;
}

describe('GeofenceDetectionService', () => {
  let service: GeofenceDetectionService;
  let prisma: {
    vehicle: { findUnique: jest.Mock<Promise<Vehicle | null>, unknown[]> };
    geofence: { findMany: jest.Mock<Promise<Geofence[]>, unknown[]> };
    geofenceEvent: {
      findFirst: jest.Mock<Promise<GeofenceEvent | null>, unknown[]>;
      create: jest.Mock<Promise<GeofenceEvent>, [GeofenceEventCreateArgs]>;
    };
  };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    prisma = {
      vehicle: { findUnique: jest.fn<Promise<Vehicle | null>, unknown[]>() },
      geofence: { findMany: jest.fn<Promise<Geofence[]>, unknown[]>() },
      geofenceEvent: {
        findFirst: jest.fn<Promise<GeofenceEvent | null>, unknown[]>(),
        create: jest.fn<Promise<GeofenceEvent>, [GeofenceEventCreateArgs]>(),
      },
    };
    eventEmitter = { emit: jest.fn() };

    service = new GeofenceDetectionService(
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );

    prisma.vehicle.findUnique.mockResolvedValue(buildVehicle());
  });

  it('does nothing when there are no active geofences', async () => {
    prisma.geofence.findMany.mockResolvedValue([]);

    await service.handleLocationIngested(
      new LocationIngestedEvent(buildLocation()),
    );

    expect(prisma.geofenceEvent.create).not.toHaveBeenCalled();
  });

  it('creates an ENTER event on first entry and does not repeat it while inside', async () => {
    const geofence = buildGeofence();
    prisma.geofence.findMany.mockResolvedValue([geofence]);
    prisma.geofenceEvent.findFirst.mockResolvedValue(null);
    prisma.geofenceEvent.create.mockResolvedValue(
      buildGeofenceEvent({ eventType: GeofenceEventType.ENTER }),
    );

    await service.handleLocationIngested(
      new LocationIngestedEvent(buildLocation()),
    );

    expect(prisma.geofenceEvent.create).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AppEvent.GEOFENCE_ENTERED,
      expect.anything(),
    );

    // Second point, still inside, last event was ENTER: no repeat.
    prisma.geofenceEvent.findFirst.mockResolvedValue(
      buildGeofenceEvent({ eventType: GeofenceEventType.ENTER }),
    );
    await service.handleLocationIngested(
      new LocationIngestedEvent(buildLocation()),
    );
    expect(prisma.geofenceEvent.create).toHaveBeenCalledTimes(1);
  });

  it('creates an EXIT event when leaving a geofence it was inside', async () => {
    const geofence = buildGeofence();
    prisma.geofence.findMany.mockResolvedValue([geofence]);
    prisma.geofenceEvent.findFirst.mockResolvedValue(
      buildGeofenceEvent({ eventType: GeofenceEventType.ENTER }),
    );
    prisma.geofenceEvent.create.mockResolvedValue(
      buildGeofenceEvent({ eventType: GeofenceEventType.EXIT }),
    );

    // Far outside the 200m radius.
    const outsideLocation = buildLocation({
      latitude: 20.02,
      longitude: 73.81,
    });
    await service.handleLocationIngested(
      new LocationIngestedEvent(outsideLocation),
    );

    expect(prisma.geofenceEvent.create).toHaveBeenCalledTimes(1);
    const [{ data }] = prisma.geofenceEvent.create.mock.calls[0];
    expect(data.eventType).toBe(GeofenceEventType.EXIT);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AppEvent.GEOFENCE_EXITED,
      expect.anything(),
    );
  });

  it('does not alert while remaining outside a geofence', async () => {
    prisma.geofence.findMany.mockResolvedValue([buildGeofence()]);
    prisma.geofenceEvent.findFirst.mockResolvedValue(null);

    const outsideLocation = buildLocation({
      latitude: 20.02,
      longitude: 73.81,
    });
    await service.handleLocationIngested(
      new LocationIngestedEvent(outsideLocation),
    );

    expect(prisma.geofenceEvent.create).not.toHaveBeenCalled();
  });
});
