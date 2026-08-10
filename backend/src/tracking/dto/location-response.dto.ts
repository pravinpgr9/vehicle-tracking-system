import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Location } from '../../generated/prisma/client';

export class LocationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() vehicleId: string;
  @ApiProperty() deviceId: string;
  @ApiProperty() latitude: number;
  @ApiProperty() longitude: number;
  @ApiPropertyOptional() altitude: number | null;
  @ApiPropertyOptional() speed: number | null;
  @ApiPropertyOptional() heading: number | null;
  @ApiPropertyOptional() accuracy: number | null;
  @ApiPropertyOptional() batteryLevel: number | null;
  @ApiProperty() recordedAt: Date;
  @ApiProperty() receivedAt: Date;

  constructor(location: Location) {
    this.id = location.id;
    this.vehicleId = location.vehicleId;
    this.deviceId = location.deviceId;
    this.latitude = location.latitude;
    this.longitude = location.longitude;
    this.altitude = location.altitude;
    this.speed = location.speed;
    this.heading = location.heading;
    this.accuracy = location.accuracy;
    this.batteryLevel = location.batteryLevel;
    this.recordedAt = location.recordedAt;
    this.receivedAt = location.receivedAt;
  }
}
