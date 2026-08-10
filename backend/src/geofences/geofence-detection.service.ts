import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import { GeofenceTransitionEvent } from '../common/events/geofence-transition.event';
import { haversineDistanceMeters } from '../common/utils/geo.util';
import {
  Geofence,
  GeofenceEventType,
  Location,
} from '../generated/prisma/client';

/**
 * Detects geofence enter/exit from ingested GPS points. State is derived
 * from the most recent GeofenceEvent for each vehicle/geofence pair rather
 * than a separate "current state" column, so a stale ENTER never repeats
 * while the vehicle stays inside (see spec ARCHITECTURE.md).
 */
@Injectable()
export class GeofenceDetectionService {
  private readonly logger = new Logger(GeofenceDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(AppEvent.LOCATION_INGESTED)
  async handleLocationIngested(event: LocationIngestedEvent): Promise<void> {
    const { location } = event;

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: location.vehicleId },
    });
    if (!vehicle) {
      return;
    }

    const geofences = await this.prisma.geofence.findMany({
      where: { userId: vehicle.userId, isActive: true },
    });

    for (const geofence of geofences) {
      await this.checkTransition(location, geofence);
    }
  }

  private async checkTransition(
    location: Location,
    geofence: Geofence,
  ): Promise<void> {
    const distance = haversineDistanceMeters(location, geofence);
    const isInside = distance <= geofence.radiusMeters;

    const lastEvent = await this.prisma.geofenceEvent.findFirst({
      where: { vehicleId: location.vehicleId, geofenceId: geofence.id },
      orderBy: { occurredAt: 'desc' },
    });
    const wasInside = lastEvent?.eventType === GeofenceEventType.ENTER;

    if (isInside === wasInside) {
      return;
    }

    const eventType = isInside
      ? GeofenceEventType.ENTER
      : GeofenceEventType.EXIT;
    const geofenceEvent = await this.prisma.geofenceEvent.create({
      data: {
        vehicleId: location.vehicleId,
        geofenceId: geofence.id,
        eventType,
        latitude: location.latitude,
        longitude: location.longitude,
      },
    });

    this.logger.log(
      `Geofence ${eventType.toLowerCase()}: vehicle=${location.vehicleId} geofence=${geofence.name}`,
    );
    const appEvent =
      eventType === GeofenceEventType.ENTER
        ? AppEvent.GEOFENCE_ENTERED
        : AppEvent.GEOFENCE_EXITED;
    this.eventEmitter.emit(
      appEvent,
      new GeofenceTransitionEvent(geofenceEvent, geofence),
    );
  }
}
