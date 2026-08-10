import { Module } from '@nestjs/common';
import { GeofencesController } from './geofences.controller';
import { GeofencesService } from './geofences.service';
import { GeofenceDetectionService } from './geofence-detection.service';

@Module({
  controllers: [GeofencesController],
  providers: [GeofencesService, GeofenceDetectionService],
})
export class GeofencesModule {}
