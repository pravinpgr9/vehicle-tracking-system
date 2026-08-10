import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Trip, TripStatus } from '../../generated/prisma/client';

export class TripResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() vehicleId: string;
  @ApiProperty() startedAt: Date;
  @ApiPropertyOptional() endedAt: Date | null;
  @ApiProperty() startLatitude: number;
  @ApiProperty() startLongitude: number;
  @ApiPropertyOptional() endLatitude: number | null;
  @ApiPropertyOptional() endLongitude: number | null;
  @ApiProperty() distanceMeters: number;
  @ApiPropertyOptional() durationSeconds: number | null;
  @ApiProperty() maxSpeed: number;
  @ApiProperty() averageSpeed: number;
  @ApiProperty({ enum: TripStatus }) status: TripStatus;

  constructor(trip: Trip) {
    this.id = trip.id;
    this.vehicleId = trip.vehicleId;
    this.startedAt = trip.startedAt;
    this.endedAt = trip.endedAt;
    this.startLatitude = trip.startLatitude;
    this.startLongitude = trip.startLongitude;
    this.endLatitude = trip.endLatitude;
    this.endLongitude = trip.endLongitude;
    this.distanceMeters = trip.distanceMeters;
    this.durationSeconds = trip.durationSeconds;
    this.maxSpeed = trip.maxSpeed;
    this.averageSpeed = trip.averageSpeed;
    this.status = trip.status;
  }
}
