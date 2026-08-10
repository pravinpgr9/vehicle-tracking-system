import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleStatus } from '../../generated/prisma/client';
import { LocationResponseDto } from '../../tracking/dto/location-response.dto';
import { TripResponseDto } from '../../trips/dto/trip-response.dto';

export class DeviceStatusDto {
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() lastSeenAt: Date | null;
  @ApiProperty() online: boolean;

  constructor(data: {
    isActive: boolean;
    lastSeenAt: Date | null;
    online: boolean;
  }) {
    this.isActive = data.isActive;
    this.lastSeenAt = data.lastSeenAt;
    this.online = data.online;
  }
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ enum: VehicleStatus }) vehicleStatus: VehicleStatus;
  @ApiPropertyOptional({ type: LocationResponseDto })
  currentLocation: LocationResponseDto | null;
  @ApiPropertyOptional() currentSpeed: number | null;
  @ApiProperty() todayDistanceKm: number;
  @ApiProperty() todayTrips: number;
  @ApiPropertyOptional({ type: TripResponseDto })
  lastTrip: TripResponseDto | null;
  @ApiPropertyOptional({ type: DeviceStatusDto })
  deviceStatus: DeviceStatusDto | null;

  constructor(data: {
    vehicleStatus: VehicleStatus;
    currentLocation: LocationResponseDto | null;
    currentSpeed: number | null;
    todayDistanceKm: number;
    todayTrips: number;
    lastTrip: TripResponseDto | null;
    deviceStatus: DeviceStatusDto | null;
  }) {
    this.vehicleStatus = data.vehicleStatus;
    this.currentLocation = data.currentLocation;
    this.currentSpeed = data.currentSpeed;
    this.todayDistanceKm = data.todayDistanceKm;
    this.todayTrips = data.todayTrips;
    this.lastTrip = data.lastTrip;
    this.deviceStatus = data.deviceStatus;
  }
}
