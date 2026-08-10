import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AppEvent } from '../common/constants/events';
import { LocationIngestedEvent } from '../common/events/location-ingested.event';
import { GeofenceTransitionEvent } from '../common/events/geofence-transition.event';
import {
  Alert,
  AlertSeverity,
  AlertType,
  GeofenceEventType,
  Prisma,
} from '../generated/prisma/client';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SWEEP_INTERVAL_MS = 60_000;

function minutesAgo(minutes: number): Date {
  return new Date(
    Date.now() - minutes * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
  );
}

/**
 * Creates alerts from ingested locations and geofence transitions
 * (event-driven), plus device-offline and long-stop, which are inherently
 * about the *absence* of events and so need a periodic sweep instead.
 */
@Injectable()
export class AlertsEngineService {
  private readonly logger = new Logger(AlertsEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(AppEvent.LOCATION_INGESTED)
  async checkOverspeed(event: LocationIngestedEvent): Promise<void> {
    const { location } = event;
    const limit = this.configService.get<number>('alert.overspeedLimitKmh', 80);
    const speed = location.speed ?? 0;
    if (speed <= limit) {
      return;
    }

    // Edge-triggered: only alert on the transition into speeding, not on
    // every point while it continues, or this would fire every few seconds.
    const previous = await this.prisma.location.findFirst({
      where: {
        vehicleId: location.vehicleId,
        recordedAt: { lt: location.recordedAt },
      },
      orderBy: { recordedAt: 'desc' },
    });
    if ((previous?.speed ?? 0) > limit) {
      return;
    }

    await this.createAlert(
      location.vehicleId,
      AlertType.OVERSPEED,
      AlertSeverity.WARNING,
      'Overspeed detected',
      `Vehicle exceeded ${limit} km/h (recorded ${speed} km/h)`,
      { speed, limit, locationId: location.id },
    );
  }

  @OnEvent(AppEvent.GEOFENCE_ENTERED)
  async handleGeofenceEntered(payload: GeofenceTransitionEvent): Promise<void> {
    await this.createGeofenceAlert(payload, GeofenceEventType.ENTER);
  }

  @OnEvent(AppEvent.GEOFENCE_EXITED)
  async handleGeofenceExited(payload: GeofenceTransitionEvent): Promise<void> {
    await this.createGeofenceAlert(payload, GeofenceEventType.EXIT);
  }

  /** Alerts once per offline episode: skipped if a newer alert already covers it. */
  @Interval(SWEEP_INTERVAL_MS)
  async sweepDeviceOffline(): Promise<void> {
    const minutes = this.configService.get<number>(
      'alert.deviceOfflineMinutes',
      10,
    );
    const staleBefore = minutesAgo(minutes);

    const devices = await this.prisma.device.findMany({
      where: {
        isActive: true,
        vehicle: { status: 'ACTIVE' },
        OR: [
          { lastSeenAt: { lt: staleBefore } },
          { lastSeenAt: null, createdAt: { lt: staleBefore } },
        ],
      },
    });

    for (const device of devices) {
      const referenceTime = device.lastSeenAt ?? device.createdAt;
      const alreadyAlerted = await this.hasAlertSince(
        device.vehicleId,
        AlertType.DEVICE_OFFLINE,
        referenceTime,
      );
      if (alreadyAlerted) {
        continue;
      }

      await this.createAlert(
        device.vehicleId,
        AlertType.DEVICE_OFFLINE,
        AlertSeverity.CRITICAL,
        'Device offline',
        `No GPS data received since ${referenceTime.toISOString()}`,
        { deviceId: device.id },
      );
    }
  }

  /** Alerts once per stop episode, anchored to the last completed trip's end. */
  @Interval(SWEEP_INTERVAL_MS)
  async sweepLongStop(): Promise<void> {
    const minutes = this.configService.get<number>('alert.longStopMinutes', 15);
    const staleBefore = minutesAgo(minutes);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const vehicle of vehicles) {
      const latestTrip = await this.prisma.trip.findFirst({
        where: { vehicleId: vehicle.id },
        orderBy: { startedAt: 'desc' },
      });
      if (!latestTrip || latestTrip.status === 'ACTIVE') {
        continue;
      }

      const stoppedSince = latestTrip.endedAt ?? latestTrip.lastMovingAt;
      if (stoppedSince >= staleBefore) {
        continue;
      }

      const alreadyAlerted = await this.hasAlertSince(
        vehicle.id,
        AlertType.LONG_STOP,
        stoppedSince,
      );
      if (alreadyAlerted) {
        continue;
      }

      await this.createAlert(
        vehicle.id,
        AlertType.LONG_STOP,
        AlertSeverity.INFO,
        'Vehicle stopped for a long time',
        `Vehicle has been stationary since ${stoppedSince.toISOString()}`,
        { tripId: latestTrip.id },
      );
    }
  }

  private async hasAlertSince(
    vehicleId: string,
    type: AlertType,
    since: Date,
  ): Promise<boolean> {
    const latest = await this.prisma.alert.findFirst({
      where: { vehicleId, type },
      orderBy: { occurredAt: 'desc' },
    });
    return latest !== null && latest.occurredAt >= since;
  }

  private async createGeofenceAlert(
    payload: GeofenceTransitionEvent,
    eventType: GeofenceEventType,
  ): Promise<void> {
    const isEnter = eventType === GeofenceEventType.ENTER;
    await this.createAlert(
      payload.event.vehicleId,
      isEnter ? AlertType.GEOFENCE_ENTER : AlertType.GEOFENCE_EXIT,
      AlertSeverity.INFO,
      isEnter
        ? `Entered ${payload.geofence.name}`
        : `Exited ${payload.geofence.name}`,
      `Vehicle ${isEnter ? 'entered' : 'exited'} geofence "${payload.geofence.name}"`,
      { geofenceId: payload.geofence.id, geofenceEventId: payload.event.id },
    );
  }

  private async createAlert(
    vehicleId: string,
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    metadata: Prisma.InputJsonValue,
  ): Promise<Alert> {
    const alert = await this.prisma.alert.create({
      data: { vehicleId, type, severity, title, message, metadata },
    });
    this.logger.log(`Alert created: vehicle=${vehicleId} type=${type}`);
    this.eventEmitter.emit(AppEvent.ALERT_CREATED, alert);
    return alert;
  }
}
