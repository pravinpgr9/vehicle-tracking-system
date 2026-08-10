import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DashboardSummaryQueryDto {
  @ApiProperty()
  @IsString()
  vehicleId!: string;
}
