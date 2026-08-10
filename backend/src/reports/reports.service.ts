import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import {
  dayRange,
  monthRange,
  todayDateString,
  currentMonthString,
} from '../common/utils/date-range.util';
import { DailyReportQueryDto } from './dto/daily-report-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { DailyReportResponseDto } from './dto/daily-report-response.dto';
import { MonthlyReportResponseDto } from './dto/monthly-report-response.dto';
import { Trip } from '../generated/prisma/client';

const METERS_PER_KM = 1000;
const SECONDS_PER_MINUTE = 60;

interface TripAggregate {
  totalTrips: number;
  totalDistanceKm: number;
  totalDrivingMinutes: number;
  maxSpeedKmh: number;
  averageSpeedKmh: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async getDaily(
    userId: string,
    query: DailyReportQueryDto,
  ): Promise<DailyReportResponseDto> {
    await this.vehiclesService.findOneOwned(userId, query.vehicleId);
    const date = query.date ?? todayDateString();
    const trips = await this.tripsWithin(query.vehicleId, dayRange(date));
    return new DailyReportResponseDto({ date, ...this.aggregate(trips) });
  }

  async getMonthly(
    userId: string,
    query: MonthlyReportQueryDto,
  ): Promise<MonthlyReportResponseDto> {
    await this.vehiclesService.findOneOwned(userId, query.vehicleId);
    const month = query.month ?? currentMonthString();
    const trips = await this.tripsWithin(query.vehicleId, monthRange(month));
    const aggregate = this.aggregate(trips);
    const averageTripDistanceKm =
      aggregate.totalTrips > 0
        ? aggregate.totalDistanceKm / aggregate.totalTrips
        : 0;
    return new MonthlyReportResponseDto({
      month,
      ...aggregate,
      averageTripDistanceKm,
    });
  }

  private async tripsWithin(
    vehicleId: string,
    range: { start: Date; end: Date },
  ): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      where: {
        vehicleId,
        startedAt: { gte: range.start, lte: range.end },
      },
    });
  }

  private aggregate(trips: Trip[]): TripAggregate {
    const totalDistanceKm =
      trips.reduce((sum, trip) => sum + trip.distanceMeters, 0) / METERS_PER_KM;
    const totalDrivingMinutes =
      trips.reduce((sum, trip) => sum + (trip.durationSeconds ?? 0), 0) /
      SECONDS_PER_MINUTE;
    const maxSpeedKmh = trips.reduce(
      (max, trip) => Math.max(max, trip.maxSpeed),
      0,
    );
    const averageSpeedKmh =
      totalDrivingMinutes > 0
        ? totalDistanceKm / (totalDrivingMinutes / SECONDS_PER_MINUTE)
        : 0;

    return {
      totalTrips: trips.length,
      totalDistanceKm,
      totalDrivingMinutes,
      maxSpeedKmh,
      averageSpeedKmh,
    };
  }
}
