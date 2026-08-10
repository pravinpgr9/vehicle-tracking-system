import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { TrackingService } from '../tracking/tracking.service';
import { ReportsService } from '../reports/reports.service';
import { LocationResponseDto } from '../tracking/dto/location-response.dto';
import { TripResponseDto } from '../trips/dto/trip-response.dto';
import {
  DashboardSummaryResponseDto,
  DeviceStatusDto,
} from './dto/dashboard-summary-response.dto';
import { todayDateString } from '../common/utils/date-range.util';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly vehiclesService: VehiclesService,
    private readonly trackingService: TrackingService,
    private readonly reportsService: ReportsService,
  ) {}

  async getSummary(
    userId: string,
    vehicleId: string,
  ): Promise<DashboardSummaryResponseDto> {
    const vehicle = await this.vehiclesService.findOneOwned(userId, vehicleId);

    const [location, dailyReport, lastTrip, device] = await Promise.all([
      this.trackingService.findCurrentLocation(vehicleId),
      this.reportsService.getDaily(userId, {
        vehicleId,
        date: todayDateString(),
      }),
      this.prisma.trip.findFirst({
        where: { vehicleId },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.device.findFirst({
        where: { vehicleId, isActive: true },
        orderBy: { lastSeenAt: 'desc' },
      }),
    ]);

    return new DashboardSummaryResponseDto({
      vehicleStatus: vehicle.status,
      currentLocation: location ? new LocationResponseDto(location) : null,
      currentSpeed: location?.speed ?? null,
      todayDistanceKm: dailyReport.totalDistanceKm,
      todayTrips: dailyReport.totalTrips,
      lastTrip: lastTrip ? new TripResponseDto(lastTrip) : null,
      deviceStatus: device
        ? new DeviceStatusDto({
            isActive: device.isActive,
            lastSeenAt: device.lastSeenAt,
            online: this.isOnline(device.lastSeenAt),
          })
        : null,
    });
  }

  private isOnline(lastSeenAt: Date | null): boolean {
    if (!lastSeenAt) {
      return false;
    }
    const offlineMinutes = this.configService.get<number>(
      'alert.deviceOfflineMinutes',
      10,
    );
    const elapsedMinutes =
      (Date.now() - lastSeenAt.getTime()) /
      (SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND);
    return elapsedMinutes <= offlineMinutes;
  }
}
