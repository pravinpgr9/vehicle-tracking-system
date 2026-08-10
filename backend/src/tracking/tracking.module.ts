import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { TrackingController } from './tracking.controller';
import { LocationsController } from './locations.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [DevicesModule, VehiclesModule],
  controllers: [TrackingController, LocationsController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
