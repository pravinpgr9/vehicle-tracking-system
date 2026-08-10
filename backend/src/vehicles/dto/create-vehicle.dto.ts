import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MIN_VEHICLE_YEAR = 1900;
const MAX_VEHICLE_YEAR = 2100;

export class CreateVehicleDto {
  @ApiProperty({ example: 'My C3' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'MH15AB1234' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  registrationNumber!: string;

  @ApiPropertyOptional({ example: 'Citroen' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  make?: string;

  @ApiPropertyOptional({ example: 'C3' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsInt()
  @Min(MIN_VEHICLE_YEAR)
  @Max(MAX_VEHICLE_YEAR)
  year?: number;
}
