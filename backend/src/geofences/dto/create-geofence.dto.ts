import { ApiProperty } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGeofenceDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 20.0056 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 73.7891 })
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ example: 200 })
  @IsPositive()
  radiusMeters!: number;
}
