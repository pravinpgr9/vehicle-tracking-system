import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Device, DeviceType } from '../../generated/prisma/client';

export class DeviceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() vehicleId: string;
  @ApiProperty({ enum: DeviceType }) deviceType: DeviceType;
  @ApiProperty() deviceIdentifier: string;
  @ApiPropertyOptional() platform: string | null;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() lastSeenAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  constructor(device: Device) {
    this.id = device.id;
    this.vehicleId = device.vehicleId;
    this.deviceType = device.deviceType;
    this.deviceIdentifier = device.deviceIdentifier;
    this.platform = device.platform;
    this.isActive = device.isActive;
    this.lastSeenAt = device.lastSeenAt;
    this.createdAt = device.createdAt;
    this.updatedAt = device.updatedAt;
  }
}

export class DeviceCreatedResponseDto extends DeviceResponseDto {
  @ApiProperty({
    description:
      'Plaintext device token, shown only once. Store it on the device ' +
      '(e.g. Android app) and send it as "Authorization: Device <token>".',
  })
  token: string;

  constructor(device: Device, token: string) {
    super(device);
    this.token = token;
  }
}
