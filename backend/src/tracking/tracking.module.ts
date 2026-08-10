import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { TrackingController } from './tracking.controller';
import { LocationsController } from './locations.controller';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [DevicesModule, VehiclesModule, AuthModule],
  controllers: [TrackingController, LocationsController],
  providers: [TrackingService, TrackingGateway],
  exports: [TrackingService],
})
export class TrackingModule {}
