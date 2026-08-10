import { ApiProperty } from '@nestjs/swagger';
import { Geofence } from '../../generated/prisma/client';

export class GeofenceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() name: string;
  @ApiProperty() latitude: number;
  @ApiProperty() longitude: number;
  @ApiProperty() radiusMeters: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  constructor(geofence: Geofence) {
    this.id = geofence.id;
    this.userId = geofence.userId;
    this.name = geofence.name;
    this.latitude = geofence.latitude;
    this.longitude = geofence.longitude;
    this.radiusMeters = geofence.radiusMeters;
    this.isActive = geofence.isActive;
    this.createdAt = geofence.createdAt;
    this.updatedAt = geofence.updatedAt;
  }
}
