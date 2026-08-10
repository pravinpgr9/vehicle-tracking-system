import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripDetectionService } from './trip-detection.service';

@Module({
  imports: [VehiclesModule],
  controllers: [TripsController],
  providers: [TripsService, TripDetectionService],
})
export class TripsModule {}
