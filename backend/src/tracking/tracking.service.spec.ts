import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/constants/error-codes';
import { AuthenticatedDevice } from '../devices/guards/device-auth.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import {
  DeviceType,
  Location,
  Vehicle,
  VehicleStatus,
} from '../generated/prisma/client';

function buildDevice(): AuthenticatedDevice {
  const vehicle: Vehicle = {
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
  return {
    id: 'device-1',
    vehicleId: 'vehicle-1',
    deviceType: DeviceType.PHONE,
    deviceIdentifier: 'android-car-001',
    platform: 'android',
    deviceTokenHash: 'hash',
    isActive: true,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicle,
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
    recordedAt: new Date('2026-08-10T17:00:00.000Z'),
    receivedAt: new Date('2026-08-10T17:00:00.000Z'),
    ...overrides,
  };
}

function buildDto(
  overrides: Partial<CreateLocationDto> = {},
): CreateLocationDto {
  return {
    deviceId: 'android-car-001',
    vehicleId: 'vehicle-1',
    latitude: 20.0059,
    longitude: 73.7898,
    recordedAt: '2026-08-10T17:00:10.000Z',
    ...overrides,
  };
}

describe('TrackingService', () => {
  let service: TrackingService;
  let prisma: {
    location: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
    device: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    prisma = {
      location: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      device: { update: jest.fn() },
      $transaction: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    const configService = {
      get: (key: string, fallback: number) =>
        ({
          'gps.maxJumpMeters': 2000,
          'gps.maxJumpSeconds': 10,
        })[key] ?? fallback,
    };

    service = new TrackingService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('rejects a payload whose vehicleId/deviceId do not match the authenticated device', async () => {
    const device = buildDevice();
    const dto = buildDto({ vehicleId: 'someone-elses-vehicle' });

    await expect(service.ingestLocation(device, dto)).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
    expect(prisma.location.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an implausible jump within the configured window', async () => {
    const device = buildDevice();
    prisma.location.findFirst.mockResolvedValue(
      buildLocation({
        latitude: 20.0056,
        longitude: 73.7891,
        recordedAt: new Date('2026-08-10T17:00:00.000Z'),
      }),
    );
    // ~280km away, 5 seconds later: far beyond the 2000m/10s threshold.
    const dto = buildDto({
      latitude: 22.5,
      longitude: 73.7891,
      recordedAt: '2026-08-10T17:00:05.000Z',
    });

    await expect(service.ingestLocation(device, dto)).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts a realistic movement and emits location.ingested', async () => {
    const device = buildDevice();
    const previous = buildLocation();
    const saved = buildLocation({ id: 'location-2' });
    prisma.location.findFirst.mockResolvedValue(previous);
    prisma.$transaction.mockResolvedValue([
      saved,
      { ...device, lastSeenAt: new Date() },
    ]);

    const result = await service.ingestLocation(device, buildDto());

    expect(result).toBe(saved);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'location.ingested',
      expect.objectContaining({ location: saved }),
    );
  });

  it('does not apply the jump check to an out-of-order (earlier) point', async () => {
    const device = buildDevice();
    prisma.location.findFirst.mockResolvedValue(
      buildLocation({ recordedAt: new Date('2026-08-10T17:00:10.000Z') }),
    );
    const saved = buildLocation({ id: 'location-3' });
    prisma.$transaction.mockResolvedValue([saved, {}]);

    // 280km away but recorded *before* the "previous" point.
    const dto = buildDto({
      latitude: 22.5,
      recordedAt: '2026-08-10T17:00:00.000Z',
    });

    await expect(service.ingestLocation(device, dto)).resolves.toBe(saved);
  });

  describe('getCurrentLocation', () => {
    it('throws NOT_FOUND when the vehicle has no location yet', async () => {
      prisma.location.findFirst.mockResolvedValue(null);

      await expect(
        service.getCurrentLocation('vehicle-1'),
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });
});
