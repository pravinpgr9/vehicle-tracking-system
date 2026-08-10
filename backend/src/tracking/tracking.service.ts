import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/constants/error-codes';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import { haversineDistanceMeters } from '../common/utils/geo.util';
import { AuthenticatedDevice } from '../devices/guards/device-auth.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationHistoryQueryDto } from './dto/location-history-query.dto';
import { PaginatedResponse } from '../common/types/paginated-response.type';
import { Location } from '../generated/prisma/client';

const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async ingestLocation(
    device: AuthenticatedDevice,
    dto: CreateLocationDto,
  ): Promise<Location> {
    this.assertPayloadMatchesDevice(device, dto);

    const previous = await this.prisma.location.findFirst({
      where: { vehicleId: device.vehicleId },
      orderBy: { recordedAt: 'desc' },
    });
    this.assertNotImplausibleJump(previous, dto);

    const [location] = await this.prisma.$transaction([
      this.prisma.location.create({
        data: {
          vehicleId: device.vehicleId,
          deviceId: device.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          altitude: dto.altitude,
          speed: dto.speed,
          heading: dto.heading,
          accuracy: dto.accuracy,
          batteryLevel: dto.batteryLevel,
          recordedAt: new Date(dto.recordedAt),
        },
      }),
      this.prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    this.logger.log(
      `GPS received: vehicle=${device.vehicleId} device=${device.deviceIdentifier} speed=${dto.speed ?? 'n/a'}`,
    );
    this.eventEmitter.emit(
      AppEvent.LOCATION_INGESTED,
      new LocationIngestedEvent(location),
    );

    return location;
  }

  async getCurrentLocation(vehicleId: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: { vehicleId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!location) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'No location data yet for this vehicle',
        HttpStatus.NOT_FOUND,
      );
    }
    return location;
  }

  async getHistory(
    vehicleId: string,
    query: LocationHistoryQueryDto,
  ): Promise<PaginatedResponse<Location>> {
    const locations = await this.prisma.location.findMany({
      where: {
        vehicleId,
        recordedAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && {
        cursor: { id: query.cursor },
        skip: 1,
      }),
    });

    const hasMore = locations.length > query.limit;
    const items = hasMore ? locations.slice(0, query.limit) : locations;
    const last = items.at(-1);

    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  private assertPayloadMatchesDevice(
    device: AuthenticatedDevice,
    dto: CreateLocationDto,
  ): void {
    if (
      dto.vehicleId !== device.vehicleId ||
      dto.deviceId !== device.deviceIdentifier
    ) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'deviceId/vehicleId in the payload do not match the authenticated device',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Rejects a point that implies an implausible jump (e.g. hundreds of km in
   * a few seconds) relative to the previous point, per GPS_MAX_JUMP_METERS /
   * GPS_MAX_JUMP_SECONDS. Only applies when the new point is chronologically
   * after the previous one — out-of-order points are accepted as-is rather
   * than guessed at.
   */
  private assertNotImplausibleJump(
    previous: Location | null,
    dto: CreateLocationDto,
  ): void {
    if (!previous) {
      return;
    }

    const elapsedSeconds =
      (new Date(dto.recordedAt).getTime() - previous.recordedAt.getTime()) /
      MILLISECONDS_PER_SECOND;
    if (elapsedSeconds <= 0) {
      return;
    }

    const maxJumpSeconds = this.configService.get<number>(
      'gps.maxJumpSeconds',
      10,
    );
    if (elapsedSeconds > maxJumpSeconds) {
      return;
    }

    const distanceMeters = haversineDistanceMeters(previous, dto);
    const maxJumpMeters = this.configService.get<number>(
      'gps.maxJumpMeters',
      2000,
    );
    if (distanceMeters > maxJumpMeters) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `GPS point rejected: implausible jump of ${Math.round(distanceMeters)}m in ${elapsedSeconds.toFixed(1)}s`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
