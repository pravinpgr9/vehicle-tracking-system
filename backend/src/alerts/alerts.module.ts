import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsEngineService } from './alerts-engine.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertsEngineService],
})
export class AlertsModule {}
