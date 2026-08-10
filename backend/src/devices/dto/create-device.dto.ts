import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DeviceType } from '../../generated/prisma/client';

export class CreateDeviceDto {
  @ApiProperty({ enum: DeviceType, example: DeviceType.PHONE })
  @IsEnum(DeviceType)
  deviceType!: DeviceType;

  @ApiProperty({ example: 'android-car-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  deviceIdentifier!: string;

  @ApiPropertyOptional({ example: 'android' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;
}
