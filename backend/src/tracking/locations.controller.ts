import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { VehiclesService } from '../vehicles/vehicles.service';
import { TrackingService } from './tracking.service';
import { LocationHistoryQueryDto } from './dto/location-history-query.dto';
import { LocationResponseDto } from './dto/location-response.dto';
import { PaginatedResponse } from '../common/types/paginated-response.type';

@ApiTags('vehicles')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('vehicles/:vehicleId')
export class LocationsController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  @Get('location')
  @ApiOperation({ summary: "Get a vehicle's most recent known location" })
  async getCurrent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ): Promise<LocationResponseDto> {
    await this.vehiclesService.findOneOwned(user.id, vehicleId);
    const location = await this.trackingService.getCurrentLocation(vehicleId);
    return new LocationResponseDto(location);
  }

  @Get('locations')
  @ApiOperation({ summary: "Get a vehicle's location history (paginated)" })
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Query() query: LocationHistoryQueryDto,
  ): Promise<PaginatedResponse<LocationResponseDto>> {
    await this.vehiclesService.findOneOwned(user.id, vehicleId);
    const { items, nextCursor } = await this.trackingService.getHistory(
      vehicleId,
      query,
    );
    return {
      items: items.map((location) => new LocationResponseDto(location)),
      nextCursor,
    };
  }
}
