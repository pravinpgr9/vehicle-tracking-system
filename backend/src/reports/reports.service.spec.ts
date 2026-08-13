import { ConfigService } from '@nestjs/config';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { Trip, TripStatus } from '../generated/prisma/client';

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    vehicleId: 'vehicle-1',
    startedAt: new Date('2026-08-10T08:00:00.000Z'),
    endedAt: new Date('2026-08-10T08:30:00.000Z'),
    startLatitude: 20.0056,
    startLongitude: 73.7891,
    endLatitude: 20.05,
    endLongitude: 73.82,
    distanceMeters: 10_000,
    durationSeconds: 1800,
    maxSpeed: 60,
    averageSpeed: 20,
    status: TripStatus.COMPLETED,
    lastMovingAt: new Date('2026-08-10T08:30:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: { trip: { findMany: jest.Mock<Promise<Trip[]>, unknown[]> } };
  let vehiclesService: { findOneOwned: jest.Mock };

  beforeEach(() => {
    prisma = { trip: { findMany: jest.fn<Promise<Trip[]>, unknown[]>() } };
    vehiclesService = { findOneOwned: jest.fn().mockResolvedValue({}) };
    const configService = { get: (_key: string, fallback: number) => fallback };

    service = new ReportsService(
      prisma as unknown as PrismaService,
      vehiclesService as unknown as VehiclesService,
      configService as unknown as ConfigService,
    );
  });

  describe('getDaily', () => {
    it('returns zeroed stats when there are no trips', async () => {
      prisma.trip.findMany.mockResolvedValue([]);

      const report = await service.getDaily('user-1', {
        vehicleId: 'vehicle-1',
        date: '2026-08-10',
      });

      expect(report).toMatchObject({
        date: '2026-08-10',
        totalTrips: 0,
        totalDistanceKm: 0,
        totalDrivingMinutes: 0,
        maxSpeedKmh: 0,
        averageSpeedKmh: 0,
      });
    });

    it('aggregates distance, duration, and max speed across trips', async () => {
      prisma.trip.findMany.mockResolvedValue([
        buildTrip({
          distanceMeters: 10_000,
          durationSeconds: 1800,
          maxSpeed: 60,
        }),
        buildTrip({
          distanceMeters: 8_000,
          durationSeconds: 1200,
          maxSpeed: 71,
        }),
      ]);

      const report = await service.getDaily('user-1', {
        vehicleId: 'vehicle-1',
        date: '2026-08-10',
      });

      expect(report.totalTrips).toBe(2);
      expect(report.totalDistanceKm).toBeCloseTo(18, 5);
      expect(report.totalDrivingMinutes).toBeCloseTo(50, 5);
      expect(report.maxSpeedKmh).toBe(71);
      // 18km in 50 minutes (5/6 hour) = 21.6 km/h
      expect(report.averageSpeedKmh).toBeCloseTo(21.6, 5);
    });

    it('checks vehicle ownership before querying trips', async () => {
      prisma.trip.findMany.mockResolvedValue([]);

      await service.getDaily('user-1', {
        vehicleId: 'vehicle-1',
        date: '2026-08-10',
      });

      expect(vehiclesService.findOneOwned).toHaveBeenCalledWith(
        'user-1',
        'vehicle-1',
      );
    });
  });

  describe('getMonthly', () => {
    it('computes averageTripDistanceKm across the month', async () => {
      prisma.trip.findMany.mockResolvedValue([
        buildTrip({ distanceMeters: 10_000 }),
        buildTrip({ distanceMeters: 20_000 }),
      ]);

      const report = await service.getMonthly('user-1', {
        vehicleId: 'vehicle-1',
        month: '2026-08',
      });

      expect(report.month).toBe('2026-08');
      expect(report.totalDistanceKm).toBeCloseTo(30, 5);
      expect(report.averageTripDistanceKm).toBeCloseTo(15, 5);
    });

    it('does not divide by zero when there are no trips', async () => {
      prisma.trip.findMany.mockResolvedValue([]);

      const report = await service.getMonthly('user-1', {
        vehicleId: 'vehicle-1',
        month: '2026-08',
      });

      expect(report.averageTripDistanceKm).toBe(0);
    });
  });
});
