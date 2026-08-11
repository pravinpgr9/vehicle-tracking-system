import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import { haversineDistanceMeters, msToKmh } from '../common/utils/geo.util';
import { Location, Trip } from '../generated/prisma/client';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SWEEP_INTERVAL_MS = 30_000;

/**
 * A trip only starts once this many consecutive points are at/above
 * TRIP_START_SPEED_KMH, so a single noisy GPS speed reading can't start one.
 */
const TRIP_START_CONSECUTIVE_POINTS = 2;

/**
 * Detects trips from ingested GPS points: starts one after a few
 * consecutive moving points, keeps it going through short stops (traffic,
 * signals), and ends it once the vehicle has been still for
 * TRIP_END_STOP_MINUTES. See ARCHITECTURE.md for the full state machine.
 */
@Injectable()
export class TripDetectionService {
  private readonly logger = new Logger(TripDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(AppEvent.LOCATION_INGESTED)
  async handleLocationIngested(event: LocationIngestedEvent): Promise<void> {
    const { location } = event;

    const activeTrip = await this.prisma.trip.findFirst({
      where: { vehicleId: location.vehicleId, status: 'ACTIVE' },
    });

    if (activeTrip) {
      await this.continueTrip(activeTrip, location);
    } else {
      await this.maybeStartTrip(location);
    }
  }

  /** Ends any trip that has been still for longer than TRIP_END_STOP_MINUTES. */
  @Interval(SWEEP_INTERVAL_MS)
  async endStaleTrips(): Promise<void> {
    const endStopMinutes = this.configService.get<number>(
      'trip.endStopMinutes',
      5,
    );
    const staleBefore = new Date(
      Date.now() -
        endStopMinutes * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
    );

    const staleTrips = await this.prisma.trip.findMany({
      where: { status: 'ACTIVE', lastMovingAt: { lt: staleBefore } },
    });

    for (const trip of staleTrips) {
      await this.completeTrip(trip);
    }
  }

  private async maybeStartTrip(location: Location): Promise<void> {
    const startSpeedKmh = this.configService.get<number>(
      'trip.startSpeedKmh',
      5,
    );
    if ((location.speed ?? 0) < startSpeedKmh) {
      return;
    }

    const recentPoints = await this.prisma.location.findMany({
      where: { vehicleId: location.vehicleId },
      orderBy: { recordedAt: 'desc' },
      take: TRIP_START_CONSECUTIVE_POINTS,
    });
    const isConsistentlyMoving =
      recentPoints.length === TRIP_START_CONSECUTIVE_POINTS &&
      recentPoints.every((point) => (point.speed ?? 0) >= startSpeedKmh);
    if (!isConsistentlyMoving) {
      return;
    }

    // The trip actually began at the earlier of the two qualifying points,
    // not the one that happened to trigger this check (`location`) — using
    // `location` for both start and end would silently drop the distance
    // already covered between the two points that established the trip.
    const previous = recentPoints[1];
    const initialDistanceMeters = haversineDistanceMeters(previous, location);
    const initialDurationSeconds = Math.max(
      0,
      Math.round(
        (location.recordedAt.getTime() - previous.recordedAt.getTime()) /
          MILLISECONDS_PER_SECOND,
      ),
    );
    const initialMaxSpeed = Math.max(previous.speed ?? 0, location.speed ?? 0);
    const initialAverageSpeed =
      initialDurationSeconds > 0
        ? msToKmh(initialDistanceMeters / initialDurationSeconds)
        : initialMaxSpeed;

    const trip = await this.prisma.trip.create({
      data: {
        vehicleId: location.vehicleId,
        startedAt: previous.recordedAt,
        startLatitude: previous.latitude,
        startLongitude: previous.longitude,
        endLatitude: location.latitude,
        endLongitude: location.longitude,
        distanceMeters: initialDistanceMeters,
        durationSeconds: initialDurationSeconds,
        maxSpeed: initialMaxSpeed,
        averageSpeed: initialAverageSpeed,
        lastMovingAt: location.recordedAt,
      },
    });

    this.logger.log(
      `Trip started: vehicle=${location.vehicleId} trip=${trip.id}`,
    );
    this.eventEmitter.emit(AppEvent.TRIP_STARTED, trip);
  }

  private async continueTrip(trip: Trip, location: Location): Promise<void> {
    const startSpeedKmh = this.configService.get<number>(
      'trip.startSpeedKmh',
      5,
    );

    // Distance accrues from the trip's last recorded point regardless of
    // instantaneous speed: the jump check already rejected implausible GPS
    // errors, and a stationary vehicle's jitter is a small, accepted cost
    // for not needing a second distance-accumulation rule.
    const distanceMeters =
      trip.distanceMeters +
      haversineDistanceMeters(
        {
          latitude: trip.endLatitude ?? trip.startLatitude,
          longitude: trip.endLongitude ?? trip.startLongitude,
        },
        location,
      );
    const durationSeconds = Math.max(
      0,
      Math.round(
        (location.recordedAt.getTime() - trip.startedAt.getTime()) /
          MILLISECONDS_PER_SECOND,
      ),
    );
    const maxSpeed = Math.max(trip.maxSpeed, location.speed ?? 0);
    const averageSpeed =
      durationSeconds > 0
        ? msToKmh(distanceMeters / durationSeconds)
        : trip.averageSpeed;
    const isMoving = (location.speed ?? 0) >= startSpeedKmh;

    const updated = await this.prisma.trip.update({
      where: { id: trip.id },
      data: {
        distanceMeters,
        durationSeconds,
        maxSpeed,
        averageSpeed,
        endLatitude: location.latitude,
        endLongitude: location.longitude,
        lastMovingAt: isMoving ? location.recordedAt : trip.lastMovingAt,
      },
    });

    this.eventEmitter.emit(AppEvent.TRIP_UPDATED, updated);
  }

  private async completeTrip(trip: Trip): Promise<void> {
    const durationSeconds = Math.max(
      0,
      Math.round(
        (trip.lastMovingAt.getTime() - trip.startedAt.getTime()) /
          MILLISECONDS_PER_SECOND,
      ),
    );

    const completed = await this.prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: 'COMPLETED',
        endedAt: trip.lastMovingAt,
        durationSeconds,
      },
    });

    this.logger.log(
      `Trip completed: vehicle=${trip.vehicleId} trip=${trip.id}`,
    );
    this.eventEmitter.emit(AppEvent.TRIP_COMPLETED, completed);
  }
}
