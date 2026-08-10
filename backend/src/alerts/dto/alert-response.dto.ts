import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Alert, AlertSeverity, AlertType } from '../../generated/prisma/client';

export class AlertResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() vehicleId: string;
  @ApiProperty({ enum: AlertType }) type: AlertType;
  @ApiProperty({ enum: AlertSeverity }) severity: AlertSeverity;
  @ApiProperty() title: string;
  @ApiProperty() message: string;
  @ApiPropertyOptional() metadata: unknown;
  @ApiProperty() occurredAt: Date;
  @ApiPropertyOptional() readAt: Date | null;

  constructor(alert: Alert) {
    this.id = alert.id;
    this.vehicleId = alert.vehicleId;
    this.type = alert.type;
    this.severity = alert.severity;
    this.title = alert.title;
    this.message = alert.message;
    this.metadata = alert.metadata;
    this.occurredAt = alert.occurredAt;
    this.readAt = alert.readAt;
  }
}
