import { ApiProperty } from '@nestjs/swagger';

export class DailyReportResponseDto {
  @ApiProperty({ example: '2026-08-10' }) date: string;
  @ApiProperty() totalTrips: number;
  @ApiProperty() totalDistanceKm: number;
  @ApiProperty() totalDrivingMinutes: number;
  @ApiProperty() maxSpeedKmh: number;
  @ApiProperty() averageSpeedKmh: number;

  constructor(data: {
    date: string;
    totalTrips: number;
    totalDistanceKm: number;
    totalDrivingMinutes: number;
    maxSpeedKmh: number;
    averageSpeedKmh: number;
  }) {
    this.date = data.date;
    this.totalTrips = data.totalTrips;
    this.totalDistanceKm = data.totalDistanceKm;
    this.totalDrivingMinutes = data.totalDrivingMinutes;
    this.maxSpeedKmh = data.maxSpeedKmh;
    this.averageSpeedKmh = data.averageSpeedKmh;
  }
}
