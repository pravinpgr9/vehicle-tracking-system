import { ApiProperty } from '@nestjs/swagger';

export class MonthlyReportResponseDto {
  @ApiProperty({ example: '2026-08' }) month: string;
  @ApiProperty() totalTrips: number;
  @ApiProperty() totalDistanceKm: number;
  @ApiProperty() totalDrivingMinutes: number;
  @ApiProperty() averageTripDistanceKm: number;
  @ApiProperty() maxSpeedKmh: number;
  @ApiProperty() averageSpeedKmh: number;

  constructor(data: {
    month: string;
    totalTrips: number;
    totalDistanceKm: number;
    totalDrivingMinutes: number;
    averageTripDistanceKm: number;
    maxSpeedKmh: number;
    averageSpeedKmh: number;
  }) {
    this.month = data.month;
    this.totalTrips = data.totalTrips;
    this.totalDistanceKm = data.totalDistanceKm;
    this.totalDrivingMinutes = data.totalDrivingMinutes;
    this.averageTripDistanceKm = data.averageTripDistanceKm;
    this.maxSpeedKmh = data.maxSpeedKmh;
    this.averageSpeedKmh = data.averageSpeedKmh;
  }
}
