import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class MonthlyReportQueryDto {
  @ApiProperty()
  @IsString()
  vehicleId!: string;

  @ApiPropertyOptional({
    example: '2026-08',
    description: 'YYYY-MM, defaults to the current month (UTC)',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;
}
