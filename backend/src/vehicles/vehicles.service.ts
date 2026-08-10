import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/constants/error-codes';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from '../generated/prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data: { ...dto, userId } });
  }

  async findAllForUser(userId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns NOT_FOUND (not FORBIDDEN) when the vehicle belongs to another
   * user, so a caller can't distinguish "doesn't exist" from "not yours".
   */
  async findOneOwned(userId: string, vehicleId: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle || vehicle.userId !== userId) {
      throw new AppException(
        ErrorCode.VEHICLE_NOT_FOUND,
        'Vehicle not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return vehicle;
  }

  async update(
    userId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    await this.findOneOwned(userId, vehicleId);
    return this.prisma.vehicle.update({ where: { id: vehicleId }, data: dto });
  }

  async remove(userId: string, vehicleId: string): Promise<void> {
    await this.findOneOwned(userId, vehicleId);
    await this.prisma.vehicle.delete({ where: { id: vehicleId } });
  }
}
