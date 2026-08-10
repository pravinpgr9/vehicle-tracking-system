import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DailyReportQueryDto {
  @ApiProperty()
  @IsString()
  vehicleId!: string;

  @ApiPropertyOptional({
    example: '2026-08-10',
    description: 'YYYY-MM-DD, defaults to today (UTC)',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;
}
