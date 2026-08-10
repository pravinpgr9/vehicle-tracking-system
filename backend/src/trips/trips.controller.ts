import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { TripsService } from './trips.service';
import { TripQueryDto } from './dto/trip-query.dto';
import { TripResponseDto } from './dto/trip-response.dto';
import { PaginatedResponse } from '../common/types/paginated-response.type';

@ApiTags('trips')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('vehicles/:vehicleId/trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @ApiOperation({ summary: "List a vehicle's trips (paginated)" })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Query() query: TripQueryDto,
  ): Promise<PaginatedResponse<TripResponseDto>> {
    const { items, nextCursor } = await this.tripsService.findAllForVehicle(
      user.id,
      vehicleId,
      query,
    );
    return {
      items: items.map((trip) => new TripResponseDto(trip)),
      nextCursor,
    };
  }

  @Get(':tripId')
  @ApiOperation({ summary: 'Get a trip by id' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Param('tripId') tripId: string,
  ): Promise<TripResponseDto> {
    const trip = await this.tripsService.findOneOwned(
      user.id,
      vehicleId,
      tripId,
    );
    return new TripResponseDto(trip);
  }
}
