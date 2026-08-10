import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'android-car-001' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  vehicleId!: string;

  @ApiProperty({ example: 20.0056 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 73.7891 })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ example: 560 })
  @IsOptional()
  @IsNumber()
  altitude?: number;

  @ApiPropertyOptional({ example: 42.5, description: 'km/h' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional({ example: 180, description: 'degrees, 0-360' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ example: 8, description: 'meters' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ example: 82, description: '0-100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiProperty({ example: '2026-08-10T17:02:15.000Z' })
  @IsISO8601()
  recordedAt!: string;
}
