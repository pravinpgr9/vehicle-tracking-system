import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceAuthGuard } from './guards/device-auth.guard';

@Module({
  imports: [VehiclesModule],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceAuthGuard],
  exports: [DeviceAuthGuard],
})
export class DevicesModule {}
