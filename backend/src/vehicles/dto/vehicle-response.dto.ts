import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Vehicle, VehicleStatus } from '../../generated/prisma/client';

export class VehicleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() name: string;
  @ApiProperty() registrationNumber: string;
  @ApiPropertyOptional() make: string | null;
  @ApiPropertyOptional() model: string | null;
  @ApiPropertyOptional() year: number | null;
  @ApiProperty({ enum: VehicleStatus }) status: VehicleStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  constructor(vehicle: Vehicle) {
    this.id = vehicle.id;
    this.userId = vehicle.userId;
    this.name = vehicle.name;
    this.registrationNumber = vehicle.registrationNumber;
    this.make = vehicle.make;
    this.model = vehicle.model;
    this.year = vehicle.year;
    this.status = vehicle.status;
    this.createdAt = vehicle.createdAt;
    this.updatedAt = vehicle.updatedAt;
  }
}
