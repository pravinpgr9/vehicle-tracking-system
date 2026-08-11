import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TripDetectionService } from './trip-detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import { haversineDistanceMeters } from '../common/utils/geo.util';
import { Location, Trip, TripStatus } from '../generated/prisma/client';

function buildLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'location-1',
    vehicleId: 'vehicle-1',
    deviceId: 'device-1',
    latitude: 20.0056,
    longitude: 73.7891,
    altitude: null,
    speed: 20,
    heading: null,
    accuracy: null,
    batteryLevel: null,
    recordedAt: new Date('2026-08-10T17:00:00.000Z'),
    receivedAt: new Date('2026-08-10T17:00:00.000Z'),
    ...overrides,
  };
}

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    vehicleId: 'vehicle-1',
    startedAt: new Date('2026-08-10T17:00:00.000Z'),
    endedAt: null,
    startLatitude: 20.0056,
    startLongitude: 73.7891,
    endLatitude: 20.0056,
    endLongitude: 73.7891,
    distanceMeters: 0,
    durationSeconds: null,
    maxSpeed: 20,
    averageSpeed: 20,
    status: TripStatus.ACTIVE,
    lastMovingAt: new Date('2026-08-10T17:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface TripUpdateArgs {
  where: { id: string };
  data: Partial<Trip>;
}

describe('TripDetectionService', () => {
  let service: TripDetectionService;
  let prisma: {
    trip: {
      findFirst: jest.Mock<Promise<Trip | null>, unknown[]>;
      findMany: jest.Mock<Promise<Trip[]>, unknown[]>;
      create: jest.Mock<Promise<Trip>, unknown[]>;
      update: jest.Mock<Promise<Trip>, [TripUpdateArgs]>;
    };
    location: { findMany: jest.Mock<Promise<Location[]>, unknown[]> };
  };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    prisma = {
      trip: {
        findFirst: jest.fn<Promise<Trip | null>, unknown[]>(),
        findMany: jest.fn<Promise<Trip[]>, unknown[]>(),
        create: jest.fn<Promise<Trip>, unknown[]>(),
        update: jest.fn<Promise<Trip>, [TripUpdateArgs]>(),
      },
      location: { findMany: jest.fn<Promise<Location[]>, unknown[]>() },
    };
    eventEmitter = { emit: jest.fn() };

    const configService = {
      get: (key: string, fallback: number) =>
        ({ 'trip.startSpeedKmh': 5, 'trip.endStopMinutes': 5 })[key] ??
        fallback,
    };

    service = new TripDetectionService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('starting a trip', () => {
    it('does not start a trip on a single moving point', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.location.findMany.mockResolvedValue([buildLocation()]);

      await service.handleLocationIngested(
        new LocationIngestedEvent(buildLocation()),
      );

      expect(prisma.trip.create).not.toHaveBeenCalled();
    });

    it('starts a trip after two consecutive moving points', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.location.findMany.mockResolvedValue([
        buildLocation({ speed: 20 }),
        buildLocation({ speed: 15 }),
      ]);
      prisma.trip.create.mockResolvedValue(buildTrip());

      await service.handleLocationIngested(
        new LocationIngestedEvent(buildLocation({ speed: 20 })),
      );

      expect(prisma.trip.create).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AppEvent.TRIP_STARTED,
        expect.anything(),
      );
    });

    it('anchors the new trip at the earlier point, counting the distance already covered between them', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      const previous = buildLocation({
        speed: 15,
        latitude: 20.0056,
        longitude: 73.7891,
        recordedAt: new Date('2026-08-10T17:00:00.000Z'),
      });
      const current = buildLocation({
        speed: 20,
        latitude: 20.007,
        longitude: 73.791,
        recordedAt: new Date('2026-08-10T17:00:10.000Z'),
      });
      // location.findMany is ordered newest-first: [current, previous].
      prisma.location.findMany.mockResolvedValue([current, previous]);
      prisma.trip.create.mockResolvedValue(buildTrip());

      await service.handleLocationIngested(new LocationIngestedEvent(current));

      const [{ data }] = prisma.trip.create.mock.calls[0] as [
        { data: Partial<Trip> },
      ];
      expect(data.startLatitude).toBe(previous.latitude);
      expect(data.startLongitude).toBe(previous.longitude);
      expect(data.startedAt).toEqual(previous.recordedAt);
      expect(data.endLatitude).toBe(current.latitude);
      expect(data.endLongitude).toBe(current.longitude);
      // The critical assertion: distance between the two starting points
      // must be counted, not dropped as it was before this fix.
      expect(data.distanceMeters).toBeCloseTo(
        haversineDistanceMeters(previous, current),
        5,
      );
      expect(data.maxSpeed).toBe(20);
    });

    it('accumulates total distance across three sequential points, matching distance(A,B) + distance(B,C)', async () => {
      const pointA = buildLocation({
        speed: 20,
        latitude: 20.0056,
        longitude: 73.7891,
        recordedAt: new Date('2026-08-10T17:00:00.000Z'),
      });
      const pointB = buildLocation({
        speed: 25,
        latitude: 20.007,
        longitude: 73.791,
        recordedAt: new Date('2026-08-10T17:00:10.000Z'),
      });
      const pointC = buildLocation({
        speed: 30,
        latitude: 20.009,
        longitude: 73.793,
        recordedAt: new Date('2026-08-10T17:00:20.000Z'),
      });

      let currentTrip: Trip | null = null;
      prisma.trip.findFirst.mockImplementation(() =>
        Promise.resolve(currentTrip),
      );
      prisma.trip.create.mockImplementation((...args: unknown[]) => {
        const { data } = args[0] as { data: Partial<Trip> };
        currentTrip = { ...buildTrip(), ...data };
        return Promise.resolve(currentTrip);
      });
      prisma.trip.update.mockImplementation((args) => {
        currentTrip = { ...(currentTrip as Trip), ...args.data };
        return Promise.resolve(currentTrip);
      });

      // Ingest A: only one point on record — no trip yet.
      prisma.location.findMany.mockResolvedValue([pointA]);
      await service.handleLocationIngested(new LocationIngestedEvent(pointA));
      expect(currentTrip).toBeNull();

      // Ingest B: A and B are 2 consecutive movers — trip starts, anchored
      // at A, with distance already covering A->B.
      prisma.location.findMany.mockResolvedValue([pointB, pointA]);
      await service.handleLocationIngested(new LocationIngestedEvent(pointB));
      const distanceAfterB = (currentTrip as unknown as Trip).distanceMeters;
      const distanceAB = haversineDistanceMeters(pointA, pointB);
      expect(distanceAfterB).toBeCloseTo(distanceAB, 5);

      // Ingest C: trip continues, distance += B->C.
      await service.handleLocationIngested(new LocationIngestedEvent(pointC));
      const distanceBC = haversineDistanceMeters(pointB, pointC);
      expect((currentTrip as unknown as Trip).distanceMeters).toBeCloseTo(
        distanceAB + distanceBC,
        5,
      );
    });

    it('does not start a trip below the configured speed threshold', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);

      await service.handleLocationIngested(
        new LocationIngestedEvent(buildLocation({ speed: 2 })),
      );

      expect(prisma.location.findMany).not.toHaveBeenCalled();
      expect(prisma.trip.create).not.toHaveBeenCalled();
    });
  });

  describe('continuing a trip', () => {
    it('accumulates distance and raises maxSpeed', async () => {
      const trip = buildTrip({ distanceMeters: 100, maxSpeed: 20 });
      prisma.trip.findFirst.mockResolvedValue(trip);
      prisma.trip.update.mockImplementation((args) =>
        Promise.resolve({ ...trip, ...args.data }),
      );

      const location = buildLocation({
        latitude: 20.0059,
        longitude: 73.7898,
        speed: 35,
        recordedAt: new Date('2026-08-10T17:00:10.000Z'),
      });
      await service.handleLocationIngested(new LocationIngestedEvent(location));

      const [{ data }] = prisma.trip.update.mock.calls[0];
      expect(data.distanceMeters).toBeGreaterThan(100);
      expect(data.maxSpeed).toBe(35);
      expect(data.durationSeconds).toBe(10);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AppEvent.TRIP_UPDATED,
        expect.anything(),
      );
    });

    it('does not advance lastMovingAt on a stopped point', async () => {
      const trip = buildTrip();
      prisma.trip.findFirst.mockResolvedValue(trip);
      prisma.trip.update.mockImplementation((args) =>
        Promise.resolve({ ...trip, ...args.data }),
      );

      const location = buildLocation({
        speed: 0,
        recordedAt: new Date('2026-08-10T17:01:00.000Z'),
      });
      await service.handleLocationIngested(new LocationIngestedEvent(location));

      const [{ data }] = prisma.trip.update.mock.calls[0];
      expect(data.lastMovingAt).toEqual(trip.lastMovingAt);
    });

    it('advances lastMovingAt on a moving point', async () => {
      const trip = buildTrip();
      prisma.trip.findFirst.mockResolvedValue(trip);
      prisma.trip.update.mockImplementation((args) =>
        Promise.resolve({ ...trip, ...args.data }),
      );

      const recordedAt = new Date('2026-08-10T17:01:00.000Z');
      const location = buildLocation({ speed: 30, recordedAt });
      await service.handleLocationIngested(new LocationIngestedEvent(location));

      const [{ data }] = prisma.trip.update.mock.calls[0];
      expect(data.lastMovingAt).toEqual(recordedAt);
    });
  });

  describe('endStaleTrips', () => {
    it('completes trips that have been still past the configured threshold', async () => {
      const staleTrip = buildTrip({
        lastMovingAt: new Date('2026-08-10T16:00:00.000Z'),
      });
      prisma.trip.findMany.mockResolvedValue([staleTrip]);
      prisma.trip.update.mockResolvedValue({
        ...staleTrip,
        status: TripStatus.COMPLETED,
      });

      await service.endStaleTrips();

      const [{ where, data }] = prisma.trip.update.mock.calls[0];
      expect(where).toEqual({ id: staleTrip.id });
      expect(data.status).toBe('COMPLETED');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AppEvent.TRIP_COMPLETED,
        expect.anything(),
      );
    });

    it('leaves recently-moving trips alone', async () => {
      prisma.trip.findMany.mockResolvedValue([]);

      await service.endStaleTrips();

      expect(prisma.trip.update).not.toHaveBeenCalled();
    });
  });
});
