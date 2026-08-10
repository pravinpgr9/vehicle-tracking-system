import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/constants/error-codes';
import { PaginatedResponse } from '../common/types/paginated-response.type';
import { TripQueryDto } from './dto/trip-query.dto';
import { Trip } from '../generated/prisma/client';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async findAllForVehicle(
    userId: string,
    vehicleId: string,
    query: TripQueryDto,
  ): Promise<PaginatedResponse<Trip>> {
    await this.vehiclesService.findOneOwned(userId, vehicleId);

    const trips = await this.prisma.trip.findMany({
      where: { vehicleId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = trips.length > query.limit;
    const items = hasMore ? trips.slice(0, query.limit) : trips;
    const last = items.at(-1);

    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async findOneOwned(
    userId: string,
    vehicleId: string,
    tripId: string,
  ): Promise<Trip> {
    await this.vehiclesService.findOneOwned(userId, vehicleId);
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.vehicleId !== vehicleId) {
      throw new AppException(
        ErrorCode.TRIP_NOT_FOUND,
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return trip;
  }
}
