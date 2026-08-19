import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DeviceAuthGuard } from '../devices/guards/device-auth.guard';
import { CurrentDevice } from '../devices/decorators/current-device.decorator';
import type { AuthenticatedDevice } from '../devices/guards/device-auth.guard';
import { TrackingService } from './tracking.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationResponseDto } from './dto/location-response.dto';

// Wider than the app-wide default (see app.module.ts): this endpoint is
// device-authenticated (not shared-IP browser traffic) and every vehicle's
// GPS pings land here, so it shouldn't compete with interactive API calls
// for the same rate-limit bucket.
const INGESTION_THROTTLE = {
  default: {
    limit: Number(process.env.THROTTLE_INGESTION_LIMIT ?? 600),
    ttl: Number(process.env.THROTTLE_TTL_SECONDS ?? 60) * 1000,
  },
};

@ApiTags('tracking')
@ApiSecurity('device-token')
@UseGuards(DeviceAuthGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('location')
  @Throttle(INGESTION_THROTTLE)
  @ApiOperation({
    summary: 'Ingest a GPS point from a registered device',
    description: 'Authenticate with "Authorization: Device <token>".',
  })
  async createLocation(
    @CurrentDevice() device: AuthenticatedDevice,
    @Body() dto: CreateLocationDto,
  ): Promise<LocationResponseDto> {
    const location = await this.trackingService.ingestLocation(device, dto);
    return new LocationResponseDto(location);
  }
}
