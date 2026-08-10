import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DeviceAuthGuard } from '../devices/guards/device-auth.guard';
import { CurrentDevice } from '../devices/decorators/current-device.decorator';
import type { AuthenticatedDevice } from '../devices/guards/device-auth.guard';
import { TrackingService } from './tracking.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationResponseDto } from './dto/location-response.dto';

@ApiTags('tracking')
@ApiSecurity('device-token')
@UseGuards(DeviceAuthGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('location')
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
